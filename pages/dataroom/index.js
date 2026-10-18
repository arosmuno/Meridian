// Meridian Dataroom — portada. Login, organizaciones, equipos (invitaciones) y plan.
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

const dr = () => supabase.schema('dataroom');
const PLAN_LIMITS = {
  free: { name: 'Free', rooms: 1, seats: 2, docs: 20 },
  pro: { name: 'Pro', rooms: 10, seats: 10, docs: 500 },
  enterprise: { name: 'Enterprise', rooms: '∞', seats: '∞', docs: '∞' },
};

export default function DataroomHome() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [orgs, setOrgs] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [orgName, setOrgName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomKind, setRoomKind] = useState('mna');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [activeOrg, setActiveOrg] = useState(null);
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session) { supabase.rpc('dataroom_accept_invites').then(() => loadOrgs()); }
  }, [session]);
  useEffect(() => { if (activeOrg) { loadRooms(activeOrg); loadTeam(activeOrg); } }, [activeOrg]);

  async function loadOrgs() {
    const { data } = await dr().from('orgs').select('*').order('created_at');
    setOrgs(data || []);
    setActiveOrg((cur) => cur || (data && data.length ? data[0].id : null));
  }
  async function loadRooms(orgId) {
    const { data } = await dr().from('rooms').select('*').eq('org_id', orgId).order('created_at', { ascending: false });
    setRooms(data || []);
  }
  async function loadTeam(orgId) {
    const { data: m } = await supabase.rpc('dataroom_list_members', { p_org_id: orgId });
    setMembers(m || []);
    const { data: iv } = await dr().from('invitations').select('*').eq('org_id', orgId).eq('status', 'pending');
    setInvites(iv || []);
  }
  async function login(e) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    if (error) return setMsg(error.message);
    setSent(true);
  }
  async function createOrg(e) {
    e.preventDefault();
    const { data: org, error } = await supabase.rpc('dataroom_create_org', { p_name: orgName });
    if (error) return setMsg(error.message);
    setOrgName(''); setMsg(''); setActiveOrg(org.id); loadOrgs();
  }
  async function createRoom(e) {
    e.preventDefault();
    const { error } = await dr().from('rooms').insert({ org_id: activeOrg, name: roomName, kind: roomKind, created_by: session.user.id });
    if (error) return setMsg(error.message);
    setRoomName(''); setMsg(''); loadRooms(activeOrg);
  }
  async function invite(e) {
    e.preventDefault();
    const { error } = await supabase.rpc('dataroom_invite_member', { p_org_id: activeOrg, p_email: inviteEmail, p_role: inviteRole });
    if (error) return setMsg(error.message);
    setInviteEmail(''); setMsg('Invitación registrada. Accederá al iniciar sesión con ese email.'); loadTeam(activeOrg);
  }

  const org = orgs.find((o) => o.id === activeOrg);
  const lim = org ? PLAN_LIMITS[org.plan] || PLAN_LIMITS.free : PLAN_LIMITS.free;
  const seatsUsed = members.length + invites.length;

  // ---- LOGIN ----
  if (!session) {
    return (
      <div style={S.page}>
        <Head><title>Meridian Dataroom — Acceso</title></Head>
        <div style={S.authWrap}>
          <div style={S.kicker}>MERIDIAN</div>
          <h1 style={S.authTitle}>Dataroom</h1>
          <p style={S.authSub}>Inteligencia de due diligence con IA. Sube documentos y pregunta; responde citando las fuentes.</p>
          {sent ? (
            <div style={S.notice}>Te enviamos un enlace de acceso a <b>{email}</b>. Ábrelo para entrar.</div>
          ) : (
            <form onSubmit={login} style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <input style={S.input} type="email" placeholder="tu@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <button style={S.btn}>Enviar enlace</button>
            </form>
          )}
          {msg && <p style={S.err}>{msg}</p>}
          <div style={{ marginTop: 28 }}><Link href="/" style={S.backLink}>← Volver a Meridian</Link></div>
        </div>
      </div>
    );
  }

  // ---- APP ----
  return (
    <div style={S.page}>
      <Head><title>Meridian Dataroom</title></Head>
      <header style={S.top}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={S.brand}>MERIDIAN</span>
          <span style={S.brandSub}>DATAROOM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={S.userEmail}>{session.user.email}</span>
          <Link href="/" style={S.ghost}>← Meridian</Link>
          <button style={S.ghost} onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>

      <div style={S.body}>
        {/* Sidebar de organizaciones */}
        <aside style={S.side}>
          <div style={S.sideLabel}>ORGANIZACIONES</div>
          <div style={{ display: 'grid', gap: 4 }}>
            {orgs.map((o) => (
              <button key={o.id} onClick={() => setActiveOrg(o.id)} style={o.id === activeOrg ? S.orgItemActive : S.orgItem}>
                {o.name}
                <span style={S.orgPlan}>{(PLAN_LIMITS[o.plan] || PLAN_LIMITS.free).name}</span>
              </button>
            ))}
          </div>
          <form onSubmit={createOrg} style={{ marginTop: 12 }}>
            <input style={{ ...S.input, width: '100%', marginBottom: 6 }} placeholder="Nueva organización" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
            <button style={{ ...S.btnGhost, width: '100%' }}>+ Crear organización</button>
          </form>
        </aside>

        {/* Panel principal */}
        <main style={S.main}>
          {!org ? (
            <div style={S.emptyBig}>Crea tu primera organización para empezar.</div>
          ) : (
            <>
              <div style={S.orgHeader}>
                <div>
                  <h2 style={S.orgTitle}>{org.name}</h2>
                  <div style={S.usage}>
                    Plan <b style={{ color: '#9a7d1e' }}>{lim.name}</b> · Salas {rooms.length}/{lim.rooms} · Asientos {seatsUsed}/{lim.seats}
                    {' · '}<Link href="/dataroom/precios" style={S.link}>Ver planes</Link>
                  </div>
                </div>
              </div>

              {/* Equipo */}
              <section style={S.card}>
                <div style={S.cardHead}>Equipo</div>
                <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                  {members.map((m) => (
                    <div key={m.user_id} style={S.memberRow}>
                      <span>{m.email}</span>
                      <span style={S.roleTag}>{m.role}</span>
                    </div>
                  ))}
                  {invites.map((iv) => (
                    <div key={iv.id} style={S.memberRow}>
                      <span style={{ color: '#a59d8f' }}>{iv.email}</span>
                      <span style={{ ...S.roleTag, background: '#fff7e6', color: '#9a7d1e', borderColor: '#f0e2bf' }}>invitación pendiente</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={invite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input style={{ ...S.input, flex: 1, minWidth: 200 }} type="email" placeholder="Invitar por email…" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                  <select style={S.input} value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                    <option value="admin">Admin</option>
                    <option value="member">Miembro</option>
                    <option value="viewer">Solo lectura</option>
                  </select>
                  <button style={S.btn}>Invitar</button>
                </form>
                <p style={S.hint}>La persona recibe acceso automáticamente al iniciar sesión con ese email.</p>
              </section>

              {/* Salas */}
              <section style={S.card}>
                <div style={S.cardHead}>Salas de datos</div>
                <form onSubmit={createRoom} style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <input style={{ ...S.input, flex: 1, minWidth: 200 }} placeholder="Nombre de la sala (p. ej. Proyecto Atlas)" value={roomName} onChange={(e) => setRoomName(e.target.value)} required />
                  <select style={S.input} value={roomKind} onChange={(e) => setRoomKind(e.target.value)}>
                    <option value="mna">Proceso M&A</option>
                    <option value="archive">Archivo interno</option>
                  </select>
                  <button style={S.btn}>Crear sala</button>
                </form>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {rooms.map((r) => (
                    <Link key={r.id} href={`/dataroom/${r.id}`} style={S.roomCard}>
                      <div style={S.roomKind}>{r.kind === 'mna' ? 'M&A' : 'ARCHIVO'}</div>
                      <div style={S.roomName}>{r.name}</div>
                      <div style={S.roomMeta}>Abrir sala →</div>
                    </Link>
                  ))}
                  {!rooms.length && <div style={S.empty}>Aún no hay salas. Crea la primera arriba.</div>}
                </div>
              </section>
              {msg && <p style={S.err}>{msg}</p>}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

const serif = "Georgia, 'Times New Roman', serif";
const ui = "ui-sans-serif, system-ui, -apple-system, sans-serif";
const S = {
  page: { minHeight: '100vh', background: '#f3f0e8', color: '#1c1916', fontFamily: ui },
  authWrap: { maxWidth: 460, margin: '0 auto', padding: '96px 24px' },
  kicker: { fontSize: 11, letterSpacing: '.35em', color: '#9a7d1e', fontWeight: 700 },
  authTitle: { fontFamily: serif, fontSize: 52, fontWeight: 700, margin: '4px 0 10px' },
  authSub: { color: '#736c61', fontSize: 15, lineHeight: 1.6 },
  notice: { marginTop: 18, padding: '14px 16px', background: '#fff', border: '1px solid #e2ddd0', borderRadius: 10, fontSize: 14 },
  backLink: { color: '#736c61', textDecoration: 'none', fontSize: 13 },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', borderBottom: '1px solid #e2ddd0', background: '#fffdf9' },
  brand: { fontFamily: serif, fontSize: 20, fontWeight: 700, letterSpacing: '.02em' },
  brandSub: { fontSize: 11, letterSpacing: '.3em', color: '#9a7d1e', fontWeight: 700 },
  userEmail: { fontSize: 13, color: '#736c61' },
  ghost: { padding: '6px 12px', background: 'transparent', border: '1px solid #d8d2c4', borderRadius: 8, cursor: 'pointer', textDecoration: 'none', color: '#1c1916', fontSize: 13 },
  body: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: 0, maxWidth: 1200, margin: '0 auto' },
  side: { borderRight: '1px solid #e2ddd0', padding: '22px 18px', minHeight: 'calc(100vh - 57px)' },
  sideLabel: { fontSize: 10, letterSpacing: '.16em', color: '#a59d8f', fontWeight: 700, marginBottom: 10 },
  orgItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'transparent', border: '1px solid transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 14, color: '#1c1916' },
  orgItemActive: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: '#fff', border: '1px solid #e2ddd0', borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 14, color: '#1c1916', fontWeight: 600 },
  orgPlan: { fontSize: 10, color: '#9a7d1e', fontWeight: 700, letterSpacing: '.05em' },
  main: { padding: '26px 30px' },
  orgHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  orgTitle: { fontFamily: serif, fontSize: 30, fontWeight: 700, margin: 0 },
  usage: { fontSize: 13, color: '#736c61', marginTop: 4 },
  link: { color: '#9a7d1e', textDecoration: 'none', fontWeight: 600 },
  card: { background: '#fff', border: '1px solid #e2ddd0', borderRadius: 12, padding: 18, marginBottom: 18 },
  cardHead: { fontFamily: serif, fontSize: 17, fontWeight: 700, marginBottom: 12 },
  memberRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#faf8f3', borderRadius: 8, fontSize: 14 },
  roleTag: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', padding: '2px 8px', borderRadius: 999, background: '#eef0ee', border: '1px solid #e2ddd0', color: '#555' },
  roomCard: { display: 'block', padding: 16, border: '1px solid #e2ddd0', borderRadius: 10, textDecoration: 'none', color: '#1c1916', background: '#fffdf9' },
  roomKind: { fontSize: 10, fontWeight: 800, letterSpacing: '.14em', color: '#9a7d1e' },
  roomName: { fontFamily: serif, fontSize: 18, fontWeight: 700, margin: '6px 0 10px' },
  roomMeta: { fontSize: 12, color: '#736c61' },
  empty: { color: '#a59d8f', fontSize: 14, gridColumn: '1 / -1' },
  emptyBig: { color: '#a59d8f', fontSize: 16, padding: '60px 0', textAlign: 'center' },
  input: { padding: '10px 12px', border: '1px solid #d8d2c4', borderRadius: 8, fontSize: 14, background: '#fff', color: '#1c1916', outline: 'none', fontFamily: ui },
  btn: { padding: '10px 18px', background: '#1c1916', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnGhost: { padding: '9px 14px', background: 'transparent', color: '#1c1916', border: '1px solid #d8d2c4', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  hint: { fontSize: 12, color: '#a59d8f', marginTop: 8 },
  err: { color: '#a3341f', fontSize: 13, marginTop: 10 },
};
