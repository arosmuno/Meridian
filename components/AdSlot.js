import { useEffect } from 'react';

// Slot de anuncio. Reserva SIEMPRE un hueco visible con la etiqueta "Publicidad"
// (para que se vea donde van los anuncios, incluso mientras AdSense esta en
// revision). Cuando la cuenta este aprobada y sirviendo, el anuncio real de
// Google se pinta encima. Usa la unidad real via NEXT_PUBLIC_ADSENSE_SLOT.
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
      className="ad-slot"
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
        }}
      >
        Publicidad
      </span>
      {hasAds && (
        <ins
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', position: 'relative', zIndex: 1 }}
          data-ad-client={client}
          data-ad-slot={adSlot}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
}
