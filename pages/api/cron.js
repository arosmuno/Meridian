import { fetchDealsFromWeb, fetchDealsFromKnowledge } from '../../lib/fetchDeals';
import { supabaseAdmin } from '../../lib/supabase';

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

    // Dedupe: descarta filas cuya operacion (buyer|target) ya existe en la BD o se
    // repite en este mismo lote, aunque el titular este redactado distinto.
    const seen = new Set();
    try {
      const { data: existing } = await supabaseAdmin
        .from('deals')
        .select('buyer,target,headline')
        .order('fetched_at', { ascending: false })
        .limit(300);
      (existing || []).forEach((d) => seen.add(dealSig(d)));
    } catch (e) {
      console.error('[CRON] Could not load existing deals for dedupe:', e.message);
    }
    const freshRows = rows.filter((d) => {
      const sig = dealSig(d);
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });

    if (freshRows.length === 0) {
      console.log('[CRON] All fetched deals were duplicates of existing ones.');
      return res.status(200).json({ ok: true, saved: 0, skipped: rows.length, message: 'All duplicates' });
    }

    const { error } = await supabaseAdmin
      .from('deals')
      .upsert(freshRows, { onConflict: 'headline', ignoreDuplicates: true });

    if (error) {
      console.error('[CRON] Supabase error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[CRON] Saved ${freshRows.length} deals (skipped ${rows.length - freshRows.length} duplicates)`);
    return res.status(200).json({ ok: true, saved: freshRows.length, skipped: rows.length - freshRows.length, source });

  } catch (err) {
    console.error('[CRON] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
