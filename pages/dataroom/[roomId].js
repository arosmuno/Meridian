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
import TeamsTab from '../../components/dataroom/TeamsTab';
import Viewer from '../../components/dataroom/Viewer';

const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Miembro', viewer: 'Solo lectura' };

export default function Room() {
  const router = useRouter();
  const { roomId } = router.query;
  const [session, setSession] = useState(null);
  const [room, setRoom] = useState(null);
  const [role, setRole] = useState(null);
  const [access, setAccess] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [members, setMembers] = useState([]);
  const [folders, setFolders] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  // Indice, chat y Q&A trabajan con la version vigente; el historial sale de allDocs.
  const docs = allDocs.filter((d) => !d.superseded_by);
  const [ndaOk, setNdaOk] = useState(true);
  const [tab, setTab] = useState('docs');
  const [viewer, setViewer] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [flash, setFlash] = useState('');
  const [chat, setChat] = useState(emptyChat); // vive aqui para que cambiar de pestana no lo borre

  const isAdmin = role === 'owner' || role === 'admin';
  // Todos los equipos pueden subir y preguntar; una operacion terminada es de solo lectura.
  const closed = !!room && room.status === 'closed';
  const canWrite = !!role && role !== 'viewer' && !closed;
  const myTeam = (access && access.group_id) || null;
  const canDownload = !!room && (room.allow_download || isAdmin);

  useEffect(() => { if (roomId) load(); /* eslint-disable-next-line */ }, [roomId]);

  async function load() {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) { router.replace('/dataroom'); return; }
    setSession(s);
    const { data: r } = await dr().from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (!r) { setLoadErr('Esta sala no existe o no tienes acceso.'); return; }
    setRoom(r);
    dr().from('orgs').select('name').eq('id', r.org_id).maybeSingle().then(({ data: o }) => setOrgName((o && o.name) || ''));
    const { data: acc } = await supabase.rpc('dataroom_my_room_access', { p_room: r.id });
    const a = (acc && acc[0]) || null;
    setAccess(a);
    const myRole = a ? a.role : null;
    setRole(myRole);
    if (a && !a.open) return; // sala cerrada o acceso caducado: no se carga contenido
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
    setAllDocs(d || []);
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

  if (access && !access.open) {
    return (
      <div style={S.page}>
        <Head><title>{room.name} — Meridian Dataroom</title></Head>
        {header}
        <div style={{ maxWidth: 560, margin: '60px auto', ...S.card }}>
          <div style={S.kind}>SIN ACCESO</div>
          <h1 style={{ ...S.title, fontSize: 26, margin: '6px 0 12px' }}>{room.name}</h1>
          <p style={{ fontSize: 14, color: C.mid, lineHeight: 1.6 }}>Tu acceso a esta sala ha terminado. Si lo necesitas, habla con quien organiza la operación.</p>
          <Link href="/dataroom" style={S.ghost}>← Volver a tus salas</Link>
        </div>
      </div>
    );
  }

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
  if (isAdmin) tabs.push(['teams', 'Equipos'], ['settings', 'Ajustes']);
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
            <span style={{ ...S.tag, color: C.gold, borderColor: C.gold }}>{access && access.group_name ? access.group_name : orgName || 'Organizador'}</span>
            {closed && <span style={{ ...S.tag, color: C.red, borderColor: C.red }}>Solo lectura</span>}
            {room.watermark && <span style={S.tag}>Marca de agua</span>}
            {!room.allow_download && <span style={S.tag}>Solo consulta</span>}
            {room.nda_required && <span style={S.tag}>NDA</span>}
          </div>
        </div>
        {closed && (
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 10, background: '#fbf3e2', border: '1px solid #efdcb4', fontSize: 13, color: C.ink }}>
            <b>Operación terminada{room.closed_at ? ` el ${new Date(room.closed_at).toLocaleDateString('es-ES')}` : ''}.</b> La sala es de solo lectura
            {room.purge_at ? <> y <b>se eliminará el {new Date(room.purge_at).toLocaleDateString('es-ES')}</b>, con todos sus documentos. Descarga antes lo que necesites conservar.</> : '.'}
          </div>
        )}
        <nav style={S.tabs}>
          {tabs.map(([k, l]) => <button key={k} style={tab === k ? S.tabOn : S.tab} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
        {flash && <div style={S.err} onClick={() => setFlash('')}>{flash}</div>}

        {tab === 'docs' && <DocsTab room={room} canWrite={canWrite} isAdmin={isAdmin} userId={session && session.user.id} canDownload={canDownload} members={members} folders={folders} docs={docs} allDocs={allDocs} reload={refresh} openViewer={openViewer} onDownload={download} goReview={(d) => { setSelectedModel(d.id); setTab('models'); }} />}
        {tab === 'chat' && <ChatTab room={room} docs={docs} openViewer={openViewer} userId={session.user.id} chat={chat} setChat={setChat} />}
        {tab === 'qa' && <QaTab room={room} canWrite={canWrite} isAdmin={isAdmin} myTeam={myTeam} orgName={orgName} members={members} docs={docs} openViewer={openViewer} />}
        {tab === 'models' && <ModelsTab room={room} canWrite={canWrite} docs={docs} selected={selectedModel} setSelected={setSelectedModel} reload={refresh} />}
        {tab === 'activity' && <ActivityTab room={room} members={members} isAdmin={isAdmin} docs={docs} openViewer={openViewer} />}
        {tab === 'teams' && isAdmin && <TeamsTab room={room} orgName={orgName} members={members} docs={docs} reloadMembers={load} />}
        {tab === 'settings' && isAdmin && <SettingsTab room={room} onSaved={reloadRoom} folders={folders} docs={docs} allDocs={allDocs} members={members} />}
      </div>
      {viewer && <Viewer doc={viewer.doc} startPage={viewer.page} canDownload={canDownload} onDownload={download} onClose={() => setViewer(null)} />}
    </div>
  );
}
