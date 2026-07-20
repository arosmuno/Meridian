// Meridian Dataroom — planes y precios.
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

const PLANS = [
  { id: 'free', name: 'Free', price: '0€', period: '', tagline: 'Para probar el producto',
    features: ['1 sala de datos', '20 documentos por sala', '2 asientos', 'Chat de due diligence con IA', 'Cifrado en reposo'] },
  { id: 'pro', name: 'Pro', price: '149€', period: '/mes', tagline: 'Para procesos y equipos', highlight: true,
    features: ['10 salas de datos', '500 documentos por sala', '10 asientos', 'Invitaciones de equipo y roles', 'Descargas firmadas + auditoría', 'Soporte prioritario'] },
  { id: 'enterprise', name: 'Enterprise', price: 'A medida', period: '', tagline: 'Para firmas y volúmenes altos',
    features: ['Salas y asientos ilimitados', 'Cifrado por organización (envelope)', 'SSO y residencia de datos', 'Log de auditoría avanzado', 'SLA y onboarding dedicado'] },
];

export default function Precios() {
  const [session, setSession] = useState(null);
  const [org, setOrg] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);
  useEffect(() => {
    if (!session) return;
    supabase.schema('dataroom').from('orgs').select('*').order('created_at').then(({ data }) => setOrg(data && data[0]));
  }, [session]);

  async function upgrade(planId) {
    if (!session) { setMsg('Inicia sesión primero.'); return; }
    setMsg('Redirigiendo al pago…');
    const res = await fetch('/api/dataroom/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planId, org_id: org && org.id, email: session.user.email }),
    });
    const out = await res.json();
    if (out.url) { window.location.href = out.url; return; }
    setMsg(out.error || 'No se pudo iniciar el pago.');
  }

  return (
    <div style={S.page}>
      <Head><title>Meridian Dataroom — Planes</title></Head>
      <header style={S.top}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={S.brand}>MERIDIAN</span><span style={S.brandSub}>DATAROOM</span>
        </div>
        <Link href="/dataroom" style={S.ghost}>← Volver</Link>
      </header>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '48px 24px' }}>
        <div style={S.kicker}>PLANES</div>
        <h1 style={S.h1}>Elige tu plan</h1>
        <p style={S.sub}>Empieza gratis. Sube de plan cuando necesites más salas, más equipo o funciones enterprise.</p>
        <div style={S.grid}>
          {PLANS.map((p) => (
            <div key={p.id} style={{ ...S.card, ...(p.highlight ? S.cardHi : {}) }}>
              {p.highlight && <div style={S.badge}>MÁS POPULAR</div>}
              <div style={S.pName}>{p.name}</div>
              <div style={S.pTag}>{p.tagline}</div>
              <div style={S.pPrice}>{p.price}<span style={S.pPeriod}>{p.period}</span></div>
              <ul style={S.ul}>
                {p.features.map((f) => <li key={f} style={S.li}>· {f}</li>)}
              </ul>
              {p.id === 'free' && <div style={S.current}>{org && org.plan === 'free' ? 'Tu plan actual' : 'Incluido'}</div>}
              {p.id === 'pro' && <button style={S.btn} onClick={() => upgrade('pro')}>{org && org.plan === 'pro' ? 'Plan actual' : 'Actualizar a Pro'}</button>}
              {p.id === 'enterprise' && <a style={S.btnGhost} href="mailto:arosmuno@gmail.com?subject=Meridian%20Dataroom%20Enterprise">Contactar</a>}
            </div>
          ))}
        </div>
        {msg && <p style={S.msg}>{msg}</p>}
      </div>
    </div>
  );
}

const serif = "Georgia, 'Times New Roman', serif";
const ui = "ui-sans-serif, system-ui, -apple-system, sans-serif";
const S = {
  page: { minHeight: '100vh', background: '#f3f0e8', color: '#1c1916', fontFamily: ui },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', borderBottom: '1px solid #e2ddd0', background: '#fffdf9' },
  brand: { fontFamily: serif, fontSize: 20, fontWeight: 700 },
  brandSub: { fontSize: 11, letterSpacing: '.3em', color: '#9a7d1e', fontWeight: 700 },
  ghost: { padding: '6px 12px', border: '1px solid #d8d2c4', borderRadius: 8, textDecoration: 'none', color: '#1c1916', fontSize: 13 },
  kicker: { fontSize: 11, letterSpacing: '.35em', color: '#9a7d1e', fontWeight: 700, textAlign: 'center' },
  h1: { fontFamily: serif, fontSize: 40, fontWeight: 700, textAlign: 'center', margin: '6px 0 8px' },
  sub: { color: '#736c61', textAlign: 'center', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.6 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, alignItems: 'start' },
  card: { position: 'relative', background: '#fff', border: '1px solid #e2ddd0', borderRadius: 14, padding: 24 },
  cardHi: { border: '2px solid #9a7d1e', boxShadow: '0 8px 30px rgba(154,125,30,.10)' },
  badge: { position: 'absolute', top: -11, left: 24, background: '#9a7d1e', color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '.1em', padding: '3px 10px', borderRadius: 999 },
  pName: { fontFamily: serif, fontSize: 24, fontWeight: 700 },
  pTag: { color: '#736c61', fontSize: 13, margin: '2px 0 14px' },
  pPrice: { fontFamily: serif, fontSize: 34, fontWeight: 700 },
  pPeriod: { fontSize: 14, color: '#736c61', fontWeight: 400, fontFamily: ui },
  ul: { listStyle: 'none', padding: 0, margin: '16px 0 20px', display: 'grid', gap: 8 },
  li: { fontSize: 14, color: '#403a33', lineHeight: 1.4 },
  btn: { width: '100%', padding: '11px 16px', background: '#1c1916', color: '#fff', border: 0, borderRadius: 9, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnGhost: { display: 'block', textAlign: 'center', padding: '11px 16px', background: 'transparent', color: '#1c1916', border: '1px solid #d8d2c4', borderRadius: 9, textDecoration: 'none', fontSize: 14 },
  current: { textAlign: 'center', padding: '11px 16px', color: '#736c61', fontSize: 13, border: '1px dashed #d8d2c4', borderRadius: 9 },
  msg: { textAlign: 'center', color: '#736c61', marginTop: 18 },
};
