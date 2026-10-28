// Pestana Q&A: cualquier miembro pregunta; el equipo vendedor responde (con borrador de IA citado).
// Con postores: cada uno ve solo sus preguntas y las que el vendedor publique para todos.
import { useEffect, useState } from 'react';
import { api, dr, fmtDate, downloadCsv } from './api';
import { S, C } from './styles';

const ST = { open: 'Abierta', answered: 'Respondida', closed: 'Cerrada' };
const STC = { open: C.gold, answered: C.green, closed: C.lo };

export default function QaTab({ room, canWrite, isSeller = true, members, docs, openViewer }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [text, setText] = useState('');
  const [docId, setDocId] = useState('');
  const [msg, setMsg] = useState('');
  const [drafts, setDrafts] = useState({});
  const [working, setWorking] = useState({});
  const [groups, setGroups] = useState([]);
  const gname = (id) => ((groups.find((g) => g.id === id) || {}).name) || '';
  // A un postor no se le muestra quien hizo una pregunta publicada de otro grupo.
  const email = (id) => (members.find((m) => m.user_id === id) || {}).email || (isSeller ? '—' : 'Otro postor');

  async function load() {
    const { data, error } = await dr().from('questions').select('*').eq('room_id', room.id).order('created_at', { ascending: false });
    if (error) setMsg(error.message); else setItems(data || []);
  }
  useEffect(() => { load(); dr().from('room_groups').select('id, name').eq('room_id', room.id).then(({ data }) => setGroups(data || [])); }, [room.id]); // eslint-disable-line

  async function ask(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try { await api('/api/dataroom/qa', { action: 'ask', room_id: room.id, question: text, document_id: docId || null }); setText(''); setDocId(''); load(); }
    catch (err) { setMsg(err.message); }
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
  const shown = items.filter((q) => filter === 'all' || q.status === filter);
  const counts = items.reduce((m, q) => ((m[q.status] = (m[q.status] || 0) + 1), m), {});
  const exportCsv = () => downloadCsv(`QA-${room.name}.csv`, [['Fecha', 'Pregunta', 'Documento', 'Preguntado por', 'Estado', 'Respuesta', 'Respondido por'],
    ...items.map((q) => [fmtDate(q.created_at), q.question, (docs.find((d) => d.id === q.document_id) || {}).name || '', email(q.asked_by), ST[q.status], q.answer || '', q.answered_by ? email(q.answered_by) : ''])]);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={S.card}>
        <div style={S.cardHead}>Nueva pregunta</div>
        <form onSubmit={ask} style={{ display: 'grid', gap: 8 }}>
          <textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }} placeholder="Ej.: ¿Existen contratos con clientes que se puedan resolver por cambio de control?" value={text} onChange={(e) => setText(e.target.value)} />
          {!isSeller && <div style={S.hint}>Tus preguntas solo las ve tu equipo y el vendedor.</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <select style={{ ...S.input, flex: 1 }} value={docId} onChange={(e) => setDocId(e.target.value)}>
              <option value="">Sobre la sala en general</option>
              {docs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button style={S.btn}>Enviar pregunta</button>
          </div>
        </form>
        {msg && <div style={S.err}>{msg}</div>}
      </section>

      <section style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ ...S.cardHead, margin: 0, flex: 1 }}>Preguntas ({items.length})</div>
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
                  <span>{email(q.asked_by)} · {fmtDate(q.created_at)}</span>
                  {isSeller && q.group_id && <span style={{ ...S.tag, color: C.gold, borderColor: C.gold }}>Postor: {gname(q.group_id) || 'grupo'}</span>}
                  {q.visibility === 'all' && <span style={{ ...S.tag, color: C.green, borderColor: C.green }}>Publicada para todos</span>}
                  {d && <a style={{ color: C.gold, cursor: 'pointer' }} onClick={() => openViewer(d)}>📄 {d.name}</a>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{q.question}</div>
                {q.answer && <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px' }}>{q.answer}<div style={{ fontSize: 11, color: C.lo, marginTop: 6 }}>Respondida por {email(q.answered_by)} · {fmtDate(q.answered_at)}</div></div>}
                {canWrite && q.status !== 'closed' && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                    <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' }} placeholder="Respuesta…" value={draft} onChange={(e) => setDrafts((x) => ({ ...x, [q.id]: e.target.value }))} />
                    {q.ai_citations && q.ai_citations.length > 0 && drafts[q.id] == null && q.ai_draft && !q.answer && (
                      <div style={{ fontSize: 12, color: C.gold, display: 'flex', gap: 8, flexWrap: 'wrap' }}>Fuentes del borrador: {q.ai_citations.map((c) => <a key={c.n} style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { const dd = docs.find((x) => x.id === c.document_id); if (dd) openViewer(dd, c.page || 1); }}>[{c.n}] {c.label || c.document_name}</a>)}</div>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button style={S.btnGhost} disabled={!!working[q.id]} onClick={() => act(q, 'draft')}>{working[q.id] === 'draft' ? 'Redactando…' : '✦ Borrador con IA'}</button>
                      <button style={S.btn} disabled={!!working[q.id] || !draft.trim()} onClick={() => act(q, 'answer', { answer: draft })}>{q.answer ? 'Actualizar respuesta' : 'Publicar respuesta'}</button>
                      <button style={S.btnGhost} disabled={!!working[q.id]} onClick={() => act(q, 'close')}>Cerrar</button>
                      {q.group_id && <button style={S.btnGhost} disabled={!!working[q.id]} title="Que la vean (con su respuesta) todos los postores, sin indicar quién preguntó" onClick={() => act(q, 'visibility', { visibility: q.visibility === 'all' ? 'group' : 'all' })}>{q.visibility === 'all' ? 'Solo para su grupo' : 'Publicar para todos los postores'}</button>}
                    </div>
                  </div>
                )}
                {canWrite && q.status === 'closed' && <button style={{ ...S.btnGhost, marginTop: 8 }} onClick={() => act(q, 'reopen')}>Reabrir</button>}
              </div>
            );
          })}
          {!shown.length && <div style={S.empty}>No hay preguntas{filter !== 'all' ? ' con ese estado' : ''}.</div>}
        </div>
      </section>
    </div>
  );
}
