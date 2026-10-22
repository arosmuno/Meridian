// pages/api/analysis.js
// Devuelve el "Meridian analysis" GUARDADO para un deal. No genera nada en vivo.
//
// El analisis se escribe en el cron (lib/fetchDeals.js) a partir del titular y el snippet
// de origen, con reglas de grounding estrictas: nada de multiplos, apalancamiento, primas
// o resultados que no esten en la fuente. Aqui solo se lee de deals.analysis.

import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const body = req.method === 'POST' ? (req.body || {}) : req.query;
  const deal = body.deal || {};
  if (deal.analysis) return res.status(200).json({ analysis: deal.analysis, sources: deal.analysis_sources || [] });

  const id = deal.dbId || deal.id || body.id;
  const headline = deal.headline || body.headline;
  try {
    let q = supabase.from('deals').select('analysis, analysis_sources').limit(1);
    if (id && Number(id) > 1000) q = q.eq('id', id);
    else if (headline) q = q.eq('headline', headline);
    else return res.status(200).json({ analysis: '' });
    const { data } = await q;
    return res.status(200).json({ analysis: (data && data[0] && data[0].analysis) || '', sources: (data && data[0] && data[0].analysis_sources) || [] });
  } catch {
    return res.status(200).json({ analysis: '' });
  }
}
