import { fetchDealsFromWeb } from '../../lib/fetchDeals';
import { supabaseAdmin } from '../../lib/supabase';

export const config = { maxDuration: 300 };

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
      await logRun({ fetched: 0, saved: 0, message: 'sin titulares anclables' });
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
    await logRun({ fetched: deals.length, saved: rows.length, rejected });
    return res.status(200).json({ ok: true, saved: rows.length, rejected });

  } catch (err) {
    console.error('[CRON] Fatal error:', err.message);
    await logRun({ error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
