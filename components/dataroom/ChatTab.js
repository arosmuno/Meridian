// Pestana Chat: analista de due diligence sobre los documentos de la sala.
// Las conversaciones se guardan por usuario (lista a la izquierda) y el estado vive en la
// pagina de la sala, asi que cambiar de pestana no borra nada, ni siquiera una respuesta en curso.
import { useEffect, useRef, useState } from 'react';
import { api, dr, fmtDate } from './api';
import { S, C } from './styles';
import Markdown from './Markdown';

export const emptyChat = { sessionId: null, messages: [], busy: false, loaded: false };

const SUGGESTIONS = [
  'Resume la operación: partes, perímetro, precio y estructura.',
  '¿Cuál es la evolución de ingresos, EBITDA y márgenes en el modelo?',
  '¿Qué deuda hay, con qué condiciones y covenants?',
  '¿Hay cláusulas de cambio de control o de exclusividad?',
  '¿Qué riesgos o banderas rojas ves en la documentación?',
];

export default function ChatTab({ room, docs, openViewer, userId, chat, setChat }) {
  const [sessions, setSessions] = useState([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef();
  const ready = docs.filter((d) => d.status === 'ready').length;

  useEffect(() => { loadSessions(true); /* eslint-disable-next-line */ }, [room.id]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chat.messages.length, chat.busy]);

  async function loadSessions(openLatest) {
    const { data } = await dr().from('chat_sessions').select('id, title, created_at, updated_at').eq('room_id', room.id).eq('user_id', userId).order('updated_at', { ascending: false }).limit(100);
    setSessions(data || []);
    if (openLatest && !chat.loaded && !chat.busy && data && data.length) openSession(data[0].id);
    else if (openLatest && !chat.loaded) setChat((c) => ({ ...c, loaded: true }));
  }

  async function openSession(id) {
    if (chat.busy) return;
    const { data } = await dr().from('messages').select('id, role, content, citations, created_at').eq('session_id', id).order('created_at');
    setChat({ sessionId: id, messages: data || [], busy: false, loaded: true });
  }

  function newChat() {
    if (chat.busy) return;
    setChat({ ...emptyChat, loaded: true });
  }

  async function ask(text) {
    const q = String(text || '').trim();
    if (!q || chat.busy) return;
    setInput('');
    const sid = chat.sessionId;
    setChat((c) => ({ ...c, busy: true, messages: [...c.messages, { role: 'user', content: q, created_at: new Date().toISOString() }] }));
    try {
      const out = await api('/api/dataroom/chat', { room_id: room.id, session_id: sid, message: q });
      setChat((c) => ({
        ...c, sessionId: out.session_id, busy: false,
        messages: [...c.messages, { role: 'assistant', content: out.answer, citations: out.citations, created_at: new Date().toISOString() }],
      }));
      loadSessions(false);
    } catch (err) {
      setChat((c) => ({ ...c, busy: false, messages: [...c.messages, { role: 'assistant', content: 'Error: ' + err.message }] }));
    }
  }

  const openCite = (m, n) => {
    const c = (m.citations || []).find((x) => x.n === n);
    if (!c) return;
    const d = docs.find((x) => x.id === c.document_id);
    if (d) openViewer(d, c.page || 1);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 18, alignItems: 'start' }}>
      <aside style={{ ...S.card, padding: 12, display: 'grid', gap: 6, maxHeight: 680, overflowY: 'auto' }}>
        <button style={{ ...S.btn, width: '100%' }} onClick={newChat} disabled={chat.busy}>+ Nueva conversación</button>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: C.lo, margin: '8px 2px 2px' }}>MIS CONVERSACIONES</div>
        {!sessions.length && <div style={S.empty}>Aún no has preguntado nada en esta sala.</div>}
        {sessions.map((s) => (
          <button key={s.id} onClick={() => openSession(s.id)} style={{
            textAlign: 'left', border: 0, borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
            background: chat.sessionId === s.id ? C.paper : 'transparent', color: C.ink,
          }}>
            <div style={{ fontSize: 13, fontWeight: chat.sessionId === s.id ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || 'Conversación'}</div>
            <div style={{ fontSize: 11, color: C.lo }}>{fmtDate(s.updated_at || s.created_at)}</div>
          </button>
        ))}
      </aside>

      <section style={{ ...S.card, display: 'flex', flexDirection: 'column', minHeight: 600 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={S.cardHead}>Analista de due diligence</div>
          <div style={{ fontSize: 12, color: C.mid }}>{ready} documento(s) indexado(s) · tus preguntas quedan registradas en Actividad</div>
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 14, padding: '8px 2px', alignContent: 'start', maxHeight: 620 }}>
          {!chat.messages.length && (
            <div style={{ color: C.mid, fontSize: 13, lineHeight: 1.6 }}>
              Pregunta en español o en inglés. El analista busca en todos los documentos a los que tienes acceso, hace los cálculos y cita documento y página.
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {SUGGESTIONS.map((s) => <button key={s} style={{ ...S.btnGhost, fontSize: 12 }} onClick={() => ask(s)} disabled={chat.busy || !ready}>{s}</button>)}
              </div>
            </div>
          )}
          {chat.messages.map((m, i) => (
            <div key={m.id || i} style={{ justifySelf: m.role === 'user' ? 'end' : 'stretch', maxWidth: m.role === 'user' ? '80%' : '100%' }}>
              {m.role === 'user'
                ? <div style={bubbleU}>{m.content}</div>
                : (
                  <div style={bubbleA}>
                    <Markdown text={m.content} onCite={(n) => openCite(m, n)} />
                    {m.citations && m.citations.length ? (
                      <div style={{ fontSize: 12, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.line}`, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                        <span style={{ color: C.lo }}>Fuentes:</span>
                        {m.citations.map((c) => <a key={c.n} style={{ color: C.gold, cursor: 'pointer' }} onClick={() => openCite(m, c.n)}>[{c.n}] {c.label || c.document_name}</a>)}
                      </div>
                    ) : null}
                  </div>
                )}
            </div>
          ))}
          {chat.busy && <div style={{ ...bubbleA, color: C.mid }}>Analizando los documentos… (puedes cambiar de pestaña; la respuesta se guarda igual)</div>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <textarea
            style={{ ...S.input, flex: 1, resize: 'vertical', minHeight: 44, maxHeight: 200 }}
            placeholder={ready ? 'Escribe tu pregunta… (Enter para enviar, Mayús+Enter para salto de línea)' : 'Sube e indexa algún documento para poder preguntar'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
          />
          <button style={S.btn} disabled={chat.busy || !input.trim()}>Enviar</button>
        </form>
      </section>
    </div>
  );
}
const bubbleU = { background: C.ink, color: '#fff', padding: '9px 13px', borderRadius: 12, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' };
const bubbleA = { background: '#fffdf9', color: C.ink, padding: '12px 16px', borderRadius: 12, fontSize: 14, lineHeight: 1.6, border: `1px solid ${C.line}` };
