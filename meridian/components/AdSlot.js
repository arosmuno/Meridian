import { useEffect } from 'react';

export default function AdSlot({ slot, format = 'auto', style = {} }) {
  useEffect(() => {
    try {
      if (window.adsbygoogle) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch {}
  }, []);

  if (!process.env.NEXT_PUBLIC_ADSENSE_ID) {
    // Show placeholder until AdSense is configured
    return (
      <div className="ad-slot" style={style}>
        <span style={{ fontFamily: 'var(--s)', fontSize: 9, letterSpacing: '.1em', color: '#2a2218', textTransform: 'uppercase' }}>
          Advertisement
        </span>
      </div>
    );
  }

  return (
    <div className="ad-slot" style={style}>
      <ins
        className="adsbygoogle"
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
