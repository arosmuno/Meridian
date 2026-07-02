// pages/api/pexels-check.js — debug temporal: comprueba la clave/entorno Pexels.
export const config = { runtime: 'edge' };

export default async function handler() {
  const key = process.env.PEXELS_API_KEY || '';
  const out = { hasKey: !!key, keyLen: key.length };
  try {
    const r = await fetch(
      'https://api.pexels.com/v1/search?query=data%20center%20technology&per_page=3&orientation=portrait',
      { headers: { Authorization: key } }
    );
    out.status = r.status;
    const t = await r.text();
    out.bodyStart = t.slice(0, 200);
    try {
      const j = JSON.parse(t);
      out.photos = (j.photos || []).length;
      out.first = j.photos && j.photos[0] ? j.photos[0].src.large2x : null;
    } catch {}
  } catch (e) {
    out.err = String(e).slice(0, 200);
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
