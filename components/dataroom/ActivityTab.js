// Pestana Actividad.
// - Preguntas del equipo (todos los miembros): que ha preguntado cada persona al analista, con
//   acceso a la conversacion completa en solo lectura.
// - Registro completo (owner/admin): quien vio, descargo, subio, pregunto o acepto el NDA.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { dr, fmtDate, downloadCsv } from './api';
import { S, C } from './styles';
import Markdown from './Markdown';

const LABEL = {
  document_view: 'Vio', document_download: 'Descargó', document_upload: 'Subió', document_delete: 'Eliminó',
  chat_question: 'Preguntó al chat', qa_ask: 'Hizo una pregunta (Q&A)', qa_answer: 'Respondió (Q&A)', qa_close: 'Cerró una pregunta',
  qa_reopen: 'Reabrió una pregunta', nda_accept: 'Aceptó el NDA', model_review: 'Revisión de modelo',
};

export default function ActivityTab({ room, members, isAdmin, docs, openViewer }) {
  const [view, setView] = useState('questions');
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {isAdmin && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={view === 'questions' ? S.btn : S.btnGhost} onClick={() => setView('questions')}>Preguntas del equipo</button>
          <button style={view === 'log' ? S.btn : S.btnGhost} onClick={() => setView('log')}>Registro completo</button>
        </div>
      )}
      {view === 'questions' || !isAdmin
        ? <TeamQuestions room={room} members={members} docs={docs} openViewer={openViewer} />
        : <AuditLog room={room} members={members} />}
    </div>
  );
}

function TeamQuestions({ room, members, docs, openViewer }) {
  const [rows, setRows] = useState(null);
  const [who, setWho] = useState('all');
  const [q, setQ] = useState('');
  const [thread, setThread] = useState(null);
  useEffect(() => {
    supabase.rpc('dataroom_room_questions', { p_room_id: room.id }).then(({ data }) => setRows(data || []));
  }, [room.id]);
  const people = useMemo(() => [...new Map((rows || []).map((r) => [r.user_id, r.email])).entries()], [rows]);
  const shown = (rows || []).filter((r) => (who === 'all' || r.user_id === who) && (!q || r.content.toLowerCase().includes(q.toLowerCase())));

  async function openThread(r) {
    const { data } = await dr().from('messages').select('id, role, content, citations, created_at').eq('session_id', r.session_id).order('created_at');
    setThread({ email: r.email, messages: data || [], focus: r.message_id });
  }

  return (
    <section style={S.card}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...S.cardHead, margin: 0, flex: 1 }}>Preguntas del equipo al analista</div>
        <input style={{ ...S.input, width: 220 }} placeholder="Buscar en las preguntas…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={S.input} value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">Todo el equipo</option>
          {people.map(([id, email]) => <option key={id} value={id}>{email}</option>)}
        </select>
        <button style={S.btnGhost} onClick={() => downloadCsv(`Preguntas-${room.name}.csv`, [['Fecha', 'Persona', 'Pregunta'], ...shown.map((r) => [fmtDate(r.created_at), r.email, r.content])])}>Exportar CSV</button>
      </div>
      {rows === null && <div style={S.empty}>Cargando…</div>}
      {rows && !shown.length && <div style={S.empty}>Todavía nadie ha preguntado al analista en esta sala.</div>}
      <div style={{ display: 'grid', gap: 2 }}>
        {shown.map((r) => (
          <div key={r.message_id} onClick={() => openThread(r)} style={{ display: 'grid', gridTemplateColumns: '140px 200px 1fr 90px', gap: 10, fontSize: 13, padding: '8px 10px', borderBottom: `1px solid ${C.line}`, cursor: 'pointer', alignItems: 'baseline' }}>
            <span style={{ color: C.mid }}>{fmtDate(r.created_at)}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</span>
            <span style={{ color: C.ink }}>{r.content}</span>
            <span style={{ color: C.gold, fontSize: 12, textAlign: 'right' }}>Ver respuesta →</span>
          </div>
        ))}
      </div>
      {thread && <Thread thread={thread} docs={docs} openViewer={openViewer} onClose={() => setThread(null)} />}
    </section>
  );
}

function Thread({ thread, docs, openViewer, onClose }) {
  const openCite = (m, n) => {
    const c = (m.citations || []).find((x) => x.n === n);
    const d = c && docs.find((x) => x.id === c.document_id);
    if (d) { onClose(); openViewer(d, c.page || 1); }
  };
  useEffect(() => {
    const el = document.getElementById('msg-' + thread.focus);
    if (el) el.scrollIntoView({ block: 'start' });
  }, [thread]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,22,.45)', zIndex: 40, display: 'flex', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ background: C.paper, borderRadius: 12, width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${C.line}`, background: '#fffdf9' }}>
          <div style={{ flex: 1, fontSize: 14 }}>Conversación de <b>{thread.email}</b> <span style={{ color: C.lo }}>· solo lectura</span></div>
          <button style={S.btnGhost} onClick={onClose}>Cerrar</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 16, display: 'grid', gap: 12 }}>
          {thread.messages.map((m) => (
            <div key={m.id} id={'msg-' + m.id} style={{ justifySelf: m.role === 'user' ? 'end' : 'stretch', maxWidth: m.role === 'user' ? '80%' : '100%' }}>
              {m.role === 'user'
                ? <div style={{ background: C.ink, color: '#fff', padding: '9px 13px', borderRadius: 12, fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                : (
                  <div style={{ background: '#fffdf9', padding: '12px 16px', borderRadius: 12, fontSize: 14, lineHeight: 1.6, border: `1px solid ${C.line}` }}>
                    <Markdown text={m.content} onCite={(n) => openCite(m, n)} />
                    {m.citations && m.citations.length ? (
                      <div style={{ fontSize: 12, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.line}`, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                        {m.citations.map((c) => <a key={c.n} style={{ color: C.gold, cursor: 'pointer' }} onClick={() => openCite(m, c.n)}>[{c.n}] {c.label || c.document_name}</a>)}
                      </div>
                    ) : null}
                  </div>
                )}
              <div style={{ fontSize: 11, color: C.lo, marginTop: 3, textAlign: m.role === 'user' ? 'right' : 'left' }}>{fmtDate(m.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditLog({ room, members }) {
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
        <div style={{ ...S.cardHead, margin: 0, flex: 1 }}>Registro completo de la sala</div>
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
