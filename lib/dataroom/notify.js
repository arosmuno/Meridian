// lib/dataroom/notify.js -- avisos por email del dataroom.
//
// Las acciones (documento nuevo, nueva version, pregunta, respuesta) dejan una fila por
// destinatario en dataroom.notifications y el cron (cada 30 min) manda UN email por persona y
// sala con todo lo pendiente. Asi una subida de 300 archivos no son 300 correos.
// Los destinatarios salen de dataroom_room_audience: miembros con avisos activados que pueden
// ver esa carpeta, con la sala abierta para ellos y, si es de un grupo de postores, solo su grupo.
import { admin, dra } from './server';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.meridiancapmarkets.com';
const FROM = process.env.DATAROOM_MAIL_FROM || 'Meridian Dataroom <acceso@meridiancapmarkets.com>';

export async function enqueue({ room, kind, payload = {}, folderId = null, group = null, sellersOnly = false, onlyUsers = null, exclude = null }) {
  try {
    const { data, error } = await admin.rpc('dataroom_room_audience', { p_room: room.id, p_folder: folderId, p_group: group, p_sellers_only: sellersOnly });
    if (error) throw error;
    const rows = (data || [])
      .filter((u) => u.user_id !== exclude && (!onlyUsers || onlyUsers.includes(u.user_id)))
      .map((u) => ({ org_id: room.org_id, room_id: room.id, user_id: u.user_id, kind, payload: { ...payload, email: u.email } }));
    if (rows.length) await dra().from('notifications').insert(rows);
    return rows.length;
  } catch (e) {
    console.error('[notify]', e.message);
    return 0;
  }
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function line(n) {
  const p = n.payload || {};
  if (n.kind === 'doc_new') return `Documento nuevo: <b>${esc(p.name)}</b>`;
  if (n.kind === 'doc_version') return `Nueva versión (v${esc(p.version)}): <b>${esc(p.name)}</b>${p.note ? ` — ${esc(p.note)}` : ''}`;
  if (n.kind === 'qa_new') return `Pregunta nueva${p.group ? ` de ${esc(p.group)}` : ''}: «${esc(String(p.question || '').slice(0, 220))}»`;
  if (n.kind === 'qa_answer') return `Respondida: «${esc(String(p.question || '').slice(0, 220))}»`;
  if (n.kind === 'qa_published') return `Nueva respuesta publicada para todos los postores: «${esc(String(p.question || '').slice(0, 220))}»`;
  return esc(n.kind);
}

function emailHtml(roomName, roomId, items) {
  const more = items.length > 25 ? `<p style="margin:10px 0 0;font-size:13px;color:#736c61;">…y ${items.length - 25} más.</p>` : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f0e8;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0e8;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2ddd0;border-radius:12px;">
<tr><td style="padding:24px 28px 14px;border-bottom:1px solid #e2ddd0;">
<span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:#1c1916;">MERIDIAN</span>
<span style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;color:#9a7d1e;padding-left:8px;">DATAROOM</span>
</td></tr>
<tr><td style="padding:22px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#1c1916;">
<h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:21px;">Novedades en ${esc(roomName)}</h1>
<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;">${items.slice(0, 25).map((n) => `<li>${line(n)}</li>`).join('')}</ul>${more}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr><td style="background:#1c1916;border-radius:8px;">
<a href="${SITE}/dataroom/${roomId}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Abrir la sala</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 28px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#a59d8f;">
Recibes este aviso porque tienes acceso a esta sala. Puedes desactivar los avisos en ${SITE}/dataroom.
</td></tr></table></td></tr></table></body></html>`;
}

async function sendMail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, skipped: true };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!r.ok) return { ok: false, error: (await r.text()).slice(0, 200) };
  return { ok: true };
}

// Lo llama el cron: agrupa lo pendiente por persona y sala y manda un email por grupo.
export async function sendPending({ deadline = Date.now() + 30000 } = {}) {
  if (!process.env.RESEND_API_KEY) return { sent: 0, skipped: 'sin RESEND_API_KEY' };
  const since = new Date(Date.now() - 7 * 86400e3).toISOString();
  const { data } = await dra().from('notifications').select('*').is('sent_at', null).gt('created_at', since).order('created_at').limit(1000);
  const groups = new Map();
  for (const n of data || []) {
    const k = `${n.user_id}:${n.room_id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(n);
  }
  const roomIds = [...new Set((data || []).map((n) => n.room_id))];
  const { data: rooms } = roomIds.length ? await dra().from('rooms').select('id, name').in('id', roomIds) : { data: [] };
  const roomName = (id) => ((rooms || []).find((r) => r.id === id) || {}).name || 'la sala';
  let sent = 0;
  for (const items of groups.values()) {
    if (Date.now() > deadline) break;
    const first = items[0];
    const to = first.payload && first.payload.email;
    const ids = items.map((n) => n.id);
    if (to) {
      const out = await sendMail({ to, subject: `Meridian Dataroom · ${items.length} novedad${items.length > 1 ? 'es' : ''} en ${roomName(first.room_id)}`, html: emailHtml(roomName(first.room_id), first.room_id, items) });
      if (!out.ok) { console.error('[notify] envio fallido:', out.error || out.skipped); continue; }
      sent++;
    }
    await dra().from('notifications').update({ sent_at: new Date().toISOString() }).in('id', ids);
  }
  return { sent };
}
