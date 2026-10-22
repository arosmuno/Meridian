// lib/weekly.js -- seleccion de deals de "The Meridian Weekly".
// La usan el envio por email (/api/newsletter) y la edicion web (/weekly), asi que
// ambos ensenan exactamente lo mismo.
import { supabaseAdmin } from './supabase';
import { ineligibleReason, collapseSameDeal } from './eligibility';
import { dedupeDeals } from './dedupe';

// Lunes (UTC) de la semana de una fecha.
export function weekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

// Deals de la ventana [from, to). Por defecto, los ultimos 7 dias.
export async function loadWeek({ from, to } = {}) {
  const end = to || new Date();
  const start = from || new Date(end.getTime() - 7 * 864e5);
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('id, headline, summary, analysis, buyer, target, value, currency, value_eur, type, sector, geography, status, is_iberian, source, source_url, created_at, deal_date')
    .eq('category', 'deal')
    .is('excluded_reason', null)
    .is('dup_of', null)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('value_eur', { ascending: false, nullsFirst: false })
    .limit(300);
  if (error) throw error;
  // Solo operaciones de verdad, sin repetir la misma con distintos titulares.
  const eligible = (data || []).filter((d) => !ineligibleReason(d));
  const deals = collapseSameDeal(dedupeDeals(eligible))
    .sort((a, b) => (Number(b.value_eur) || 0) - (Number(a.value_eur) || 0));
  const valued = deals.filter((d) => Number(d.value_eur) > 0);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    count: deals.length,
    volume: Math.round(valued.reduce((s, d) => s + Number(d.value_eur), 0)),
    top: deals.slice(0, 8),
    iberia: deals.filter((d) => d.is_iberian).slice(0, 6),
    byType: Object.entries(deals.reduce((m, d) => { m[d.type] = (m[d.type] || 0) + 1; return m; }, {}))
      .sort((a, b) => b[1] - a[1]).slice(0, 6),
  };
}
