// pages/api/cron.js
// Called by Vercel Cron every 10 minutes (see vercel.json)
// Also callable manually: POST /api/cron with header Authorization: Bearer CRON_SECRET

import { fetchDealsFromWeb, fetchDealsFromKnowledge } from '../../lib/fetchDeals';
import { supabaseAdmin } from '../../lib/supabase';

export default async function handler(req, res) {
  // Security: only allow Vercel cron or authenticated requests
  const authHeader = req.headers.authorization;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthed = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isAuthed) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[CRON] Starting deal fetch at', new Date().toISOString());

  try {
    // Try live web search first
    let deals = null;
    let source = 'live';

    try {
      deals = await fetchDealsFromWeb();
      console.log(`[CRON] Web search returned ${deals?.length || 0} deals`);
    } catch (e) {
      console.error('[CRON] Web search failed:', e.message);
    }

    // Fall back to knowledge base
    if (!deals || deals.length < 3) {
      try {
        deals = await fetchDealsFromKnowledge();
        source = 'knowledge';
        console.log(`[CRON] Knowledge base returned ${deals?.length || 0} deals`);
      } catch (e) {
        console.error('[CRON] Knowledge base failed:', e.message);
      }
    }

    if (!deals || deals.length === 0) {
      return res.status(200).json({ ok: true, saved: 0, message: 'No deals found, skipping' });
    }

    // Save to Supabase — upsert by headline to avoid duplicates
    const rows = deals.map(d => ({
      headline: d.headline,
      summary: d.summary,
      buyer: d.buyer,
      target: d.target,
      value: Number(d.value) || 0,
      currency: d.currency || 'EUR',
      type: d.type || 'M&A',
      sector: d.sector || 'General',
      status: d.status || 'Signed',
      date: d.date || new Date().toLocaleDateString('en-GB'),
      advisor: d.advisor || '',
      source: d.source || '',
      source_channel: d.source_channel || 'news',
      fetched_at: new Date().toISOString(),
      data_source: source,
    }));

    const { error } = await supabaseAdmin
      .from('deals')
      .upsert(rows, { onConflict: 'headline', ignoreDuplicates: true });

    if (error) {
      console.error('[CRON] Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[CRON] Saved ${rows.length} deals to Supabase`);
    return res.status(200).json({ ok: true, saved: rows.length, source });

  } catch (err) {
    console.error('[CRON] Fatal error:', err);
    return res.status(500).json({ error: err.message });
  }
}
