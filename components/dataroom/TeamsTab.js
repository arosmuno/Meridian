// Pestana Equipos (owner/admin): las otras partes de la operacion (normalmente 1 o 2: comprador,
// banco...), quien esta en cada una y su actividad (lectura, descargas, preguntas) con el mapa de
// calor documento x equipo. El equipo organizador es la propia organizacion.
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

export default function TeamsTab({ room, orgName = '', members, docs, reloadMembers }) {
  const [groups, setGroups] = useState([]);
  const [gm, setGm] = useState([]);
  const [pending, setPending] = useState([]);
  const [report, setReport] = useState([]);
  const [heat, setHeat] = useState([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const email = (id) => (members.find((m) => m.user_id === id) || {}).email || '(pendiente de entrar)';
  const roleOf = (id) => (members.find((m) => m.user_id === id) || {}).role || 'viewer';

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
    if (error) return setMsg(/duplicate/i.test(error.message) ? 'Ya hay un equipo con ese nombre.' : error.message);
    setName(''); setMsg(''); load();
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={S.card}>
        <div style={S.cardHead}>Equipos de la operación</div>
        <p style={{ ...S.hint, marginTop: -6, marginBottom: 12, maxWidth: 820 }}>
          Tu equipo es <b>{orgName || 'el organizador'}</b>. Añade aquí a las otras partes (normalmente una o dos: comprador, banco, asesor…) e invita a su gente por email.
          Cada equipo ve las carpetas abiertas y las restringidas a las que le des acceso, sube sus propios documentos, se cruza preguntas con los demás en el Q&A
          y tiene su chat privado con el analista. Solo ven esta sala.
        </p>
        <form onSubmit={createGroup} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input style={{ ...S.input, flex: 1, maxWidth: 360 }} placeholder="Nombre, p. ej. «Comprador» o «Banco»" value={name} onChange={(e) => setName(e.target.value)} />
          <button style={S.btn}>+ Añadir equipo</button>
        </form>
        {msg && <div style={S.err}>{msg}</div>}
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {groups.map((g) => <GroupCard key={g.id} group={g} members={gm.filter((x) => x.group_id === g.id)} pending={pending.filter((x) => x.group_id === g.id)} email={email} roleOf={roleOf} reload={() => { load(); reloadMembers && reloadMembers(); }} />)}
          {!groups.length && <div style={S.empty}>Solo está tu equipo. Si la sala es interna, no hace falta añadir ninguno.</div>}
        </div>
      </section>

      <Report room={room} report={report} heat={heat} groups={groups} docs={docs} />
    </div>
  );
}

function GroupCard({ group, members, pending, email, roleOf, reload }) {
  async function setWrite(userId, on) {
    const { error } = await supabase.rpc('dataroom_set_member_role', { p_org: group.org_id, p_user: userId, p_role: on ? 'member' : 'viewer' });
    if (error) setNote(error.message); else reload();
  }
  const [add, setAdd] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function addMember(e) {
    e.preventDefault();
    const em = add.trim().toLowerCase();
    if (!em) return;
    setBusy(true); setNote('');
    const { data, error } = await supabase.rpc('dataroom_add_to_group', { p_group: group.id, p_email: em });
    if (error) { setBusy(false); return setNote(error.message); }
    if (data === 'invited') {
      // Enlace de acceso: al entrar por primera vez queda directamente dentro de este equipo.
      const { error: mailErr } = await supabase.auth.signInWithOtp({ email: em, options: { emailRedirectTo: window.location.origin + '/dataroom' } });
      setNote(mailErr ? `Invitado, pero no se pudo enviar el email (${mailErr.message}). Dile que entre en /dataroom con ese email.` : 'Invitación enviada: le llega un enlace de acceso por email.');
    } else setNote('Añadido al equipo.');
    setAdd(''); setBusy(false); reload();
  }
  async function remove(userId) {
    if (!window.confirm('¿Quitar a esta persona del equipo? Dejará de ver la sala.')) return;
    await dr().from('group_members').delete().eq('room_id', group.room_id).eq('user_id', userId);
    reload();
  }
  async function cancelInvite(id) {
    await dr().from('group_invites').delete().eq('id', id);
    reload();
  }
  async function rename() {
    const n = window.prompt('Nuevo nombre del equipo', group.name);
    if (!n || !n.trim()) return;
    const { error } = await dr().from('room_groups').update({ name: n.trim() }).eq('id', group.id);
    if (error) setNote(error.message); else reload();
  }
  async function removeGroup() {
    if (!window.confirm(`¿Eliminar el equipo «${group.name}»? Sus miembros dejarán de ver la sala. Sus preguntas se conservan.`)) return;
    await dr().from('room_groups').delete().eq('id', group.id);
    reload();
  }

  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, background: C.soft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{group.name}</div>
        <button style={S.icon} onClick={rename} title="Renombrar">✎</button>
        <button style={S.icon} onClick={removeGroup} title="Eliminar equipo">✕</button>
      </div>
      <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
        {members.map((m) => (
          <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{email(m.user_id)}</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.mid, cursor: 'pointer' }} title="Si no lo marcas, solo puede consultar y descargar">
              <input type="checkbox" checked={roleOf(m.user_id) === 'member'} onChange={(e) => setWrite(m.user_id, e.target.checked)} /> sube y pregunta
            </label>
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
        {(members.length > 0 || pending.length > 0) && <div style={{ fontSize: 11, color: C.lo }}>Entran con acceso de lectura. Marca «sube y pregunta» para quien deba subir documentos y preguntar o responder en el Q&A.</div>}
      </div>
      <form onSubmit={addMember} style={{ display: 'flex', gap: 6 }}>
        <input style={{ ...S.input, flex: 1 }} type="email" placeholder="nombre@empresa.com" value={add} onChange={(e) => setAdd(e.target.value)} />
        <button style={S.btnGhost} disabled={busy}>{busy ? '…' : 'Añadir'}</button>
      </form>
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
    downloadCsv(`Equipos-${room.name}.csv`, [
      ['Equipo', 'Personas', 'Documentos vistos', 'Tiempo de lectura (min)', 'Aperturas', 'Descargas', 'Preguntas Q&A', 'Última actividad'],
      ...rows.map((r) => [r.group_name, r.members, `${r.docs_viewed}/${totalDocs}`, Math.round(r.total_seconds / 60), r.views, r.downloads, r.qa_questions, fmtDate(r.last_activity)]),
      [],
      ['Documento', ...groups.map((g) => `${g.name} (min)`)],
      ...byDoc.map((x) => [x.doc.name, ...groups.map((g) => (x.cells[g.id] ? Math.round(x.cells[g.id].seconds / 60) : 0))]),
    ]);
  }

  return (
    <section style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ ...S.cardHead, margin: 0, flex: 1 }}>Actividad por equipo</div>
        {rows.length > 0 && <button style={S.btnGhost} onClick={exportCsv}>Exportar CSV</button>}
      </div>
      {!rows.length ? <div style={S.empty}>Cuando las otras partes empiecen a trabajar, aquí verás qué leen, cuánto tiempo y cuántas preguntas hacen.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
            <thead><tr>{['Equipo', 'Personas', 'Docs vistos', 'Tiempo de lectura', 'Aperturas', 'Descargas', 'Preguntas Q&A', 'Última actividad'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
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
                  <td style={td}>{r.last_activity ? fmtDate(r.last_activity) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {byDoc.length > 0 && groups.length > 0 && (
        <>
          <div style={{ ...S.cardHead, fontSize: 15, margin: '22px 0 8px' }}>Qué lee cada equipo</div>
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
          <p style={S.hint}>Tiempo con el documento abierto en pantalla: en qué se está fijando cada parte.</p>
        </>
      )}
    </section>
  );
}
const th = { textAlign: 'left', padding: '7px 10px', borderBottom: `2px solid ${C.line2}`, fontSize: 12, color: C.mid, whiteSpace: 'nowrap' };
const td = { padding: '7px 10px', borderBottom: `1px solid ${C.line}` };
const tdn = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
