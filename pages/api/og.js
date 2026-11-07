// pages/api/og.js -- imagen de vista previa (1200x630) para LinkedIn, X, WhatsApp...
// /api/og                    -> imagen generica de Meridian
// /api/og?title=...&kicker=... -> con titular propio (paginas que lo pasen)
import { ImageResponse } from 'next/og';

export const config = { runtime: 'edge' };

async function font(family, weight) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`)).text();
    const url = (css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/) || [])[1];
    if (!url) return null;
    return await (await fetch(url)).arrayBuffer();
  } catch (e) { return null; }
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') || '').slice(0, 140);
  const kicker = (searchParams.get('kicker') || 'The Capital Markets Intelligence Review').slice(0, 60);

  const [display, sans] = await Promise.all([font('Playfair+Display', 800), font('Libre+Franklin', 600)]);
  const fonts = [];
  if (display) fonts.push({ name: 'Display', data: display, weight: 800, style: 'normal' });
  if (sans) fonts.push({ name: 'Sans', data: sans, weight: 600, style: 'normal' });

  const ink = '#1c1916', gold = '#9a7d1e', paper = '#faf8f3', mid = '#6b645a';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: paper, padding: '56px 72px', fontFamily: 'Sans' }}>
        <div style={{ display: 'flex', borderTop: `3px solid ${ink}`, borderBottom: `1px solid ${ink}`, padding: '6px 0', fontSize: 18, letterSpacing: 6, color: mid, textTransform: 'uppercase', justifyContent: 'center' }}>
          {kicker}
        </div>
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: title ? 'flex-start' : 'center' }}>
          {title ? (
            <>
              <div style={{ fontFamily: 'Display', fontSize: 34, color: ink, letterSpacing: 2, marginBottom: 22 }}>MERIDIAN</div>
              <div style={{ fontFamily: 'Display', fontSize: title.length > 70 ? 54 : 66, color: ink, lineHeight: 1.12 }}>{title}</div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'Display', fontSize: 150, color: ink, letterSpacing: -2, lineHeight: 1 }}>MERIDIAN</div>
              <div style={{ fontSize: 26, color: mid, marginTop: 18 }}>Deals. Capital. Strategy.</div>
            </>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${ink}`, paddingTop: 14, fontSize: 20, color: mid }}>
          <span>M&amp;A · Leveraged Finance · Project Finance · Europe</span>
          <span style={{ color: gold }}>meridiancapmarkets.com</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } }
  );
}
