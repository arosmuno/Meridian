// Pestana Actividad (owner/admin): quien vio, descargo, subio, pregunto o acepto el NDA.
import { useEffect, useState } from 'react';
import { dr, fmtDate, downloadCsv } from './api';
import { S, C } from './styles';

const LABEL = {
  document_view: 'Vio', document_download: 'Descargó', document_upload: 'Subió', document_delete: 'Eliminó',
  chat_question: 'Preguntó al chat', qa_ask: 'Hizo una pregunta (Q&A)', qa_answer: 'Respondió (Q&A)', qa_close: 'Cerró una pregunta',
  qa_reopen: 'Reabrió una pregunta', nda_accept: 'Aceptó el NDA', model_review: 'Revisión de modelo',
};

export default function ActivityTab({ room, members }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [who, setWho] = useState('all');
  const email = (id) => (members.find((m) => m.user_id === id) || {}).email || '—';
  useEffect(() => {
    dr().from('audit_log').select('*').eq('room_id', room.id).order('created_at', { ascending: false }).limit(1000).then(({ data }) => setRows(data || []));
  }, [room.id]);
  const shown = rows.filter((r) => (filter === 'all' || r.action === filter) && (who === 'all' || r.actor === who));
  const detail = (r) => (r.meta && (r.meta.name || r.meta.question || r.meta.email)) || '';
  const actions = [...new Set(rows.map((r) => r.action))];
  return (
    <section style={S.card}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...S.cardHead, margin: 0, flex: 1 }}>Actividad de la sala</div>
        <select style={S.input} value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">Todas las personas</option>
          {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.email}</option>)}
        </select>
        <select style={S.input} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todas las acciones</option>
          {actions.map((a) => <option key={a} value={a}>{LABEL[a] || a}</option>)}
        </select>
        <button style={S.btnGhost} onClick={() => downloadCsv(`Actividad-${room.name}.csv`, [['Fecha', 'Persona', 'Acción', 'Detalle'], ...shown.map((r) => [fmtDate(r.created_at), email(r.actor), LABEL[r.action] || r.action, detail(r)])])}>Exportar CSV</button>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {shown.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '150px 220px 180px 1fr', gap: 10, fontSize: 13, padding: '7px 10px', borderBottom: `1px solid ${C.line}` }}>
            <span style={{ color: C.mid }}>{fmtDate(r.created_at)}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{email(r.actor)}</span>
            <span style={{ fontWeight: 600 }}>{LABEL[r.action] || r.action}</span>
            <span style={{ color: C.mid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail(r)}</span>
          </div>
        ))}
        {!shown.length && <div style={S.empty}>Sin actividad registrada.</div>}
      </div>
    </section>
  );
}
