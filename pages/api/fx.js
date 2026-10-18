// pages/api/fx.js
// Descarga los tipos de cambio DIARIOS del BCE y reconvierte el valor de cada deal
// usando el tipo de SU PROPIA FECHA (no un tipo fijo).
//
// Un tipo fijo aplicado a seis meses de operaciones introduce un error silencioso
// en cualquier league table cross-currency. Los tipos a fecha de la operacion son
// lo que usan las tablas serias. Fuente: BCE (api.frankfurter.dev).
//
// Se puede llamar a mano o desde el cron diario. Idempotente.

import { supabaseAdmin } from '../../lib/supabase';

export const config = { maxDuration: 120 };

const CURRENCIES = ['USD', 'GBP', 'CAD', 'SEK', 'DKK', 'JPY', 'HKD', 'KRW', 'CHF', 'NOK', 'AUD', 'PLN'];
const API = 'https://api.frankfurter.dev/v1';

export default async function handler(req, res) {
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthed = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !isAuthed) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // 1) Rango de fechas que necesitamos cubrir (las fechas reales de los deals).
    const { data: bounds } = await supabaseAdmin
      .from('deals')
      .select('deal_date')
      .not('deal_date', 'is', null)
      .order('deal_date', { ascending: true })
      .limit(1);

    const from = bounds && bounds[0] ? bounds[0].deal_date : null;
    if (!from) return res.status(200).json({ ok: true, message: 'no hay deals con fecha' });

    const to = new Date().toISOString().split('T')[0];

    // 2) Serie temporal del BCE. Devuelve EUR -> X, hay que invertir.
    const url = `${API}/${from}..${to}?base=EUR&symbols=${CURRENCIES.join(',')}`;
    const r = await fetch(url);
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return res.status(502).json({ error: 'BCE no responde: ' + r.status, detail: t.slice(0, 200) });
    }
    const json = await r.json();
    const series = json.rates || {};

    const rows = [];
    for (const [date, byCur] of Object.entries(series)) {
      rows.push({ rate_date: date, currency: 'EUR', eur_per_1: 1 });
      for (const [cur, eurToCur] of Object.entries(byCur)) {
        const n = Number(eurToCur);
        if (!n || !isFinite(n)) continue;
        // El BCE da: 1 EUR = n CUR. Nosotros queremos: 1 CUR = 1/n EUR.
        rows.push({ rate_date: date, currency: cur, eur_per_1: 1 / n });
      }
    }

    // 3) Upsert por lotes.
    let saved = 0;
    for (let i = 0; i < rows.length; i += 800) {
      const chunk = rows.slice(i, i + 800);
      const { error } = await supabaseAdmin
        .from('fx_daily')
        .upsert(chunk, { onConflict: 'rate_date,currency' });
      if (error) return res.status(500).json({ error: error.message, saved });
      saved += chunk.length;
    }

    // 4) Reconvertir los deals con el tipo de SU fecha.
    //    Si ese dia no hay tipo (fin de semana, festivo), se usa el ultimo anterior.
    const { error: rpcErr } = await supabaseAdmin.rpc('recompute_value_eur');
    if (rpcErr) return res.status(500).json({ error: 'recompute: ' + rpcErr.message, saved });

    return res.status(200).json({ ok: true, rates_saved: saved, from, to });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
