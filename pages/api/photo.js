// pages/api/photo.js -- foto por deal con CASCADA de fuentes legalmente seguras y, como
// red final, Pexels. Orden: (1) Wikimedia Commons -- foto REAL del sujeto, solo si el
// titulo del archivo contiene claramente el nombre de la empresa Y la licencia es de
// dominio publico / CC0 (sin obligacion de atribucion); (2) ilustracion generada por IA
// (Pollinations, imagen original por sector, sin nombres ni logos reales); (3) Pexels por
// sector (stock con licencia comercial). El ganador se cachea por deal en Supabase
// (site_cache) para que la cascada se ejecute UNA vez y luego cargue al instante.
//
// Nota: los LOGOS de empresa se dejan fuera a proposito (adivinar el dominio desde el
// nombre puede mostrar el logo de otra empresa, y un logo no encaja como foto a sangre).

import { supabaseAdmin } from '../../lib/supabase';

const TERMS = {
  Healthcare: 'hospital medical laboratory',
  TMT: 'technology data center servers',
  'Energy & Renewables': 'wind turbine solar power',
  'Financial Services': 'bank finance skyscraper',
  Infrastructure: 'bridge infrastructure construction',
  Consumer: 'retail shopping store',
  Industrials: 'factory manufacturing industry',
  'Real Estate': 'modern building architecture',
  Macro: 'stock market trading floor',
  General: 'business corporate skyline',
};

const SUFFIX = /^(group|holdings|holding|incorporated|inc|corporation|corp|company|co|sa|plc|ag|gmbh|ltd|limited|llc|lp|partners|automotive|nv|spa|se|ab|oyj|the|and|for)$/;

function cleanName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
// Token distintivo (primera palabra significativa) para exigir coincidencia real en Wikimedia.
function coreToken(name) {
  const words = cleanName(name).split(' ').filter((w) => w.length >= 3 && !SUFFIX.test(w));
  return words[0] || '';
}
function hashNum(s) {
  let h = 0; const str = String(s || '');
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return Math.abs(h);
}
async function fetchT(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 4500);
  try { return await fetch(url, Object.assign({ signal: ctrl.signal }, opts || {})); }
  finally { clearTimeout(t); }
}

// (1) Wikimedia Commons: foto real, con coincidencia estricta de nombre y licencia libre.
async function tryWikimedia(name) {
  const core = coreToken(name);
  if (core.length < 4) return ''; // sin token distintivo, no arriesgamos una coincidencia falsa
  const api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search'
    + '&gsrsearch=' + encodeURIComponent(cleanName(name)) + '&gsrnamespace=6&gsrlimit=10'
    + '&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=1000&origin=*';
  try {
    const r = await fetchT(api, { headers: { 'User-Agent': 'MeridianNewsBot/1.0 (contact: arosmuno@gmail.com)' } }, 5000);
    const j = await r.json().catch(() => ({}));
    const pages = (j && j.query && j.query.pages) ? Object.values(j.query.pages) : [];
    for (const p of pages) {
      const title = String(p.title || '').toLowerCase();
      const ii = p.imageinfo && p.imageinfo[0];
      if (!ii) continue;
      if (!/jpeg/.test(String(ii.mime || '').toLowerCase())) continue;     // solo fotos JPEG reales
      if (title.indexOf(core) === -1) continue;                            // debe nombrar la empresa
      // Excluye escudos/heraldica/logos/mapas/retratos: no son ilustrativos de una operacion.
      if (/coat of arms|crest|arms of|\blogo\b|\bseal\b|\bflag\b|emblem|escudo|heraldr|banner|\bmap\b|diagram|\bicon\b|portrait|signature|stamp/.test(title)) continue;
      // Solo imagenes claramente apaisadas (evita escudos/retratos verticales que casan por nombre).
      const tw = Number(ii.thumbwidth || ii.width || 0), th = Number(ii.thumbheight || ii.height || 0);
      if (!(tw > 0 && th > 0 && tw >= th * 1.2)) continue;
      const md = ii.extmetadata || {};
      const lic = String((md.LicenseShortName && md.LicenseShortName.value) || '').toLowerCase();
      if (!/public domain|cc0|no restrictions|pd-/.test(lic)) continue;    // solo libre sin atribucion
      const u = ii.thumburl || ii.url;
      if (u) return u;
    }
  } catch (e) { /* cae al siguiente nivel */ }
  return '';
}

// (2) Ilustracion IA original por sector (sin nombres/logos reales). Pollinations, sin clave.
function aiUrl(sector, id) {
  const term = TERMS[sector] || TERMS.General;
  const prompt = 'professional editorial photograph, ' + term + ', corporate business, cinematic lighting, no text, no logo, no watermark';
  const seed = hashNum(sector + ':' + id) % 100000;
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt)
    + '?width=1000&height=650&nologo=true&model=flux&seed=' + seed;
}

// (3) Pexels por sector (stock con licencia comercial). Cachea las URLs por sector.
async function tryPexels(sector, i) {
  const key = process.env.PEXELS_API_KEY;
  const cacheKey = 'photos:' + sector;
  let urls = [];
  try {
    const { data } = await supabaseAdmin.from('site_cache').select('value').eq('key', cacheKey).maybeSingle();
    if (data && data.value) urls = JSON.parse(data.value);
  } catch (e) { /* pedimos a Pexels */ }
  if (!urls.length && key) {
    try {
      const term = TERMS[sector] || TERMS.General;
      const pr = await fetchT('https://api.pexels.com/v1/search?query=' + encodeURIComponent(term) + '&per_page=15&orientation=landscape', { headers: { Authorization: key } }, 5000);
      const pj = await pr.json().catch(() => ({}));
      urls = (pj.photos || []).map((p) => p && p.src && (p.src.large || p.src.medium)).filter(Boolean);
      if (urls.length) {
        try { await supabaseAdmin.from('site_cache').upsert({ key: cacheKey, value: JSON.stringify(urls), updated_at: new Date().toISOString() }, { onConflict: 'key' }); } catch (e) {}
      }
    } catch (e) { /* nada */ }
  }
  if (!urls.length) return '';
  return urls[Math.abs(i) % urls.length];
}

export default async function handler(req, res) {
  const q = req.query || {};
  const sector = String(q.sector || 'General');
  const id = String(q.id || q.i || '0');
  const buyer = String(q.b || '');
  const target = String(q.t || '');
  const i = parseInt(id, 10) || hashNum(id);
  const cacheKey = 'photo:v3:' + id + ':' + sector;

  // Cache por deal: la cascada se resuelve una sola vez.
  try {
    const { data } = await supabaseAdmin.from('site_cache').select('value').eq('key', cacheKey).maybeSingle();
    if (data && data.value) { res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400'); res.redirect(302, data.value); return; }
  } catch (e) { /* seguimos */ }

  let url = '';
  const na = (s) => !s || /^n\/?a$/i.test(String(s).trim());
  // (1) Wikimedia: foto real del sujeto, con coincidencia estricta y licencia libre.
  if (!na(buyer)) url = await tryWikimedia(buyer);
  if (!url && !na(target)) url = await tryWikimedia(target);
  // (2) Pexels (red final): stock por sector con licencia comercial.
  // (La ilustracion IA -- aiUrl() -- se probo pero se descarta: Pollinations genera bajo
  //  demanda y tarda >20s, dejando tarjetas en blanco. Queda como funcion por si acaso.)
  if (!url) url = await tryPexels(sector, i);

  if (!url) { res.status(404).end(); return; }
  try { await supabaseAdmin.from('site_cache').upsert({ key: cacheKey, value: url, updated_at: new Date().toISOString() }, { onConflict: 'key' }); } catch (e) {}
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.redirect(302, url);
}
