import { useEffect } from 'react';

// Caja de anuncio con hueco SIEMPRE visible ("Publicidad").
// AdSense colapsa (display:none) el <ins> y su contenedor directo cuando el
// anuncio no se rellena (p. ej. mientras la cuenta esta en revision). Por eso el
// <ins> vive en un div INTERIOR: si AdSense lo colapsa, la caja EXTERIOR (con su
// min-height y la etiqueta) sigue visible. Cuando el anuncio se sirve, se pinta
// dentro del interior, encima de la etiqueta. Unidad real via NEXT_PUBLIC_ADSENSE_SLOT.
export default function AdSlot({ slot, format = 'auto', style = {} }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_ID;
  const adSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT || slot;
  const hasAds = !!client;

  useEffect(() => {
    if (!hasAds) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [hasAds]);

  return (
    <div
      className="ad-reserve"
      style={{
        position: 'relative',
        border: '1px dashed #3a3a44',
        minHeight: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...style,
      }}
    >
      <span
        style={{
          position: 'absolute',
          fontFamily: 'var(--s)',
          fontSize: 10,
          letterSpacing: '.2em',
          color: '#6a6258',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        Advertisement
      </span>
      {hasAds && (
        <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
          <ins
            className="adsbygoogle"
            style={{ display: 'block', width: '100%' }}
            data-ad-client={client}
            data-ad-slot={adSlot}
            data-ad-format={format}
            data-full-width-responsive="true"
          />
        </div>
      )}
    </div>
  );
}
