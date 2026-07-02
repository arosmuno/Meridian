// pages/api/social.js — genera la imagen de post (1080x1350) estilo periodico:
// foto HD de Pexels (por sector) + tinte de marca + degradados + kicker + titular.
// Se usa para Instagram y como og:image (preview de enlace en X/LinkedIn/WhatsApp).
import { ImageResponse } from 'next/og';

export const config = { runtime: 'edge' };

const ACCENT = {
  'M&A':'#e65256','LBO':'#a78bfa','LevFin':'#4a9eff','Project Finance':'#22c55e',
  'ECM':'#c084fc','Restructuring':'#f43f5e','Debt Advisory':'#f59e0b',
  'Macro':'#38bdf8','Earnings':'#fb923c','Markets':'#a3e635',
};
const SECTOR_Q = {
  'TMT':'data center servers technology','Healthcare':'medical laboratory research',
  'Energy & Renewables':'wind turbines solar energy','Infrastructure':'bridge highway construction',
  'Financial Services':'financial district skyscraper','Consumer':'retail shopping store',
  'Industrials':'factory industrial machinery','Real Estate':'modern architecture building',
  'Macro':'stock exchange trading floor','General':'city skyline business',
};

async function pexels(sector) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const q = SECTOR_Q[sector] || 'business finance city skyline';
  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=15&orientation=portrait&size=large`,
      { headers: { Authorization: key } }
    );
    if (!r.ok) return null;
    const j = await r.json();
    const p = j.photos || [];
    if (!p.length) return null;
    const pick = p[Math.floor(Math.random() * p.length)];
    return (pick.src && (pick.src.large2x || pick.src.original || pick.src.large)) || null;
  } catch { return null; }
}

async function loadFont(url, name, weight) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.arrayBuffer();
    return { name, data, weight, style: 'normal' };
  } catch { return null; }
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const headline = (searchParams.get('headline') || 'Capital markets intelligence').slice(0, 150);
  const type = searchParams.get('type') || 'DEAL';
  const sector = searchParams.get('sector') || '';
  const status = (searchParams.get('status') || '').toUpperCase();
  const date = searchParams.get('date') || '';
  const accent = ACCENT[type] || '#c9b99a';

  const [photoUrl, lora, latoBold, latoReg] = await Promise.all([
    pexels(sector),
    loadFont('https://cdn.jsdelivr.net/npm/@fontsource/lora/files/lora-latin-700-normal.woff', 'Lora', 700),
    loadFont('https://cdn.jsdelivr.net/npm/@fontsource/lato/files/lato-latin-700-normal.woff', 'Lato', 700),
    loadFont('https://cdn.jsdelivr.net/npm/@fontsource/lato/files/lato-latin-400-normal.woff', 'Lato', 400),
  ]);
  const fonts = [lora, latoBold, latoReg].filter(Boolean);
  const headFam = lora ? 'Lora' : 'Lato';

  const dl = searchParams.get('dl');
  const opts = { width: 1080, height: 1350, fonts: fonts.length ? fonts : undefined };
  if (dl) {
    const fn = 'meridian_' + String(dl).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) + '.png';
    opts.headers = { 'Content-Disposition': 'attachment; filename="' + fn + '"' };
  }

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1350, display: 'flex', position: 'relative', backgroundColor: '#0b0b0d' }}>
        {photoUrl ? (
          <img src={photoUrl} width={1080} height={1350}
               style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 1350, objectFit: 'cover' }} />
        ) : null}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 1350, backgroundColor: accent, opacity: 0.30, display: 'flex' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 360, backgroundImage: 'linear-gradient(180deg, rgba(6,6,8,0.65), rgba(6,6,8,0))', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 590, left: 0, width: 1080, height: 760, backgroundImage: 'linear-gradient(0deg, rgba(6,6,8,0.95), rgba(6,6,8,0.10))', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 1350, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 70 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', backgroundColor: accent, color: '#111214', fontFamily: 'Lato', fontWeight: 700, fontSize: 30, padding: '12px 22px', letterSpacing: 1 }}>
              MERIDIAN · {type.toUpperCase()}
            </div>
            {status ? (
              <div style={{ display: 'flex', color: '#f2f2f2', fontFamily: 'Lato', fontWeight: 700, fontSize: 24, marginLeft: 20, letterSpacing: 1 }}>{status}</div>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', color: '#f8f7f4', fontFamily: headFam, fontWeight: 700, fontSize: 66, lineHeight: 1.15, maxWidth: 940 }}>
              {headline}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 34 }}>
              <div style={{ display: 'flex', color: accent, fontFamily: 'Lato', fontWeight: 700, fontSize: 30 }}>meridiancapmarkets.com</div>
              <div style={{ display: 'flex', color: '#cfcfd4', fontFamily: 'Lato', fontWeight: 400, fontSize: 26 }}>{date}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    opts
  );
}
