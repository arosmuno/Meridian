// pages/api/deals.js
// GET /api/deals - returns latest deals from Supabase
// GET /api/deals?type=M%26A - filter by type
// GET /api/deals?limit=20 - limit results

import { supabase } from '../../lib/supabase';
import FALLBACK_DEALS from '../../lib/fallbackDeals';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, limit = 50 } = req.query;

  try {
    let query = supabase
      .from('deals')
      .select('*')
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
    // Always return something
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
