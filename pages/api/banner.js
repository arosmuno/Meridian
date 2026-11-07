// pages/api/banner.js -- portada para LinkedIn y otros perfiles (1128x191 por defecto)
import { ImageResponse } from 'next/og';

export const config = { runtime: 'edge' };

async function font(family, weight) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`)).text();
    const url = (css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/) || [])[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch (e) { return null; }
}

export default async function handler(req) {
  const q = new URL(req.url).searchParams;
  const W = Math.min(3000, Number(q.get('w')) || 1128), H = Math.min(1500, Number(q.get('h')) || 191);
  const k = Math.min(W / 1128, H / 191 * 1.6);
  const [display, sans] = await Promise.all([font('Playfair+Display', 800), font('Libre+Franklin', 600)]);
  const fonts = [];
  if (display) fonts.push({ name: 'Display', data: display, weight: 800, style: 'normal' });
  if (sans) fonts.push({ name: 'Sans', data: sans, weight: 600, style: 'normal' });
  const ink = '#1c1916', gold = '#9a7d1e', paper = '#faf8f3', mid = '#6b645a';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: paper, fontFamily: 'Sans' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 * k }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontFamily: 'Display', fontSize: 58 * k, color: ink, letterSpacing: -1, lineHeight: 1 }}>MERIDIAN</div>
            <div style={{ fontSize: 13 * k, color: mid, letterSpacing: 4 * k, marginTop: 8 * k }}>DEALS · CAPITAL · STRATEGY</div>
          </div>
          <div style={{ width: Math.max(2, 2 * k), height: 74 * k, background: gold }} />
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 16 * k, color: ink, lineHeight: 1.6 }}>
            <span>M&amp;A · Leveraged Finance · Project Finance</span>
            <span style={{ color: mid }}>Iberia &amp; Europe · meridiancapmarkets.com</span>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } }
  );
}
