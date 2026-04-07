// pages/api/cron.js
import { fetchDealsFromWeb, fetchDealsFromKnowledge } from '../../lib/fetchDeals';
import { supabaseAdmin } from '../../lib/supabase';

export const config = { maxDuration: 60 };

async function processDeals() {
  let deals = null;
  let source = 'live';

  try {
    deals = await fetchDealsFromWeb();
    console.log(`[CRON] Web search returned ${deals?.length || 0} deals`);
  } catch (e) {
    console.error('[CRON] Web search failed:', e.message);
  }

  if (!deals || deals.length < 3) {
    try {
      deals = await fetchDealsFromKnowledge();
      source = 'knowledge';
    } catch (e) {
      console.error('[CRON] Knowledge base failed:', e.message);
    }
  }

  if (!deals || deals.length === 0) return { saved: 0 };

  const rows = deals.map(d => {
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

  if (error) console.error('[CRON] Supabase error:', error);
  else console.log(`[CRON] Saved ${rows.length} deals`);

  return { saved: rows.length, source };
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthed = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isAuthed) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[CRON] Starting at', new Date().toISOString());

  // Respond immediately so cron-job.org doesn't timeout
  // Then process in background (Vercel keeps the function alive)
  res.status(200).json({ ok: true, message: 'Processing started' });

  // Background processing after response
  try {
    await processDeals();
  } catch (err) {
    console.error('[CRON] Fatal error:', err);
  }
}
