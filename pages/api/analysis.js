// pages/api/analysis.js
// Meridian Analysis editorial commentary via Google Gemini, WITH caching in Supabase.
// Generated once per deal (key: headline) and reused -> avoids rate limits.
// Generation logic lives in lib/dealAnalysis.js (flash-lite + retry on 429/503).

import { supabaseAdmin } from '../../lib/supabase';
import { generateAnalysis } from '../../lib/dealAnalysis';

// Peticion EN VIVO: acota el tiempo maximo de la funcion.
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { deal } = req.body || {};
  if (!deal || !deal.headline) return res.status(400).json({ error: 'No deal provided' });

  // 1) Already cached in the database?
  try {
    const { data: existing } = await supabaseAdmin
      .from('deals')
      .select('analysis')
      .eq('headline', deal.headline)
      .limit(1)
      .maybeSingle();
    if (existing && existing.analysis) {
      return res.status(200).json({ analysis: existing.analysis, cached: true });
    }
  } catch (e) {
    // If the column does not exist yet or the read fails, continue to generate (without caching).
  }

  try {
    const analysis = await generateAnalysis(deal, { fast: true });
    if (!analysis || analysis.length < 40) {
      return res.status(200).json({ analysis: '' });
    }

    // 2) Cache it (non-blocking if it fails)
    try {
      await supabaseAdmin.from('deals').update({ analysis }).eq('headline', deal.headline);
    } catch (e) { /* ignore if the column does not exist yet */ }

    return res.status(200).json({ analysis });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
