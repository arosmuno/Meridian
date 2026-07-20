// Meridian Dataroom — sala: subir documentos + chat de due diligence con citas.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabase';

const dr = () => supabase.schema('dataroom');

export default function Room() {
  const router = useRouter();
  const { roomId } = router.query;
  const [room, setRoom] = useState(null);
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  useEffect(() => { if (roomId) load(); /* eslint-disable-next-line */ }, [roomId]);

  async function load() {
    const { data: r } = await dr().from('rooms').select('*').eq('id', roomId).single();
    setRoom(r);
    refreshDocs();
  }
  async function refreshDocs() {
    const { data } = await dr().from('documents').select('*').eq('room_id', roomId).order('created_at', { ascending: false });
    setDocs(data || []);
  }

  async function onUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const path = `${room.org_id}/${roomId}/${crypto.randomUUID()}/${file.name}`;
      const { error: upErr } = await supabase.storage.from('datarooms').upload(path, file);
      if (upErr) throw upErr;
      const { data: doc, error } = await dr().from('documents').insert({
        room_id: roomId, org_id: room.org_id, name: file.name, storage_path: path,
        mime: file.type, size_bytes: file.size, created_by: session.user.id,
      }).select().single();
      if (error) throw error;
      await refreshDocs();
      await fetch('/api/dataroom/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: doc.id, access_token: session.access_token }),
      });
      await refreshDocs();
    } catch (err) {
      alert('Error subiendo: ' + (err.message || err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function ask(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch('/api/dataroom/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, session_id: sessionId, message: q, access_token: session.access_token }),
      });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error);
      setSessionId(out.session_id);
      setMessages(m => [...m, { role: 'assistant', content: out.answer, citations: out.citations }]);
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: 'Error: ' + (err.message || err) }]);
    } finally {
      setBusy(false);
    }
  }

  if (!room) return <div style={wrap}>Cargando…</div>;

  return (
    <div style={wrap}>
      <Head><title>{room.name} — Meridian Dataroom</title></Head>
      <a href="/dataroom" style={{ color: '#667', textDecoration: 'none' }}>← Salas</a>
      <h1 style={{ marginTop: 8, fontFamily: 'Georgia, serif' }}>{room.name}</h1>
      <span style={{ color: '#889', fontSize: 13 }}>{room.kind === 'mna' ? 'Proceso M&A' : 'Archivo interno'}</span>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginTop: 16 }}>
        <section style={card}>
          <h3>Documentos</h3>
          <input ref={fileRef} type="file" onChange={onUpload} disabled={uploading} accept=".pdf,.docx,.txt,.md" style={{ marginBottom: 12 }} />
          {uploading && <p style={{ color: '#667' }}>Subiendo e indexando…</p>}
          <div style={{ display: 'grid', gap: 6 }}>
            {docs.map(d => (
              <div key={d.id} style={docRow}>
                <span>{d.name}</span>
                <span style={{ fontSize: 12, color: statusColor(d.status) }}>{d.status}</span>
              </div>
            ))}
            {!docs.length && <p style={{ color: '#889' }}>Sube contratos, cuentas, informes…</p>}
          </div>
        </section>

        <section style={{ ...card, display: 'flex', flexDirection: 'column', minHeight: 420 }}>
          <h3>Chat de due diligence</h3>
          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gap: 10, padding: '8px 0' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ justifySelf: m.role === 'user' ? 'end' : 'start', maxWidth: '85%' }}>
                <div style={m.role === 'user' ? bubbleUser : bubbleAI}>{m.content}</div>
                {m.citations && m.citations.length ? (
                  <div style={{ fontSize: 11, color: '#889', marginTop: 4 }}>
                    Fuentes: {m.citations.map(c => `[${c.n}] ${c.document_name}`).join('  ')}
                  </div>
                ) : null}
              </div>
            ))}
            {busy && <div style={bubbleAI}>Analizando documentos…</div>}
          </div>
          <form onSubmit={ask} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input style={inputStyle} placeholder="¿Cuál es el EBITDA? ¿Hay cláusulas de cambio de control?" value={input} onChange={e => setInput(e.target.value)} />
            <button style={btn} disabled={busy}>Enviar</button>
          </form>
        </section>
      </div>
    </div>
  );
}

function statusColor(s) { return s === 'ready' ? '#16a34a' : s === 'error' ? '#dc2626' : '#ca8a04'; }
const wrap = { maxWidth: 1000, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, sans-serif' };
const card = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 };
const docRow = { display: 'flex', justifyContent: 'space-between', padding: 8, background: '#f9fafb', borderRadius: 6, fontSize: 14 };
const inputStyle = { flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 };
const btn = { padding: '10px 16px', background: '#111827', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer' };
const bubbleUser = { background: '#111827', color: '#fff', padding: '8px 12px', borderRadius: 12, fontSize: 14 };
const bubbleAI = { background: '#f3f4f6', color: '#111', padding: '8px 12px', borderRadius: 12, fontSize: 14, whiteSpace: 'pre-wrap' };
