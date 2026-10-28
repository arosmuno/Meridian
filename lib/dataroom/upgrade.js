// lib/dataroom/upgrade.js -- cuando el modelo principal esta saturado, el chat responde con el
// de respaldo para no hacer esperar al usuario, y despues el principal regenera esa respuesta.
// Lo intenta el navegador del usuario mientras tiene la sala abierta y, si no, el cron.
import { dra } from './server';
import { answer } from './rag';

const MAX_ATTEMPTS = 6;

export async function upgradeMessage(messageId, { deadline = Date.now() + 50000 } = {}) {
  const { data: msg } = await dra().from('messages').select('*').eq('id', messageId).maybeSingle();
  if (!msg || msg.role !== 'assistant') return { upgraded: false, reason: 'no existe' };
  if (msg.tier !== 'fallback') return { upgraded: msg.tier === 'full', message: msg };
  if (msg.upgrade_attempts >= MAX_ATTEMPTS) return { upgraded: false, reason: 'agotado' };

  const { data: session } = await dra().from('chat_sessions').select('*').eq('id', msg.session_id).single();
  const { data: room } = await dra().from('rooms').select('*').eq('id', session.room_id).single();
  const { data: before } = await dra().from('messages').select('role, content, created_at').eq('session_id', msg.session_id)
    .lt('created_at', msg.created_at).order('created_at', { ascending: false }).limit(11);
  const prior = (before || []).reverse();
  const question = prior.length && prior[prior.length - 1].role === 'user' ? prior.pop().content : null;
  if (!question) return { upgraded: false, reason: 'sin pregunta' };

  // Bloqueo optimista: solo un proceso regenera a la vez (el contador sube antes de empezar).
  const { data: claimed } = await dra().from('messages').update({ upgrade_attempts: msg.upgrade_attempts + 1 })
    .eq('id', msg.id).eq('upgrade_attempts', msg.upgrade_attempts).eq('tier', 'fallback').select('id');
  if (!claimed || !claimed.length) return { upgraded: false, reason: 'en curso' };

  let out;
  try {
    // Con los permisos de quien pregunto: la respuesta no puede ver mas carpetas que el.
    out = await answer({ room, userId: session.user_id, question, history: prior, deadline, fullOnly: true });
    if (out.tier !== 'full') console.log('[upgrade] sin modelo principal:', out.model);
  } catch (e) {
    return { upgraded: false, reason: String((e && e.message) || e).slice(0, 120) };
  }
  if (out.tier !== 'full') return { upgraded: false, reason: 'modelo principal no disponible' };
  const { data: updated } = await dra().from('messages').update({
    content: out.answer, citations: out.citations, model: out.model, tier: 'full',
    draft_content: msg.content, upgraded_at: new Date().toISOString(),
  }).eq('id', msg.id).select('id, role, content, citations, created_at, tier, model, draft_content, upgraded_at').single();
  return { upgraded: true, message: updated };
}

// Para el cron: regenera las respuestas de respaldo pendientes de las ultimas 48 h.
// El cron tiene 300 s: cada regeneracion puede probar varios modelos Flash con calma.
export async function upgradePending({ deadline = Date.now() + 25000 } = {}) {
  const since = new Date(Date.now() - 48 * 3600e3).toISOString();
  const { data } = await dra().from('messages').select('id').eq('tier', 'fallback').lt('upgrade_attempts', MAX_ATTEMPTS)
    .gt('created_at', since).order('created_at').limit(5);
  let done = 0;
  for (const m of data || []) {
    if (Date.now() > deadline - 30000) break;
    const r = await upgradeMessage(m.id, { deadline });
    if (!r.upgraded) console.log('[upgrade]', m.id, r.reason || '');
    if (r.upgraded) done++;
  }
  return { done };
}
