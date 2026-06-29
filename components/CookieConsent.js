import { useState, useEffect } from 'react';

// Banner de consentimiento de cookies (GDPR / ePrivacy).
// Guarda la elección en localStorage. Cuando se active Google AdSense,
// los anuncios solo deben cargarse si meridian_consent === 'accepted'.
export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('meridian_consent')) setShow(true);
    } catch {}
  }, []);

  const choose = (value) => {
    try { localStorage.setItem('meridian_consent', value); } catch {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 500,
      background: '#141418', borderTop: '1px solid #2e2e38',
      padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center',
      justifyContent: 'center', flexWrap: 'wrap',
      fontFamily: "'Libre Franklin', sans-serif",
    }}>
      <span style={{ fontSize: 13, color: '#c8c0b4', maxWidth: 640, lineHeight: 1.6 }}>
        Usamos cookies esenciales para que el sitio funcione y, si lo aceptas, cookies de
        publicidad (Google AdSense) para sostener el proyecto. Puedes rechazar las no esenciales.{' '}
        <a href="/privacidad" style={{ color: '#d4a853', textDecoration: 'underline' }}>Más información</a>.
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => choose('rejected')} style={{
          background: 'transparent', border: '1px solid #2e2e38', color: '#c8c0b4',
          padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          letterSpacing: '.04em', textTransform: 'uppercase',
        }}>Rechazar</button>
        <button onClick={() => choose('accepted')} style={{
          background: '#d4a853', border: '1px solid #d4a853', color: '#0d0d0f',
          padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          letterSpacing: '.04em', textTransform: 'uppercase',
        }}>Aceptar</button>
      </div>
    </div>
  );
}
