// Meridian Dataroom -- sala: documentos con indice, chat, Q&A, revision de modelos,
// actividad y ajustes. El acceso a ficheros pasa siempre por /api/dataroom/* (permisos de
// carpeta, NDA, solo lectura y marca de agua se aplican en el servidor, no aqui).
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { api, dr } from '../../components/dataroom/api';
import { S, C } from '../../components/dataroom/styles';
import DocsTab from '../../components/dataroom/DocsTab';
import ChatTab, { emptyChat } from '../../components/dataroom/ChatTab';
import QaTab from '../../components/dataroom/QaTab';
import ModelsTab from '../../components/dataroom/ModelsTab';
import ActivityTab from '../../components/dataroom/ActivityTab';
import SettingsTab from '../../components/dataroom/SettingsTab';
import Viewer from '../../components/dataroom/Viewer';

const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Miembro', viewer: 'Solo lectura' };

export default function Room() {
  const router = useRouter();
  const { roomId } = router.query;
  const [session, setSession] = useState(null);
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState(null);
  const [members, setMembers] = useState([]);
  const [folders, setFolders] = useState([]);
  const [docs, setDocs] = useState([]);
  const [ndaOk, setNdaOk] = useState(true);
  const [tab, setTab] = useState('docs');
  const [viewer, setViewer] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [flash, setFlash] = useState('');
  const [chat, setChat] = useState(emptyChat); // vive aqui para que cambiar de pestana no lo borre

  const isAdmin = role === 'owner' || role === 'admin';
  const canWrite = !!role && role !== 'viewer';
  const canDownload = !!room && (room.allow_download || isAdmin);

  useEffect(() => { if (roomId) load(); /* eslint-disable-next-line */ }, [roomId]);

  async function load() {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) { router.replace('/dataroom'); return; }
    setSession(s);
    const { data: r } = await dr().from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (!r) { setLoadErr('Esta sala no existe o no tienes acceso.'); return; }
    setRoom(r);
    const { data: m } = await dr().from('memberships').select('role').eq('org_id', r.org_id).eq('user_id', s.user.id).maybeSingle();
    const myRole = m ? m.role : null;
    setRole(myRole);
    const { data: mem } = await supabase.rpc('dataroom_list_members', { p_org_id: r.org_id });
    setMembers(mem || []);
    if (r.nda_required && myRole !== 'owner' && myRole !== 'admin') {
      const { data: acc } = await dr().from('nda_acceptances').select('accepted_at').eq('room_id', r.id).eq('user_id', s.user.id).maybeSingle();
      setNdaOk(!!acc);
    } else setNdaOk(true);
    await refresh();
  }
  async function refresh() {
    const [{ data: f }, { data: d }] = await Promise.all([
      dr().from('folders').select('*').eq('room_id', roomId),
      dr().from('documents').select('*').eq('room_id', roomId),
    ]);
    setFolders(f || []);
    setDocs(d || []);
  }
  async function reloadRoom() {
    const { data: r } = await dr().from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (r) setRoom(r);
  }

  async function download(doc) {
    try {
      const out = await api('/api/dataroom/download', { document_id: doc.id });
      window.open(out.url, '_blank');
    } catch (e) { setFlash(e.message); }
  }
  async function acceptNda() {
    try { await api('/api/dataroom/nda', { room_id: room.id }); setNdaOk(true); } catch (e) { setFlash(e.message); }
  }

  if (loadErr) return <div style={S.page}><div style={{ padding: 40, color: C.lo }}>{loadErr} <Link href="/dataroom" style={{ color: C.gold }}>Volver a tus salas</Link></div></div>;
  if (!room) return <div style={S.page}><div style={{ padding: 40, color: C.lo }}>Cargando…</div></div>;

  const header = (
    <header style={S.top}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={S.brand}>MERIDIAN</span><span style={S.brandSub}>DATAROOM</span>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: C.mid }}>{session && session.user.email}</span>
        <Link href="/dataroom" style={S.ghost}>← Salas</Link>
      </div>
    </header>
  );

  if (!ndaOk) {
    return (
      <div style={S.page}>
        <Head><title>{room.name} — Confidencialidad</title></Head>
        {header}
        <div style={{ maxWidth: 640, margin: '60px auto', ...S.card }}>
          <div style={S.kind}>ACUERDO DE CONFIDENCIALIDAD</div>
          <h1 style={{ ...S.title, fontSize: 26, marginBottom: 14 }}>{room.name}</h1>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.7, color: C.ink, background: C.soft, padding: 16, borderRadius: 10 }}>{room.nda_text}</div>
          <p style={S.hint}>Tu aceptación queda registrada con tu email ({session && session.user.email}), la fecha y la hora.</p>
          {flash && <div style={S.err}>{flash}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button style={S.btn} onClick={acceptNda}>Acepto y quiero entrar</button>
            <Link href="/dataroom" style={S.ghost}>No acepto</Link>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [['docs', 'Documentos'], ['chat', 'Chat'], ['qa', 'Q&A'], ['models', 'Modelos'], ['activity', 'Actividad']];
  if (isAdmin) tabs.push(['settings', 'Ajustes']);
  const openViewer = (d, page) => setViewer({ doc: d, page: page || 1 });

  return (
    <div style={S.page}>
      <Head><title>{room.name} — Meridian Dataroom</title></Head>
      {header}
      <div style={S.wrap}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <span style={S.kind}>{room.kind === 'mna' ? 'PROCESO M&A' : 'ARCHIVO INTERNO'}</span>
            <h1 style={S.title}>{room.name}</h1>
            {room.description && <div style={{ fontSize: 14, color: C.mid, marginTop: 6, maxWidth: 760 }}>{room.description}</div>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={S.tag}>{ROLE[role] || role}</span>
            {room.watermark && <span style={S.tag}>Marca de agua</span>}
            {!room.allow_download && <span style={S.tag}>Solo consulta</span>}
            {room.nda_required && <span style={S.tag}>NDA</span>}
          </div>
        </div>
        <nav style={S.tabs}>
          {tabs.map(([k, l]) => <button key={k} style={tab === k ? S.tabOn : S.tab} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
        {flash && <div style={S.err} onClick={() => setFlash('')}>{flash}</div>}

        {tab === 'docs' && <DocsTab room={room} canWrite={canWrite} isAdmin={isAdmin} canDownload={canDownload} members={members} folders={folders} docs={docs} reload={refresh} openViewer={openViewer} onDownload={download} goReview={(d) => { setSelectedModel(d.id); setTab('models'); }} />}
        {tab === 'chat' && <ChatTab room={room} docs={docs} openViewer={openViewer} userId={session.user.id} chat={chat} setChat={setChat} />}
        {tab === 'qa' && <QaTab room={room} canWrite={canWrite} members={members} docs={docs} openViewer={openViewer} />}
        {tab === 'models' && <ModelsTab room={room} canWrite={canWrite} docs={docs} selected={selectedModel} setSelected={setSelectedModel} reload={refresh} />}
        {tab === 'activity' && <ActivityTab room={room} members={members} isAdmin={isAdmin} docs={docs} openViewer={openViewer} />}
        {tab === 'settings' && isAdmin && <SettingsTab room={room} onSaved={reloadRoom} />}
      </div>
      {viewer && <Viewer doc={viewer.doc} startPage={viewer.page} canDownload={canDownload} onDownload={download} onClose={() => setViewer(null)} />}
    </div>
  );
}
