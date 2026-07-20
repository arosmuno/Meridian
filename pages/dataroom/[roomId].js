// Meridian Dataroom — sala: documentos (subida + descarga firmada) y chat de due diligence.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
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
  const scrollRef = useRef();

  useEffect(() => { if (roomId) load(); /* eslint-disable-next-line */ }, [roomId]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, busy]);

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

  async function download(doc) {
    const { data: { session } } = await supabase.auth.getSession();
    const r = await fetch('/api/dataroom/download', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: doc.id, access_token: session.access_token }),
    });
    const out = await r.json();
    if (out.url) window.open(out.url, '_blank');
    else alert(out.error || 'No se pudo generar la descarga.');
  }

  async function ask(e) {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: q }]);
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
      setMessages((m) => [...m, { role: 'assistant', content: out.answer, citations: out.citations }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', content: 'Error: ' + (err.message || err) }]);
    } finally {
      setBusy(false);
    }
  }

  if (!room) return <div style={S.page}><div style={{ padding: 40, color: '#a59d8f' }}>Cargando…</div></div>;

  return (
    <div style={S.page}>
      <Head><title>{room.name} — Meridian Dataroom</title></Head>
      <header style={S.top}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={S.brand}>MERIDIAN</span><span style={S.brandSub}>DATAROOM</span>
        </div>
        <Link href="/dataroom" style={S.ghost}>← Salas</Link>
      </header>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '24px 28px' }}>
        <div style={S.roomHead}>
          <span style={S.kind}>{room.kind === 'mna' ? 'PROCESO M&A' : 'ARCHIVO INTERNO'}</span>
          <h1 style={S.title}>{room.name}</h1>
        </div>

        <div style={S.grid}>
          <section style={S.card}>
            <div style={S.cardHead}>Documentos</div>
            <label style={S.upload}>
              {uploading ? 'Subiendo e indexando…' : '+ Subir documento (PDF, DOCX, TXT)'}
              <input ref={fileRef} type="file" onChange={onUpload} disabled={uploading} accept=".pdf,.docx,.txt,.md" style={{ display: 'none' }} />
            </label>
            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              {docs.map((d) => (
                <div key={d.id} style={S.docRow}>
                  <div style={{ minWidth: 0 }}>
                    <div style={S.docName}>{d.name}</div>
                    <div style={{ ...S.docStatus, color: statusColor(d.status) }}>{statusLabel(d.status)}</div>
                  </div>
                  <button style={S.dl} onClick={() => download(d)} title="Descargar (enlace firmado)">↓</button>
                </div>
              ))}
              {!docs.length && <div style={S.empty}>Sube contratos, cuentas, informes… y pregúntale al chat.</div>}
            </div>
          </section>

          <section style={{ ...S.card, display: 'flex', flexDirection: 'column', minHeight: 520 }}>
            <div style={S.cardHead}>Chat de due diligence</div>
            <div ref={scrollRef} style={S.chat}>
              {!messages.length && <div style={S.chatHint}>Pregunta sobre los documentos. Ej.: «¿Cuál es el EBITDA?», «¿Hay cláusulas de cambio de control?». Responde citando las fuentes.</div>}
              {messages.map((m, i) => (
                <div key={i} style={{ justifySelf: m.role === 'user' ? 'end' : 'start', maxWidth: '88%' }}>
                  <div style={m.role === 'user' ? S.bubbleU : S.bubbleA}>{m.content}</div>
                  {m.citations && m.citations.length ? (
                    <div style={S.cites}>Fuentes: {m.citations.map((c) => `[${c.n}] ${c.document_name}`).join('  ')}</div>
                  ) : null}
                </div>
              ))}
              {busy && <div style={S.bubbleA}>Analizando documentos…</div>}
            </div>
            <form onSubmit={ask} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input style={S.input} placeholder="Escribe tu pregunta de due diligence…" value={input} onChange={(e) => setInput(e.target.value)} />
              <button style={S.btn} disabled={busy}>Enviar</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function statusColor(s) { return s === 'ready' ? '#1a7a3a' : s === 'error' ? '#a3341f' : '#9a7d1e'; }
function statusLabel(s) { return s === 'ready' ? 'Indexado' : s === 'error' ? 'Error' : s === 'processing' ? 'Procesando…' : 'Subido'; }

const serif = "Georgia, 'Times New Roman', serif";
const ui = "ui-sans-serif, system-ui, -apple-system, sans-serif";
const S = {
  page: { minHeight: '100vh', background: '#f3f0e8', color: '#1c1916', fontFamily: ui },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', borderBottom: '1px solid #e2ddd0', background: '#fffdf9' },
  brand: { fontFamily: serif, fontSize: 20, fontWeight: 700 },
  brandSub: { fontSize: 11, letterSpacing: '.3em', color: '#9a7d1e', fontWeight: 700 },
  ghost: { padding: '6px 12px', border: '1px solid #d8d2c4', borderRadius: 8, textDecoration: 'none', color: '#1c1916', fontSize: 13 },
  roomHead: { marginBottom: 18 },
  kind: { fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#9a7d1e' },
  title: { fontFamily: serif, fontSize: 32, fontWeight: 700, margin: '4px 0 0' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 18, alignItems: 'start' },
  card: { background: '#fff', border: '1px solid #e2ddd0', borderRadius: 12, padding: 18 },
  cardHead: { fontFamily: serif, fontSize: 17, fontWeight: 700, marginBottom: 12 },
  upload: { display: 'block', textAlign: 'center', padding: '14px', border: '1px dashed #cfc7b6', borderRadius: 10, cursor: 'pointer', color: '#736c61', fontSize: 13, background: '#faf8f3' },
  docRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#faf8f3', borderRadius: 8 },
  docName: { fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  docStatus: { fontSize: 11, marginTop: 2, fontWeight: 600 },
  dl: { flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: '1px solid #d8d2c4', background: '#fff', cursor: 'pointer', fontSize: 15 },
  empty: { color: '#a59d8f', fontSize: 13, padding: '8px 2px' },
  chat: { flex: 1, overflowY: 'auto', display: 'grid', gap: 10, padding: '8px 2px', alignContent: 'start' },
  chatHint: { color: '#a59d8f', fontSize: 13, lineHeight: 1.6 },
  bubbleU: { background: '#1c1916', color: '#fff', padding: '9px 13px', borderRadius: 12, fontSize: 14, lineHeight: 1.5 },
  bubbleA: { background: '#f3f0e8', color: '#1c1916', padding: '9px 13px', borderRadius: 12, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6, border: '1px solid #e2ddd0' },
  cites: { fontSize: 11, color: '#9a7d1e', marginTop: 4 },
  input: { flex: 1, padding: '11px 13px', border: '1px solid #d8d2c4', borderRadius: 9, fontSize: 14, background: '#fff', outline: 'none', fontFamily: ui },
  btn: { padding: '11px 18px', background: '#1c1916', color: '#fff', border: 0, borderRadius: 9, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};
