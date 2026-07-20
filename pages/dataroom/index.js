// Meridian Dataroom — portada: login + organizaciones + salas.
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

const dr = () => supabase.schema('dataroom');

export default function DataroomHome() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [orgName, setOrgName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomKind, setRoomKind] = useState('mna');
  const [activeOrg, setActiveOrg] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) loadOrgs(); }, [session]);
  useEffect(() => { if (activeOrg) loadRooms(activeOrg); }, [activeOrg]);

  async function loadOrgs() {
    const { data } = await dr().from('orgs').select('*').order('created_at');
    setOrgs(data || []);
    if (data && data.length && !activeOrg) setActiveOrg(data[0].id);
  }
  async function loadRooms(orgId) {
    const { data } = await dr().from('rooms').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
    setRooms(data || []);
  }
  async function login(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    setMsg(error ? error.message : 'Revisa tu email para el enlace de acceso.');
  }
  async function createOrg(e) {
    e.preventDefault();
    const { data: org, error } = await supabase.rpc('dataroom_create_org', { p_name: orgName });
    if (error) return setMsg(error.message);
    setOrgName(''); setActiveOrg(org.id); loadOrgs();
  }
  async function createRoom(e) {
    e.preventDefault();
    const { error } = await dr().from('rooms').insert({ org_id: activeOrg, name: roomName, kind: roomKind, created_by: session.user.id });
    if (error) return setMsg(error.message);
    setRoomName(''); loadRooms(activeOrg);
  }

  if (!session) {
    return (
      <div style={wrap}>
        <Head><title>Meridian Dataroom</title></Head>
        <h1 style={{ fontFamily: 'Georgia, serif' }}>Meridian Dataroom</h1>
        <p style={{ color: '#667' }}>Due diligence con IA. Accede con tu email.</p>
        <form onSubmit={login} style={{ display: 'flex', gap: 8 }}>
          <input style={input} type="email" placeholder="tu@empresa.com" value={email} onChange={e => setEmail(e.target.value)} required />
          <button style={btn}>Entrar</button>
        </form>
        {msg && <p style={{ color: '#667' }}>{msg}</p>}
      </div>
    );
  }

  return (
    <div style={wrap}>
      <Head><title>Meridian Dataroom</title></Head>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'Georgia, serif' }}>Meridian Dataroom</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/" style={ghost}>← Meridian</a>
          <button style={ghost} onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </div>

      <section style={card}>
        <h3>Organizaciones</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {orgs.map(o => (
            <button key={o.id} style={o.id === activeOrg ? chipActive : chip} onClick={() => setActiveOrg(o.id)}>{o.name}</button>
          ))}
        </div>
        <form onSubmit={createOrg} style={{ display: 'flex', gap: 8 }}>
          <input style={input} placeholder="Nueva organización (empresa cliente)" value={orgName} onChange={e => setOrgName(e.target.value)} required />
          <button style={btn}>Crear</button>
        </form>
      </section>

      {activeOrg && (
        <section style={card}>
          <h3>Salas de datos</h3>
          <form onSubmit={createRoom} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input style={input} placeholder="Nombre de la sala" value={roomName} onChange={e => setRoomName(e.target.value)} required />
            <select style={input} value={roomKind} onChange={e => setRoomKind(e.target.value)}>
              <option value="mna">M&A</option>
              <option value="archive">Archivo interno</option>
            </select>
            <button style={btn}>Crear sala</button>
          </form>
          <div style={{ display: 'grid', gap: 8 }}>
            {rooms.map(r => (
              <Link key={r.id} href={`/dataroom/${r.id}`} style={roomRow}>
                <span><strong>{r.name}</strong> <span style={{ color: '#889', fontSize: 12 }}>· {r.kind === 'mna' ? 'M&A' : 'Archivo'}</span></span>
                <span style={{ color: '#889' }}>→</span>
              </Link>
            ))}
            {!rooms.length && <p style={{ color: '#889' }}>Aún no hay salas.</p>}
          </div>
        </section>
      )}
      {msg && <p style={{ color: '#a33' }}>{msg}</p>}
    </div>
  );
}

const wrap = { maxWidth: 760, margin: '0 auto', padding: '32px 20px', fontFamily: 'system-ui, sans-serif' };
const card = { border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginTop: 16 };
const input = { padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, flex: 1, fontSize: 14 };
const btn = { padding: '10px 16px', background: '#111827', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer' };
const ghost = { padding: '6px 12px', background: 'transparent', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', textDecoration: 'none', color: '#111' };
const chip = { padding: '6px 12px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 999, cursor: 'pointer' };
const chipActive = { padding: '6px 12px', background: '#111827', color: '#fff', border: '1px solid #111827', borderRadius: 999, cursor: 'pointer' };
const roomRow = { display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid #e5e7eb', borderRadius: 8, textDecoration: 'none', color: '#111' };
