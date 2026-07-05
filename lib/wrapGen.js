// lib/wrapGen.js -- genera y cachea "The Wrap" del dia en Supabase (site_cache).
// Lo usan tanto el CRON (lo pre-genera cada dia, con proveedores fiables) como la pagina
// /wrap (lo lee al instante; si falta, lo genera como respaldo). Asi la pagina NUNCA se
// queda en el placeholder ni muestra una fecha vieja.

import { supabaseAdmin } from './supabase';
import { llmComplete } from './llm';

const SITE = 'https://www.meridiancapmarkets.com';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function labelFor() { return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }

// Devuelve { wrap, label, count } de hoy. Si ya esta cacheado (y no force), lo reutiliza.
export async function getOrGenerateWrap(force = false) {
  const today = todayStr();
  const label = labelFor();
  const cacheKey = 'wrap:' + today;

  if (!force) {
    try {
      const { data } = await supabaseAdmin.from('site_cache').select('value').eq('key', cacheKey).maybeSingle();
      if (data && data.value) {
        const p = JSON.parse(data.value);
        if (p && p.text) return { wrap: p.text, label: p.label || label, count: p.count || 0 };
      }
    } catch (e) { /* seguimos a generar */ }
  }

  let wrap = '', count = 0;
  try {
    const r = await fetch(SITE + '/api/deals?limit=40');
    const j = await r.json();
    const seen = new Set();
    const deals = (j.deals || []).filter((d) => d.category === 'deal' && d.headline && !seen.has(d.headline) && (seen.add(d.headline) || true)).slice(0, 15);
    count = deals.length;
    if (deals.length) {
      const list = deals.map((d) => '- ' + d.headline + (Number(d.value) ? ' (' + d.value + ' ' + (d.currency || '') + ')' : '') + ' [' + (d.type || '') + ', ' + (d.sector || '') + ']').join('\n');
      const prompt = 'You are the editor of MERIDIAN, a capital-markets newspaper. Write a tight, professional "Deal Wrap" for ' + label + ' in English: 2 to 3 short paragraphs of flowing prose, no headers, no bullet points. Cover the biggest deals of the day, the dominant sectors or themes, and end with one forward-looking line. Be precise; do not invent figures.\n\nToday\'s deals:\n' + list + '\n\nStart directly with the wrap:';
      wrap = await llmComplete({ prompt, maxTokens: 900, temperature: 0.6 });
    }
  } catch (e) { /* deja wrap vacio; se reintenta en la proxima */ }

  if (wrap) {
    try {
      await supabaseAdmin.from('site_cache').upsert({ key: cacheKey, value: JSON.stringify({ text: wrap, label, count }), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    } catch (e) { /* no bloqueante */ }
  }
  return { wrap, label, count };
}
