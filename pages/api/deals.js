// pages/api/deals.js
// GET /api/deals - returns latest deals from Supabase
// GET /api/deals?type=M%26A - filter by type
// GET /api/deals?days=7 - date cutoff in days (default 7; use 30 for region/sector views)

import { supabase } from '../../lib/supabase';
import FALLBACK_DEALS from '../../lib/fallbackDeals';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
          return res.status(405).json({ error: 'Method not allowed' });
    }

  const { type, limit = 200, days = 7 } = req.query;

  // Compute cutoff date
  const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(days));
    const cutoffISO = cutoff.toISOString().split('T')[0]; // YYYY-MM-DD

  try {
        let query = supabase
          .from('deals')
          .select('*')
          .neq('category', 'duplicate')
          .gte('deal_date', cutoffISO)
          .order('deal_date', { ascending: false, nullsFirst: false })
          .order('fetched_at', { ascending: false })
          .limit(Number(limit));

      if (type && type !== 'All') {
              query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) throw error;

      // If DB is empty or fails, return fallback deals
      if (!data || data.length === 0) {
              return res.status(200).json({
                        deals: FALLBACK_DEALS,
                        source: 'archive',
                        count: FALLBACK_DEALS.length,
              });
      }

      return res.status(200).json({
              deals: data,
              source: data[0]?.data_source || 'db',
              count: data.length,
              last_updated: data[0]?.fetched_at,
      });

  } catch (err) {
        console.error('[API/deals] Error:', err);
        return res.status(200).json({
                deals: FALLBACK_DEALS,
                source: 'archive',
                count: FALLBACK_DEALS.length,
        });
  }
}

// Cache for 5 minutes on Vercel Edge
export const config = {
    api: { bodyParser: false },
};
