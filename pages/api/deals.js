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
import { cleanAnalysis } from '../../lib/analysisQuality';
import { isRelevantMacro, editorialReject, fixSector } from '../../lib/eligibility';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { type, limit = 150, days } = req.query;

  try {
    let query = supabase
      .from('deals')
      .select('*')
      // Por fecha de entrada, no por deal_date: esa fecha la pone el modelo y a veces viene
      // mal (una operacion de julio salia la primera del feed de hoy).
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 150, 300));

    // Los duplicados de una misma operacion ya estan marcados en la base: no se sirven.
    query = query.or('dup_of.is.null');
    if (days && Number(days) > 0) {
      query = query.gte('created_at', new Date(Date.now() - Number(days) * 86400000).toISOString());
    }

    // Lo que no pasa el filtro editorial se conserva en la base pero no se sirve.
    query = query.or('category.is.null,category.neq.excluded');

    if (type && type !== 'All') query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;

    // Filas antiguas marcadas como "deal" que no son operaciones: se tratan como mercado.
    const fixed = (data || []).map((d) => (d.category === 'deal' && d.excluded_reason === 'Not a transaction' ? { ...d, category: 'macro', value: 0 } : d));
    const lite = req.query.lite === '1';
    const deals = fixed
      .filter((d) => d.category !== 'macro' || isRelevantMacro(d.headline))
      // Filas antiguas que hoy no pasarian el filtro editorial: se quedan en la base, no se sirven.
      .filter((d) => d.category !== 'deal' || !editorialReject(d))
      .map((d) => (d.category === 'deal' ? { ...d, sector: fixSector(d) } : d)).map((d) => (d.analysis ? { ...d, analysis: cleanAnalysis(d.analysis, `${d.headline} ${d.summary || ''}`) } : d));

    // lite=1 (portada): sin el analisis largo, que se carga al abrir cada noticia.
    const out = lite ? deals.map(({ analysis, ...d }) => ({ ...d, has_analysis: !!analysis })) : deals;
    return res.status(200).json({
      deals: out,
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
