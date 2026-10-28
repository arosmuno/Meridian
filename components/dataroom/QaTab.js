// Pestana Q&A: preguntas formales de un equipo a otro, con su respuesta, que quedan registradas.
// La ven el equipo que pregunta y el que responde (y los admins). Responde el equipo destinatario,
// con ayuda de un borrador de IA citado. Para hablar dentro del propio equipo esta el chat.
import { useEffect, useState } from 'react';
import { api, dr, fmtDate, downloadCsv } from './api';
import { S, C } from './styles';

const ST = { open: 'Abierta', answered: 'Respondida', closed: 'Cerrada' };
const STC = { open: C.gold, answered: C.green, closed: C.lo };
const same = (a, b) => (a || null) === (b || null);

export default function QaTab({ room, canWrite, isAdmin, myTeam = null, orgName = '', members, docs, openViewer }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [text, setText] = useState('');
  const [docId, setDocId] = useState('');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');
  const [drafts, setDrafts] = useState({});
  const [working, setWorking] = useState({});
  const [teams, setTeams] = useState([]);
  const teamName = (id) => (id ? ((teams.find((g) => g.id === id) || {}).name || 'Otro equipo') : (orgName || 'Organizador'));
  const email = (id) => (members.find((m) => m.user_id === id) || {}).email || '—';
  // Equipos a los que se puede preguntar: todos menos el propio (null = organizador).
  const targets = [{ id: '', name: orgName || 'Organizador' }, ...teams.map((g) => ({ id: g.id, name: g.name }))].filter((t) => !same(t.id || null, myTeam));

  async function load() {
    const { data, error } = await dr().from('questions').select('*').eq('room_id', room.id).order('created_at', { ascending: false });
    if (error) setMsg(error.message); else setItems(data || []);
  }
  useEffect(() => {
    load();
    dr().from('room_groups').select('id, name').eq('room_id', room.id).order('name').then(({ data }) => setTeams(data || []));
  }, [room.id]); // eslint-disable-line
  useEffect(() => { if (to === '' && targets.length && !targets.some((t) => t.id === '')) setTo(targets[0].id); }, [teams, myTeam]); // eslint-disable-line

  async function ask(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setMsg('');
    try {
      await api('/api/dataroom/qa', { action: 'ask', room_id: room.id, question: text, document_id: docId || null, to_group_id: to || null });
      setText(''); setDocId(''); load();
    } catch (err) { setMsg(err.message); }
  }
  async function act(q, action, extra = {}) {
    setWorking((w) => ({ ...w, [q.id]: action })); setMsg('');
    try {
      const out = await api('/api/dataroom/qa', { action, room_id: room.id, question_id: q.id, ...extra });
      if (action === 'draft') setDrafts((d) => ({ ...d, [q.id]: out.ai_draft }));
      await load();
    } catch (err) { setMsg(err.message); }
    setWorking((w) => { const n = { ...w }; delete n[q.id]; return n; });
  }
  const canAnswer = (q) => canWrite && (isAdmin || same(q.to_group_id, myTeam));
  const shown = items.filter((q) => filter === 'all' || q.status === filter || (filter === 'mine' && canAnswer(q) && q.status === 'open'));
  const counts = items.reduce((m, q) => ((m[q.status] = (m[q.status] || 0) + 1), m), {});
  const pendingMine = items.filter((q) => q.status === 'open' && canAnswer(q)).length;
  const exportCsv = () => downloadCsv(`QA-${room.name}.csv`, [['Fecha', 'De', 'Para', 'Pregunta', 'Documento', 'Preguntado por', 'Estado', 'Respuesta', 'Respondido por', 'Fecha respuesta'],
    ...items.map((q) => [fmtDate(q.created_at), teamName(q.group_id), teamName(q.to_group_id), q.question, (docs.find((d) => d.id === q.document_id) || {}).name || '', email(q.asked_by), ST[q.status], q.answer || '', q.answered_by ? email(q.answered_by) : '', q.answered_at ? fmtDate(q.answered_at) : ''])]);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {canWrite && targets.length > 0 && (
        <section style={S.card}>
          <div style={S.cardHead}>Nueva pregunta</div>
          <form onSubmit={ask} style={{ display: 'grid', gap: 8 }}>
            <textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }} placeholder="Ej.: ¿Existen contratos con clientes que se puedan resolver por cambio de control?" value={text} onChange={(e) => setText(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.mid }}>Para
                <select style={S.input} value={to} onChange={(e) => setTo(e.target.value)}>
                  {targets.map((t) => <option key={t.id || 'org'} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <select style={{ ...S.input, flex: 1, minWidth: 200 }} value={docId} onChange={(e) => setDocId(e.target.value)}>
                <option value="">Sobre la operación en general</option>
                {docs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button style={S.btn}>Enviar pregunta</button>
            </div>
            <div style={S.hint}>La pregunta y su respuesta quedan registradas y las ven tu equipo y el equipo al que va dirigida. Para comentar algo solo dentro de tu equipo, usa el chat.</div>
          </form>
          {msg && <div style={S.err}>{msg}</div>}
        </section>
      )}
      {canWrite && !targets.length && <section style={{ ...S.card, color: C.mid, fontSize: 14 }}>Todavía no hay otra parte en la sala. Cuando el organizador añada un equipo (comprador, banco…), podréis cruzaros preguntas aquí.</section>}

      <section style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ ...S.cardHead, margin: 0, flex: 1 }}>Preguntas y respuestas ({items.length})</div>
          {pendingMine > 0 && <button style={filter === 'mine' ? { ...S.btnGhost, background: '#fbf3e2', fontWeight: 700, borderColor: C.gold } : { ...S.btnGhost, borderColor: C.gold, color: C.gold }} onClick={() => setFilter('mine')}>Te toca responder ({pendingMine})</button>}
          {['all', 'open', 'answered', 'closed'].map((f) => (
            <button key={f} style={filter === f ? { ...S.btnGhost, background: C.soft, fontWeight: 700 } : S.btnGhost} onClick={() => setFilter(f)}>{f === 'all' ? 'Todas' : `${ST[f]} (${counts[f] || 0})`}</button>
          ))}
          {items.length > 0 && <button style={S.btnGhost} onClick={exportCsv}>Exportar CSV</button>}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {shown.map((q) => {
            const d = docs.find((x) => x.id === q.document_id);
            const draft = drafts[q.id] != null ? drafts[q.id] : (q.answer || q.ai_draft || '');
            return (
              <div key={q.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, background: C.soft }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, color: C.mid, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ ...S.tag, color: STC[q.status], borderColor: STC[q.status] }}>{ST[q.status]}</span>
                  <span style={{ fontWeight: 600, color: C.ink }}>{teamName(q.group_id)} → {teamName(q.to_group_id)}</span>
                  <span>{email(q.asked_by)} · {fmtDate(q.created_at)}</span>
                  {d && <a style={{ color: C.gold, cursor: 'pointer' }} onClick={() => openViewer(d)}>📄 {d.name}</a>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{q.question}</div>
                {q.answer && <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px' }}>{q.answer}<div style={{ fontSize: 11, color: C.lo, marginTop: 6 }}>Respondida por {email(q.answered_by)} · {fmtDate(q.answered_at)}</div></div>}
                {canAnswer(q) && q.status !== 'closed' && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                    <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} placeholder="Respuesta…" value={draft} onChange={(e) => setDrafts((x) => ({ ...x, [q.id]: e.target.value }))} />
                    {q.ai_citations && q.ai_citations.length > 0 && drafts[q.id] == null && q.ai_draft && !q.answer && (
                      <div style={{ fontSize: 12, color: C.gold, display: 'flex', gap: 8, flexWrap: 'wrap' }}>Fuentes del borrador: {q.ai_citations.map((c) => <a key={c.n} style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { const dd = docs.find((x) => x.id === c.document_id); if (dd) openViewer(dd, c.page || 1); }}>[{c.n}] {c.label || c.document_name}</a>)}</div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button style={S.btnGhost} disabled={!!working[q.id]} onClick={() => act(q, 'draft')}>{working[q.id] === 'draft' ? 'Redactando…' : '✦ Borrador con IA'}</button>
                      <button style={S.btn} disabled={!!working[q.id] || !draft.trim()} onClick={() => act(q, 'answer', { answer: draft })}>{q.answer ? 'Actualizar respuesta' : 'Publicar respuesta'}</button>
                      <button style={S.btnGhost} disabled={!!working[q.id]} onClick={() => act(q, 'close')}>Cerrar</button>
                    </div>
                  </div>
                )}
                {canAnswer(q) && q.status === 'closed' && <button style={{ ...S.btnGhost, marginTop: 8 }} onClick={() => act(q, 'reopen')}>Reabrir</button>}
              </div>
            );
          })}
          {!shown.length && <div style={S.empty}>No hay preguntas{filter !== 'all' ? ' con ese filtro' : ''}.</div>}
        </div>
      </section>
    </div>
  );
}
