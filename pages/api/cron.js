import { fetchDealsFromWeb, backfillAnalysis, isIberianText } from '../../lib/fetchDeals';
import { supabaseAdmin } from '../../lib/supabase';
import { ineligibleReason } from '../../lib/eligibility';

export const config = { maxDuration: 300 };

// Rellena el analisis de filas recientes que se quedaron sin el (p. ej. si el LLM cayo).
// Pocas por ciclo para no comerse la cuota gratuita.
async function runBackfill() {
  try {
    const since = new Date(Date.now() - 10 * 86400000).toISOString();
    const { data } = await supabaseAdmin
      .from('deals')
      .select('id, headline, summary, buyer, target, value, currency, type')
      .is('analysis', null)
      .is('dup_of', null)
      .neq('category', 'duplicate')
      .neq('category', 'excluded')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(15);
    if (!data || !data.length) return 0;
    const filled = await backfillAnalysis(data);
    if (!filled) return 0;   // LLM caido: se reintenta en el siguiente ciclo
    let n = 0;
    for (const f of filled) {
      const { error } = await supabaseAdmin.from('deals').update({ analysis: f.analysis }).eq('id', f.id).is('analysis', null);
      if (!error) n++;
    }
    // Las que no pasaron el control de calidad se marcan con '' para no reintentarlas siempre:
    // el bloque de analisis no se muestra y la ficha queda solo con los hechos.
    const done = new Set(filled.map((f) => f.id));
    const skipped = data.filter((r) => !done.has(r.id)).map((r) => r.id);
    if (skipped.length) await supabaseAdmin.from('deals').update({ analysis: '' }).in('id', skipped).is('analysis', null);
    return n;
  } catch (e) {
    console.error('[CRON] backfill fallo:', e.message);
    return 0;
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthed = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isAuthed) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startedAt = new Date();
  console.log('[CRON] Starting at', startedAt.toISOString());

  const logRun = async (result) => {
    try {
      await supabaseAdmin.from('cron_runs').upsert(
        {
          job_name: 'deals',
          run_date: startedAt.toISOString().split('T')[0],
          started_at: startedAt.toISOString(),
          finished_at: new Date().toISOString(),
          result,
        },
        { onConflict: 'job_name,run_date' }
      );
    } catch (e) {
      console.error('[CRON] No se pudo registrar la ejecucion:', e.message);
    }
  };

  try {
    let deals;
    try {
      deals = await fetchDealsFromWeb();
      console.log(`[CRON] Feeds devolvieron ${deals?.length || 0} deals anclados`);
    } catch (e) {
      console.error('[CRON] fetchDealsFromWeb fallo:', e.message);
      await logRun({ fetched: 0, saved: 0, error: e.message });
      return res.status(200).json({ ok: true, saved: 0, message: `Fetch failed: ${e.message}` });
    }

    if (!deals || deals.length === 0) {
      // Un ciclo sin noticias es un resultado valido. No se rellena con nada.
      const backfilled = await runBackfill();
      await logRun({ fetched: 0, saved: 0, backfilled, message: 'sin titulares anclables' });
      return res.status(200).json({ ok: true, saved: 0, message: 'No deals found' });
    }

    const rows = [];
    let rejected = 0;

    for (const d of deals) {
      // ULTIMA LINEA DE DEFENSA: nada entra en la base sin URL de origen.
      if (!d.source_url || !d.source || !d.headline) {
        rejected++;
        console.warn('[CRON] Rechazado (sin source_url/source/headline):', d.headline || '(sin titular)');
        continue;
      }

      let deal_date = null;
      if (d.date) {
        const parsed = new Date(d.date);
        if (!isNaN(parsed)) deal_date = parsed.toISOString().split('T')[0];
      }

      rows.push({
        headline: d.headline,
        summary: d.summary,
        analysis: d.analysis || null,
        is_iberian: d.iberian === true || isIberianText(`${d.headline} ${d.buyer} ${d.target} ${d.summary}`),
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
        source: d.source,
        source_url: d.source_url,          // <- antes se perdia aqui
        image_url: d.image || null,        // <- antes se perdia aqui
        source_channel: d.source_channel || 'news',
        category: d.category || 'deal',
        fetched_at: new Date().toISOString(),
        data_source: 'live',
      });
      const last = rows[rows.length - 1];
      // Se publica en el feed, pero no cuenta para las league tables si no es una operacion cerrada/anunciada.
      if (last.category === 'deal') last.excluded_reason = ineligibleReason(last);
    }

    if (rejected) console.warn(`[CRON] ${rejected} registros rechazados por falta de fuente`);

    if (rows.length === 0) {
      await logRun({ fetched: deals.length, saved: 0, rejected, message: 'todos rechazados por falta de fuente' });
      return res.status(200).json({ ok: true, saved: 0, rejected });
    }

    const { error } = await supabaseAdmin
      .from('deals')
      .upsert(rows, { onConflict: 'headline', ignoreDuplicates: true });

    if (error) {
      console.error('[CRON] Supabase error:', error.message);
      await logRun({ fetched: deals.length, saved: 0, rejected, error: error.message });
      return res.status(500).json({ error: error.message });
    }

    console.log(`[CRON] Guardados ${rows.length} deals (${rejected} rechazados)`);
    const backfilled = await runBackfill();
    await logRun({ fetched: deals.length, saved: rows.length, rejected, backfilled });
    return res.status(200).json({ ok: true, saved: rows.length, rejected, backfilled });

  } catch (err) {
    console.error('[CRON] Fatal error:', err.message);
    await logRun({ error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
