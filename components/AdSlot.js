import { useEffect } from 'react';

// Slot de anuncio. Si no hay NEXT_PUBLIC_ADSENSE_ID configurado, muestra un
// hueco VISIBLE (borde discontinuo + etiqueta) para que se vea dónde irán los
// anuncios. Cuando se configure AdSense, renderiza el <ins> real.
export default function AdSlot({ slot, format = 'auto', style = {} }) {
  const hasAds = !!process.env.NEXT_PUBLIC_ADSENSE_ID;

  useEffect(() => {
    if (!hasAds) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [hasAds]);

  if (!hasAds) {
    return (
      <div
        className="ad-slot ad-placeholder"
        style={{ border: '1px dashed #3a3a44', minHeight: 90, ...style }}
      >
        <span style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: '#6a6258', textTransform: 'uppercase' }}>
          Publicidad
        </span>
      </div>
    );
  }

  return (
    <div className="ad-slot" style={style}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
