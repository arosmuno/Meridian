import { fetchDealsFromWeb, fetchDealsFromKnowledge } from '../../lib/fetchDeals';
import { supabaseAdmin } from '../../lib/supabase';
import { generateAnalysis } from '../../lib/dealAnalysis';
import { dedupeDeals } from '../../lib/dedupe';
import { getOrGenerateWrap } from '../../lib/wrapGen';

export const config = { maxDuration: 300 };

// Firma de entidad (sin acentos/signos ni sufijos corporativos) para detectar
// la MISMA operacion re-titulada por distintas fuentes o pasadas del cron.
const CORP_SUFFIX = /(group|holdings|holding|incorporated|inc|corporation|corp|company|co|sa|plc|ag|gmbh|ltd|limited|llc|lp|partners|automotive|nv|spa|realestate|se|ab|oyj)$/;
function sigPart(s) {
  let x = String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let i = 0; i < 3; i++) { const y = x.replace(CORP_SUFFIX, ''); if (y === x) break; x = y; }
  return x;
}
function dealSig(d) {
  const b = sigPart(d.buyer), t = sigPart(d.target);
  const real = b && b !== 'na' && b.length > 2 && t && t !== 'na' && t.length > 2;
  return real ? (b < t ? b + '|' + t : t + '|' + b)
              : 'h:' + String(d.headline || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 42);
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthed = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isAuthed) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('[CRON] Starting at', new Date().toISOString());

  try {
    let deals = null;
    let source = 'live';

    // Only 1 API call per cron cycle
    try {
      deals = await fetchDealsFromWeb();
      console.log(`[CRON] Web search returned ${deals?.length || 0} deals`);
    } catch (e) {
      console.error('[CRON] Web search failed:', e.message);
      // DO NOT fall back to knowledge — save rate limit
      return res.status(200).json({ ok: true, saved: 0, message: `Web search failed: ${e.message}` });
    }

    if (!deals || deals.length === 0) {
      return res.status(200).json({ ok: true, saved: 0, message: 'No deals found' });
    }

    // Save WITHOUT translations — /api/translate handles live translation on frontend
    const rows = deals.map((d) => {
      let deal_date = null;
      if (d.date) {
        const parsed = new Date(d.date);
        if (!isNaN(parsed)) deal_date = parsed.toISOString().split('T')[0];
      }
      return {
        headline: d.headline,
        summary: d.summary,
        buyer: d.buyer || 'N/A',
        target: d.target || 'N/A',
        value: Number(d.value) || 0,
        currency: d.currency || 'EUR',
        type: d.type || 'M&A',
        sector: d.sector || 'General',
        geography: d.geography || 'Global',
        status: d.status || 'Signed',
        date: d.date || new Date().toLocaleDateString('en-GB'),
        deal_date,
        advisor: d.advisor || '',
        source: d.source || '',
        source_channel: d.source_channel || 'news',
        category: d.category || 'deal',
        image_url: d.image || null,
        source_url: d.source_url || null,
        fetched_at: new Date().toISOString(),
        data_source: source,
      };
    });

    // Dedupe ROBUSTO con el mismo motor que el frontend (firma buyer|target + solape de
    // titular): asi los duplicados re-titulados (p.ej. "Bending Spoons builds $23B empire
    // through..." vs "...with Nasdaq...") NO llegan a entrar en la BD.
    let existing = [];
    try {
      const { data } = await supabaseAdmin
        .from('deals')
        .select('buyer,target,headline')
        .order('fetched_at', { ascending: false })
        .limit(300);
      existing = data || [];
    } catch (e) {
      console.error('[CRON] Could not load existing deals for dedupe:', e.message);
    }
    const keptHeadlines = new Set(dedupeDeals([...existing, ...rows]).map((d) => d.headline));
    const existingHeadlines = new Set(existing.map((e) => e.headline));
    const freshRows = rows.filter((d) => keptHeadlines.has(d.headline) && !existingHeadlines.has(d.headline));

    let saved = 0;
    if (freshRows.length > 0) {
      const { error } = await supabaseAdmin
        .from('deals')
        .upsert(freshRows, { onConflict: 'headline', ignoreDuplicates: true });
      if (error) {
        console.error('[CRON] Supabase error:', error.message);
        return res.status(500).json({ error: error.message });
      }
      saved = freshRows.length;
    }

    // Backfill Meridian Analysis for deals that still lack it. Runs every cycle (even
    // when all fetched news were duplicates), bounded per run to respect quota/time, so
    // the whole archive gets analysis over time -- not just deals a reader happened to open.
    let analysed = 0;
    try {
      const { data: missing } = await supabaseAdmin
        .from('deals')
        .select('id,headline,summary,buyer,target,value,currency,type,sector')
        .eq('category', 'deal')
        .is('analysis', null)
        .order('fetched_at', { ascending: false })
        .limit(4);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const list = missing || [];
      for (let k = 0; k < list.length; k++) {
        const d = list[k];
        try {
          const a = await generateAnalysis(d);
          if (a && a.length > 60) {
            await supabaseAdmin.from('deals').update({ analysis: a }).eq('id', d.id);
            analysed++;
          }
        } catch (e) { /* skip this deal on error, try again next run */ }
        // Espacia las peticiones para no chocar con el limite POR MINUTO de Groq (RPM/TPM).
        if (k < list.length - 1) await sleep(12000);
      }
    } catch (e) {
      console.error('[CRON] Analysis backfill failed:', e.message);
    }

    // Pre-genera "The Wrap" de hoy (si aun no esta cacheado) con el motor fiable del cron,
    // para que la pagina /wrap nunca muestre el placeholder ni una fecha vieja.
    let wrapped = false;
    try { const w = await getOrGenerateWrap(false); wrapped = !!(w && w.wrap); } catch (e) { console.error('[CRON] Wrap gen failed:', e.message); }

    console.log(`[CRON] Saved ${saved} deals (skipped ${rows.length - saved} dupes), analysed ${analysed}, wrap:${wrapped}`);
    return res.status(200).json({ ok: true, saved, skipped: rows.length - saved, analysed, wrapped, source });

  } catch (err) {
    console.error('[CRON] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
