import { fetchDealsFromWeb, fetchDealsFromKnowledge } from '../../lib/fetchDeals';
import { supabaseAdmin } from '../../lib/supabase';

export const config = { maxDuration: 300 };

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
        fetched_at: new Date().toISOString(),
        data_source: source,
      };
    });

    const { error } = await supabaseAdmin
      .from('deals')
      .upsert(rows, { onConflict: 'headline', ignoreDuplicates: true });

    if (error) {
      console.error('[CRON] Supabase error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[CRON] Saved ${rows.length} deals (no translations — use /api/fix later)`);
    return res.status(200).json({ ok: true, saved: rows.length, source });

  } catch (err) {
    console.error('[CRON] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
