// pages/api/deals.js
// GET /api/deals            - ultimos deals desde Supabase
// GET /api/deals?type=M%26A - filtrar por tipo
// GET /api/deals?limit=20   - limitar resultados
//
// SIN FALLBACK. La version anterior importaba lib/fallbackDeals.js -- un array
// codificado a mano, rotulado "Real verified deals", que contenia afirmaciones
// FALSAS sobre empresas reales (que la fusion Synopsys/Ansys se habia roto; que
// Thames Water estaba en administracion concursal, con administradores inventados;
// que EQT compraba Software AG). Se servia automaticamente a usuarios y a los
// crawlers cada vez que la base de datos fallaba o venia vacia.
//
// Una base de datos vacia se sirve vacia. Un feed vacio es honesto. Uno inventado, no.

import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { type, limit = 50 } = req.query;

  try {
    let query = supabase
      .from('deals')
      .select('*')
      .order('deal_date', { ascending: false, nullsFirst: false })
      .order('fetched_at', { ascending: false })
      .limit(Number(limit));

    if (type && type !== 'All') query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;

    const deals = data || [];

    return res.status(200).json({
      deals,
      source: 'live',
      count: deals.length,
      last_updated: deals[0]?.fetched_at || null,
    });
  } catch (err) {
    console.error('[API/deals] Error:', err);
    // Un fallo de base de datos es un fallo. No se rellena con nada.
    return res.status(200).json({ deals: [], source: 'live', count: 0, error: 'unavailable' });
  }
}
