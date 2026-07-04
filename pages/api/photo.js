// pages/api/photo.js -- foto por sector desde Pexels (licencia de uso comercial, sin
// riesgo legal de reutilizar fotos de otros periodicos). Cachea las URLs por sector en
// Supabase (site_cache) para no gastar la cuota de la API de Pexels. Devuelve un 302 a la
// imagen elegida (variedad por indice). Requiere PEXELS_API_KEY.
//
// La atribucion "Photos via Pexels" se muestra en el pie del sitio (requisito de la API).

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

export default async function handler(req, res) {
  const sector = String((req.query && req.query.sector) || 'General');
  const i = parseInt((req.query && req.query.i) || '0', 10) || 0;
  const term = TERMS[sector] || TERMS.General;
  const cacheKey = 'photos:' + sector;

  let urls = [];
  try {
    const { data } = await supabaseAdmin.from('site_cache').select('value').eq('key', cacheKey).maybeSingle();
    if (data && data.value) urls = JSON.parse(data.value);
  } catch (e) { /* seguimos y pedimos a Pexels */ }

  const key = process.env.PEXELS_API_KEY;
  if (!urls.length && key) {
    try {
      const pr = await fetch('https://api.pexels.com/v1/search?query=' + encodeURIComponent(term) + '&per_page=15&orientation=landscape', {
        headers: { Authorization: key },
      });
      const pj = await pr.json().catch(() => ({}));
      urls = (pj.photos || []).map((p) => p && p.src && (p.src.large || p.src.medium)).filter(Boolean);
      if (urls.length) {
        try {
          await supabaseAdmin.from('site_cache').upsert({ key: cacheKey, value: JSON.stringify(urls), updated_at: new Date().toISOString() }, { onConflict: 'key' });
        } catch (e) { /* no bloqueante */ }
      }
    } catch (e) { /* si falla, 404 abajo */ }
  }

  if (!urls.length) { res.status(404).end(); return; }
  const url = urls[Math.abs(i) % urls.length];
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.redirect(302, url);
}
