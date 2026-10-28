// Verificacion en dos pasos (TOTP, gratis con Supabase Auth): una app de autenticacion
// (Google Authenticator, Microsoft Authenticator, 1Password…) genera un codigo de 6 cifras.
// - Quien la activa tiene que meter el codigo cada vez que entra.
// - Una organizacion puede exigirla: sin el codigo no se ve nada (lo impone la base de datos y
//   el servidor, no solo esta pantalla).
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const mfa = () => supabase.auth.mfa;

// Estado de la sesion: si ya ha metido el codigo (aal2), si tiene que meterlo y su factor.
export function useMfa(session) {
  const [st, setSt] = useState({ loading: true, current: null, next: null, factor: null });
  async function refresh() {
    if (!session) return setSt({ loading: false, current: null, next: null, factor: null });
    const [{ data: lvl }, { data: f }] = await Promise.all([mfa().getAuthenticatorAssuranceLevel(), mfa().listFactors()]);
    const factor = ((f && f.totp) || []).find((x) => x.status === 'verified') || null;
    setSt({ loading: false, current: lvl && lvl.currentLevel, next: lvl && lvl.nextLevel, factor });
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [session && session.access_token]);
  return { ...st, needsCode: !!st.factor && st.current !== 'aal2', refresh };
}

const box = { maxWidth: 460, margin: '0 auto', padding: '96px 24px', fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif', color: '#1c1916' };
const input = { padding: '10px 12px', border: '1px solid #d8d2c4', borderRadius: 8, fontSize: 18, letterSpacing: '.3em', width: 160, textAlign: 'center', background: '#fff' };
const btn = { padding: '10px 18px', background: '#1c1916', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 };
const ghost = { padding: '9px 14px', background: 'transparent', color: '#1c1916', border: '1px solid #d8d2c4', borderRadius: 8, cursor: 'pointer', fontSize: 13 };
const err = { color: '#a3341f', fontSize: 13, marginTop: 10 };
const title = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, fontWeight: 700, margin: '4px 0 10px' };
const kicker = { fontSize: 11, letterSpacing: '.35em', color: '#9a7d1e', fontWeight: 700 };
const sub = { color: '#736c61', fontSize: 15, lineHeight: 1.6 };

function CodeForm({ onSubmit, busy, label = 'Verificar' }) {
  const [code, setCode] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(code.replace(/\D/g, '')); }} style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
      <input style={input} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
      <button style={btn} disabled={busy || code.replace(/\D/g, '').length !== 6}>{busy ? 'Comprobando…' : label}</button>
    </form>
  );
}

// Pantalla de entrada: pide el codigo de la app.
export function MfaChallenge({ factor, email, onDone }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function verify(code) {
    setBusy(true); setMsg('');
    const { error } = await mfa().challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (error) return setMsg(/invalid|expired/i.test(error.message) ? 'Código incorrecto o caducado. Mira el código actual en tu app.' : error.message);
    onDone && onDone();
  }
  return (
    <div style={{ minHeight: '100vh', background: '#f3f0e8' }}>
      <div style={box}>
        <div style={kicker}>MERIDIAN</div>
        <h1 style={title}>Verificación en dos pasos</h1>
        <p style={sub}>Abre tu app de autenticación y escribe el código de 6 cifras de Meridian Dataroom{email ? <> para <b>{email}</b></> : null}.</p>
        <CodeForm onSubmit={verify} busy={busy} />
        {msg && <p style={err}>{msg}</p>}
        <p style={{ ...sub, fontSize: 13, marginTop: 28 }}>¿Has perdido el móvil? Pide al administrador de tu organización que te restablezca la verificación.</p>
        <button style={ghost} onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>
    </div>
  );
}

// Alta: QR + clave, y confirmar con un codigo. Al confirmar, la sesion pasa a aal2.
export function MfaEnroll({ onDone, onCancel }) {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    (async () => {
      // Un alta a medias (sin confirmar) bloquea otra nueva: se limpia antes.
      const { data: list } = await mfa().listFactors();
      for (const x of ((list && list.all) || []).filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) await mfa().unenroll({ factorId: x.id });
      const { data, error } = await mfa().enroll({ factorType: 'totp', friendlyName: `Meridian ${new Date().toISOString().slice(0, 16)}` });
      if (error) setMsg(error.message); else setF(data);
    })();
  }, []);
  async function verify(code) {
    setBusy(true); setMsg('');
    const { error } = await mfa().challengeAndVerify({ factorId: f.id, code });
    setBusy(false);
    if (error) return setMsg(/invalid|expired/i.test(error.message) ? 'Código incorrecto. Comprueba que la hora del móvil es la correcta y prueba con el código actual.' : error.message);
    onDone && onDone();
  }
  return (
    <div>
      <ol style={{ ...sub, fontSize: 14, paddingLeft: 18, margin: '0 0 10px' }}>
        <li>Instala una app de autenticación (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>Escanea este código QR con la app (o copia la clave).</li>
        <li>Escribe el código de 6 cifras que te muestra.</li>
      </ol>
      {f ? (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <img src={f.totp.qr_code} alt="Código QR" width={170} height={170} style={{ background: '#fff', border: '1px solid #e2ddd0', borderRadius: 8, padding: 6 }} />
          <div style={{ fontSize: 12, color: '#736c61', maxWidth: 220, wordBreak: 'break-all' }}>Clave: <code style={{ color: '#1c1916' }}>{f.totp.secret}</code></div>
        </div>
      ) : !msg && <div style={{ ...sub, fontSize: 13 }}>Preparando…</div>}
      {f && <CodeForm onSubmit={verify} busy={busy} label="Activar" />}
      {msg && <p style={err}>{msg}</p>}
      {onCancel && <button style={{ ...ghost, marginTop: 12 }} onClick={onCancel}>Cancelar</button>}
    </div>
  );
}

// Pantalla completa cuando la organizacion la exige y la persona aun no la tiene.
export function MfaRequired({ orgNames, email, onDone }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f3f0e8' }}>
      <div style={box}>
        <div style={kicker}>MERIDIAN</div>
        <h1 style={title}>Activa la verificación en dos pasos</h1>
        <p style={sub}><b>{orgNames.join(', ')}</b> exige verificación en dos pasos para entrar en sus salas. Es un minuto: a partir de ahora, además del enlace por email, te pediremos un código de tu móvil{email ? <> ({email})</> : null}.</p>
        <MfaEnroll onDone={onDone} />
        <button style={{ ...ghost, marginTop: 24 }} onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>
    </div>
  );
}

// Tarjeta de seguridad en la portada: activar/desactivar la tuya y, si eres admin, exigirla en la organizacion.
export function SecurityCard({ mfaState, org, isAdmin, onOrgChanged, styles: S }) {
  const [enrolling, setEnrolling] = useState(false);
  const [msg, setMsg] = useState('');
  const on = !!mfaState.factor;
  async function disable() {
    if (org && org.require_mfa) return setMsg('Tu organización la exige: no se puede desactivar.');
    if (!window.confirm('¿Desactivar la verificación en dos pasos? Volverás a entrar solo con el enlace del email.')) return;
    const { error } = await mfa().unenroll({ factorId: mfaState.factor.id });
    if (error) return setMsg(error.message);
    await supabase.auth.refreshSession();
    mfaState.refresh();
  }
  async function setRequired(v) {
    setMsg('');
    const { error } = await supabase.rpc('dataroom_set_require_mfa', { p_org: org.id, p_on: v });
    if (error) setMsg(error.message); else onOrgChanged && onOrgChanged();
  }
  return (
    <section style={S.card}>
      <div style={S.cardHead}>Seguridad</div>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
        Verificación en dos pasos: <b style={{ color: on ? '#2f6b3a' : '#9a7d1e' }}>{on ? 'activada' : 'desactivada'}</b>
        <span style={{ color: '#736c61' }}> — {on ? 'al entrar te pedimos un código de tu app de autenticación.' : 'protege tu cuenta aunque alguien acceda a tu email.'}</span>
      </div>
      {!on && !enrolling && <button style={{ ...S.btn, marginTop: 10 }} onClick={() => setEnrolling(true)}>Activar</button>}
      {!on && enrolling && <div style={{ marginTop: 12 }}><MfaEnroll onDone={() => { setEnrolling(false); mfaState.refresh(); }} onCancel={() => setEnrolling(false)} /></div>}
      {on && <button style={{ ...S.btnGhost, marginTop: 10 }} onClick={disable}>Desactivar</button>}
      {isAdmin && org && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#736c61', marginTop: 14, paddingTop: 12, borderTop: '1px solid #eee8db' }}>
          <input type="checkbox" checked={!!org.require_mfa} disabled={!on && !org.require_mfa} onChange={(e) => setRequired(e.target.checked)} style={{ marginTop: 3 }} />
          <span><b style={{ color: '#1c1916' }}>Exigirla a todos en {org.name}</b> (también a los equipos invitados a las salas). Quien no la tenga, la tendrá que activar al entrar.{!on && !org.require_mfa ? ' Actívala primero en tu cuenta.' : ''}</span>
        </label>
      )}
      {msg && <p style={S.err}>{msg}</p>}
    </section>
  );
}
