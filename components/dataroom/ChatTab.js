// Pestana Chat: preguntas a los documentos con citas por documento y pagina (clic -> visor).
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { S, C } from './styles';

export default function ChatTab({ room, docs, openViewer }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef();
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy]);
  const ready = docs.filter((d) => d.status === 'ready').length;

  async function ask(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const out = await api('/api/dataroom/chat', { room_id: room.id, session_id: sessionId, message: q });
      setSessionId(out.session_id);
      setMessages((m) => [...m, { role: 'assistant', content: out.answer, citations: out.citations }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Error: ' + err.message }]);
    } finally { setBusy(false); }
  }
  const open = (c) => { const d = docs.find((x) => x.id === c.document_id); if (d) openViewer(d, c.page || 1); };

  return (
    <section style={{ ...S.card, display: 'flex', flexDirection: 'column', minHeight: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={S.cardHead}>Chat de due diligence</div>
        <div style={{ fontSize: 12, color: C.mid }}>{ready} documento(s) indexado(s){sessionId && <> · <a style={{ color: C.gold, cursor: 'pointer' }} onClick={() => { setMessages([]); setSessionId(null); }}>Nueva conversación</a></>}</div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 10, padding: '8px 2px', alignContent: 'start', maxHeight: 560 }}>
        {!messages.length && <div style={{ color: C.lo, fontSize: 13, lineHeight: 1.6 }}>Pregunta sobre los documentos en español o en inglés: «¿Hay cláusulas de cambio de control?», «¿Cuál es la deuda neta a cierre?», «¿Qué garantías da el vendedor?». Cada respuesta cita documento y página.</div>}
        {messages.map((m, i) => (
          <div key={i} style={{ justifySelf: m.role === 'user' ? 'end' : 'start', maxWidth: '88%' }}>
            <div style={m.role === 'user' ? bubbleU : bubbleA}>{m.content}</div>
            {m.citations && m.citations.length ? (
              <div style={{ fontSize: 12, color: C.gold, marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {m.citations.map((c) => <a key={c.n} style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => open(c)}>[{c.n}] {c.label || c.document_name}</a>)}
              </div>
            ) : null}
          </div>
        ))}
        {busy && <div style={bubbleA}>Buscando en los documentos…</div>}
      </div>
      <form onSubmit={ask} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input style={{ ...S.input, flex: 1 }} placeholder="Escribe tu pregunta de due diligence…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button style={S.btn} disabled={busy}>Enviar</button>
      </form>
    </section>
  );
}
const bubbleU = { background: C.ink, color: '#fff', padding: '9px 13px', borderRadius: 12, fontSize: 14, lineHeight: 1.5 };
const bubbleA = { background: C.paper, color: C.ink, padding: '9px 13px', borderRadius: 12, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6, border: `1px solid ${C.line}` };
