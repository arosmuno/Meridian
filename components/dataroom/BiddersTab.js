// Pestana Postores (owner/admin): grupos de postores aislados entre si, quien esta en cada uno,
// caducidad del acceso por grupo e informe de actividad por postor (lectura, descargas, preguntas)
// con el mapa de calor documento x postor.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { dr, fmtDate, downloadCsv } from './api';
import { S, C } from './styles';

const dur = (s) => {
  s = Number(s) || 0;
  if (s < 60) return s ? `${s} s` : '—';
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
};
const toInputDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export default function BiddersTab({ room, members, docs, reloadMembers }) {
  const [groups, setGroups] = useState([]);
  const [gm, setGm] = useState([]);
  const [pending, setPending] = useState([]);
  const [report, setReport] = useState([]);
  const [heat, setHeat] = useState([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const email = (id) => (members.find((m) => m.user_id === id) || {}).email || '(pendiente de entrar)';

  async function load() {
    const [g, m, p, r, h] = await Promise.all([
      dr().from('room_groups').select('*').eq('room_id', room.id).order('name'),
      dr().from('group_members').select('*').eq('room_id', room.id),
      dr().from('group_invites').select('*').eq('room_id', room.id).is('accepted_at', null),
      supabase.rpc('dataroom_bidder_report', { p_room: room.id }),
      supabase.rpc('dataroom_doc_engagement', { p_room: room.id }),
    ]);
    setGroups(g.data || []); setGm(m.data || []); setPending(p.data || []); setReport(r.data || []); setHeat(h.data || []);
    if (g.error) setMsg(g.error.message);
  }
  useEffect(() => { load(); }, [room.id]); // eslint-disable-line

  async function createGroup(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await dr().from('room_groups').insert({ room_id: room.id, org_id: room.org_id, name: name.trim() });
    if (error) return setMsg(/duplicate/i.test(error.message) ? 'Ya hay un grupo con ese nombre.' : error.message);
    setName(''); setMsg(''); load();
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={S.card}>
        <div style={S.cardHead}>Grupos de postores</div>
        <p style={{ ...S.hint, marginTop: -6, marginBottom: 12, maxWidth: 820 }}>
          Cada grupo es un postor (un fondo, un comprador industrial, un banco…). Sus miembros solo ven esta sala, sus propias preguntas de Q&A y del chat,
          las carpetas abiertas y las restringidas a las que des acceso a su grupo. No ven a los demás postores. Quien no está en ningún grupo es equipo vendedor y lo ve todo.
          Invita a los postores desde aquí, no desde el equipo de la organización.
        </p>
        <form onSubmit={createGroup} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input style={{ ...S.input, flex: 1, maxWidth: 360 }} placeholder="Nombre del postor, p. ej. «Fondo A»" value={name} onChange={(e) => setName(e.target.value)} />
          <button style={S.btn}>+ Crear grupo</button>
        </form>
        {msg && <div style={S.err}>{msg}</div>}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {groups.map((g) => <GroupCard key={g.id} group={g} members={gm.filter((x) => x.group_id === g.id)} pending={pending.filter((x) => x.group_id === g.id)} email={email} reload={() => { load(); reloadMembers && reloadMembers(); }} />)}
          {!groups.length && <div style={S.empty}>Sin grupos todavía. Si la sala es solo para tu equipo, no hace falta crear ninguno.</div>}
        </div>
      </section>

      <Report room={room} report={report} heat={heat} groups={groups} docs={docs} />
    </div>
  );
}

function GroupCard({ group, members, pending, email, reload }) {
  const [add, setAdd] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [expires, setExpires] = useState(toInputDate(group.expires_at));

  async function addMember(e) {
    e.preventDefault();
    const em = add.trim().toLowerCase();
    if (!em) return;
    setBusy(true); setNote('');
    const { data, error } = await supabase.rpc('dataroom_add_to_group', { p_group: group.id, p_email: em });
    if (error) { setBusy(false); return setNote(error.message); }
    if (data === 'invited') {
      // Enlace de acceso: al entrar por primera vez queda directamente dentro de este grupo.
      const { error: mailErr } = await supabase.auth.signInWithOtp({ email: em, options: { emailRedirectTo: window.location.origin + '/dataroom' } });
      setNote(mailErr ? `Invitado, pero no se pudo enviar el email (${mailErr.message}). Dile que entre en /dataroom con ese email.` : 'Invitación enviada: le llega un enlace de acceso por email.');
    } else setNote('Añadido al grupo.');
    setAdd(''); setBusy(false); reload();
  }
  async function remove(userId) {
    if (!window.confirm('¿Quitar a esta persona del grupo? Dejará de ver la sala.')) return;
    await dr().from('group_members').delete().eq('room_id', group.room_id).eq('user_id', userId);
    reload();
  }
  async function cancelInvite(id) {
    await dr().from('group_invites').delete().eq('id', id);
    reload();
  }
  async function saveExpiry(v) {
    setExpires(v);
    const { error } = await dr().from('room_groups').update({ expires_at: v ? new Date(v + 'T23:59:59').toISOString() : null }).eq('id', group.id);
    if (error) setNote(error.message); else setNote(v ? 'Caducidad guardada.' : 'Sin caducidad.');
  }
  async function rename() {
    const n = window.prompt('Nuevo nombre del grupo', group.name);
    if (!n || !n.trim()) return;
    const { error } = await dr().from('room_groups').update({ name: n.trim() }).eq('id', group.id);
    if (error) setNote(error.message); else reload();
  }
  async function removeGroup() {
    if (!window.confirm(`¿Eliminar el grupo «${group.name}»? Sus miembros dejarán de ver la sala. Sus preguntas se conservan.`)) return;
    await dr().from('room_groups').delete().eq('id', group.id);
    reload();
  }
  const expired = group.expires_at && new Date(group.expires_at) < new Date();

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, background: C.soft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{group.name}</div>
        {expired && <span style={{ ...S.tag, color: C.red, borderColor: C.red }}>Caducado</span>}
        <button style={S.icon} onClick={rename} title="Renombrar">✎</button>
        <button style={S.icon} onClick={removeGroup} title="Eliminar grupo">✕</button>
      </div>
      <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
        {members.map((m) => (
          <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{email(m.user_id)}</span>
            <a style={{ color: C.mid, cursor: 'pointer', fontSize: 12 }} onClick={() => remove(m.user_id)}>quitar</a>
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.mid }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email} · invitado</span>
            <a style={{ color: C.mid, cursor: 'pointer', fontSize: 12 }} onClick={() => cancelInvite(p.id)}>cancelar</a>
          </div>
        ))}
        {!members.length && !pending.length && <div style={S.empty}>Nadie todavía.</div>}
      </div>
      <form onSubmit={addMember} style={{ display: 'flex', gap: 6 }}>
        <input style={{ ...S.input, flex: 1 }} type="email" placeholder="email@postor.com" value={add} onChange={(e) => setAdd(e.target.value)} />
        <button style={S.btnGhost} disabled={busy}>{busy ? '…' : 'Añadir'}</button>
      </form>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: C.mid, marginTop: 8 }}>
        Acceso hasta <input type="date" style={{ ...S.input, padding: '4px 8px', fontSize: 12 }} value={expires} onChange={(e) => saveExpiry(e.target.value)} />
        {expires && <a style={{ cursor: 'pointer' }} onClick={() => saveExpiry('')}>quitar</a>}
      </label>
      {note && <div style={{ ...S.hint, color: /no se pudo|error|solo|válido|no puede/i.test(note) ? C.red : C.green }}>{note}</div>}
    </div>
  );
}

function Report({ room, report, heat, groups, docs }) {
  const totalDocs = docs.length;
  const rows = [...report].sort((a, b) => b.total_seconds - a.total_seconds);
  const byDoc = useMemo(() => {
    const m = new Map();
    for (const h of heat) {
      if (!m.has(h.document_id)) m.set(h.document_id, { total: 0, cells: {} });
      const e = m.get(h.document_id);
      e.total += h.seconds;
      e.cells[h.group_id] = h;
    }
    return [...m.entries()].map(([id, v]) => ({ doc: docs.find((d) => d.id === id), ...v })).filter((x) => x.doc).sort((a, b) => b.total - a.total).slice(0, 40);
  }, [heat, docs]);
  const max = Math.max(1, ...heat.map((h) => h.seconds));
  const shade = (s) => (s ? `rgba(154,125,30,${0.12 + 0.6 * (s / max)})` : 'transparent');

  function exportCsv() {
    downloadCsv(`Postores-${room.name}.csv`, [
      ['Postor', 'Personas', 'Documentos vistos', 'Tiempo de lectura (min)', 'Aperturas', 'Descargas', 'Preguntas Q&A', 'Preguntas chat', 'Última actividad', 'Acceso hasta'],
      ...rows.map((r) => [r.group_name, r.members, `${r.docs_viewed}/${totalDocs}`, Math.round(r.total_seconds / 60), r.views, r.downloads, r.qa_questions, r.chat_questions, fmtDate(r.last_activity), r.expires_at ? fmtDate(r.expires_at) : '']),
      [],
      ['Documento', ...groups.map((g) => `${g.name} (min)`)],
      ...byDoc.map((x) => [x.doc.name, ...groups.map((g) => (x.cells[g.id] ? Math.round(x.cells[g.id].seconds / 60) : 0))]),
    ]);
  }

  return (
    <section style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ ...S.cardHead, margin: 0, flex: 1 }}>Informe por postor</div>
        {rows.length > 0 && <button style={S.btnGhost} onClick={exportCsv}>Exportar CSV</button>}
      </div>
      {!rows.length ? <div style={S.empty}>Cuando haya grupos con actividad, aquí verás quién lee qué, cuánto tiempo y cuántas preguntas hace.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
            <thead><tr>{['Postor', 'Personas', 'Docs vistos', 'Tiempo de lectura', 'Aperturas', 'Descargas', 'Q&A', 'Chat', 'Última actividad'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.group_id}>
                  <td style={{ ...td, fontWeight: 700 }}>{r.group_name}</td>
                  <td style={tdn}>{r.members}</td>
                  <td style={tdn}>{r.docs_viewed}/{totalDocs}</td>
                  <td style={tdn}>{dur(r.total_seconds)}</td>
                  <td style={tdn}>{r.views}</td>
                  <td style={tdn}>{r.downloads}</td>
                  <td style={tdn}>{r.qa_questions}</td>
                  <td style={tdn}>{r.chat_questions}</td>
                  <td style={td}>{r.last_activity ? fmtDate(r.last_activity) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {byDoc.length > 0 && groups.length > 0 && (
        <>
          <div style={{ ...S.cardHead, fontSize: 15, margin: '22px 0 8px' }}>Qué lee cada postor</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
              <thead><tr><th style={th}>Documento</th>{groups.map((g) => <th key={g.id} style={{ ...th, textAlign: 'center' }}>{g.name}</th>)}</tr></thead>
              <tbody>
                {byDoc.map((x) => (
                  <tr key={x.doc.id}>
                    <td style={{ ...td, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.doc.name}</td>
                    {groups.map((g) => { const c = x.cells[g.id]; return <td key={g.id} style={{ ...td, textAlign: 'center', background: shade(c && c.seconds) }}>{c ? dur(c.seconds) : ''}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={S.hint}>Tiempo con el documento abierto en pantalla. Útil para ver qué postores están haciendo due diligence en serio y en qué se están fijando.</p>
        </>
      )}
    </section>
  );
}
const th = { textAlign: 'left', padding: '7px 10px', borderBottom: `2px solid ${C.line2}`, fontSize: 12, color: C.mid, whiteSpace: 'nowrap' };
const td = { padding: '7px 10px', borderBottom: `1px solid ${C.line}` };
const tdn = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
