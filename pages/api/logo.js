// pages/api/logo.js -- logo cuadrado de Meridian (perfiles de LinkedIn, Upwork, etc.)
// /api/logo?size=400  (por defecto 400x400)
import { ImageResponse } from 'next/og';

export const config = { runtime: 'edge' };

async function font(family, weight, text) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const url = (css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/) || [])[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch (e) { return null; }
}

export default async function handler(req) {
  const size = Math.min(1024, Math.max(100, Number(new URL(req.url).searchParams.get('size')) || 400));
  const data = await font('Playfair+Display', 800, 'M');
  const ink = '#1c1916', gold = '#c9a227';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: ink }}>
        <div style={{ fontFamily: 'Display', fontSize: size * 0.62, color: '#faf8f3', lineHeight: 1, marginTop: -size * 0.06 }}>M</div>
        <div style={{ width: size * 0.34, height: Math.max(2, size * 0.014), background: gold, marginTop: size * 0.02 }} />
      </div>
    ),
    {
      width: size, height: size,
      fonts: data ? [{ name: 'Display', data, weight: 800, style: 'normal' }] : [],
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
    }
  );
}
