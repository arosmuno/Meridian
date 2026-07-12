// pages/api/jobs.js
// GET /api/jobs            - active IB openings, newest first
// GET /api/jobs?division=M%26A
// GET /api/jobs?city=Madrid
// GET /api/jobs?limit=100

import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { division, city, level, limit = 100 } = req.query;

  try {
    let query = supabase
      .from('jobs')
      .select('*, deal:related_deal_id (id, headline, buyer, target, value, currency, deal_date)')
      .eq('status', 'active')
      .order('posted_at', { ascending: false, nullsFirst: false })
      .order('first_seen_at', { ascending: false })
      .limit(Number(limit));

    if (division && division !== 'All') query = query.eq('division', division);
    if (city && city !== 'All') query = query.eq('city', city);
    if (level && level !== 'All') query = query.eq('level', level);

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ jobs: data || [], count: (data || []).length });
  } catch (err) {
    console.error('[API/jobs] Error:', err);
    return res.status(200).json({ jobs: [], count: 0 });
  }
}
