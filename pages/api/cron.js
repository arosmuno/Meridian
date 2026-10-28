import { fetchDealsFromWeb, isIberianText, translateRows } from '../../lib/fetchDeals';
import { processPending } from '../../lib/dataroom/embed';
import { sweepWatermarks } from '../../lib/dataroom/delivery';
import { upgradePending } from '../../lib/dataroom/upgrade';
import { looksSpanish } from '../../lib/eligibility';
import { writeAnalysis } from '../../lib/analysisWriter';
import { supabaseAdmin } from '../../lib/supabase';
import { ineligibleReason } from '../../lib/eligibility';

export const config = { maxDuration: 300 };

// Rellena el analisis de filas recientes que se quedaron sin el (p. ej. si el LLM cayo).
// Pocas por ciclo para no comerse la cuota gratuita.
async function runBackfill() {
  // 1) Titulares que el modelo dejo en espanol: se traducen (el diario es en ingles y la
  //    portada los ocultaba, asi que se perdian justo las noticias ibericas).
  try {
    const since = new Date(Date.now() - 10 * 86400000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from('deals').select('id, headline, summary')
      .gte('created_at', since).neq('category', 'excluded')
      .order('created_at', { ascending: false }).limit(400);
    const es = (recent || []).filter((r) => looksSpanish(r.headline)).slice(0, 15);
    if (es.length) {
      const tr = await translateRows(es);
      for (const t of tr) {
        await supabaseAdmin.from('deals').update({ headline: t.headline, summary: t.summary }).eq('id', t.id);
      }
    }
  } catch (e) {
    console.error('[CRON] traduccion fallo:', e.message);
  }
  // 2) Meridian analysis largo (2-3 parrafos) para las filas recientes que no lo tienen.
  //    Primero operaciones y despues mercado; pocas por ciclo para no agotar la cuota gratuita.
  try {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const cols = 'id, analysis_attempts, headline, summary, buyer, target, value, currency, type, sector, geography, status, is_iberian, source, source_url, category';
    const pick = async (cat, n) => {
      const { data } = await supabaseAdmin.from('deals').select(cols)
        .is('analysis', null).is('dup_of', null).eq('category', cat)
        .gte('created_at', since).order('created_at', { ascending: false }).limit(n);
      return data || [];
    };
    // Hasta 8 por pasada, de uno en uno: los limites gratuitos de Groq son por minuto y en
    // paralelo se agotaban. Se para a los 200 s para no pasar del limite de 300 s de la funcion.
    const rows = [...(await pick('deal', 6)), ...(await pick('macro', 2))];
    if (!rows.length) return 0;
    const t0 = Date.now();
    let n = 0;
    for (const r of rows) {
      if (Date.now() - t0 > 200000) break;
      const res = await writeAnalysis(supabaseAdmin, r);
      if (res === null) break;                       // modelos sin cuota: se reintenta en el siguiente ciclo
      // Rechazado por el control de calidad: hasta 3 intentos (cada borrador sale distinto);
      // despues se deja vacio y no se vuelve a intentar.
      const attempts = (r.analysis_attempts || 0) + 1;
      if (!res.text && attempts < 3) {
        await supabaseAdmin.from('deals').update({ analysis_attempts: attempts }).eq('id', r.id);
        continue;
      }
      const patch = { analysis: res.text || '', analysis_attempts: attempts };
      if (res.text && res.sources && res.sources.length) patch.analysis_sources = res.sources;
      const { error } = await supabaseAdmin.from('deals').update(patch).eq('id', r.id).is('analysis', null);
      if (!error && res.text) n++;
    }
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
    // Dataroom: rematar documentos a medio indexar y borrar copias con marca de agua caducadas.
    try { await processPending({ deadline: Date.now() + 15000 }); await sweepWatermarks(); await upgradePending({ deadline: Date.now() + 45000 }); } catch (e) { console.error('[CRON] dataroom:', e.message); }
      await logRun({ fetched: 0, saved: 0, backfilled, message: 'sin titulares anclables' });
      return res.status(200).json({ ok: true, saved: 0, message: 'No deals found' });
    }

    // Lo que el modelo dejo en espanol se traduce antes de guardar.
    try {
      const es = deals.map((d, i) => ({ ...d, id: i })).filter((d) => looksSpanish(d.headline));
      if (es.length) {
        const tr = await translateRows(es);
        for (const t of tr) { deals[t.id].headline = t.headline; deals[t.id].summary = t.summary; }
      }
    } catch (e) { console.error('[CRON] traduccion previa fallo:', e.message); }

    const rows = [];
    let rejected = 0;

    for (const d of deals) {
      // ULTIMA LINEA DE DEFENSA: nada entra en la base sin URL de origen.
      if (!d.source_url || !d.source || !d.headline) {
        rejected++;
        console.warn('[CRON] Rechazado (sin source_url/source/headline):', d.headline || '(sin titular)');
        continue;
      }

      let deal_date = new Date().toISOString().split('T')[0];
      if (d.date && !/^today$/i.test(String(d.date).trim())) {
        const parsed = new Date(d.date);
        if (!isNaN(parsed)) deal_date = parsed.toISOString().split('T')[0];
      }

      rows.push({
        headline: d.headline,
        summary: d.summary,
        analysis: null,   // el analisis largo lo escribe runBackfill (lib/analysisWriter.js)
        is_iberian: d.iberian === true || isIberianText(`${d.headline} ${d.buyer} ${d.target} ${d.summary}`),
        buyer: d.buyer || 'N/A',
        target: d.target || 'N/A',
        value: Number(d.value) || 0,
        currency: d.currency || 'EUR',
        type: d.type || 'M&A',
        sector: d.sector || 'General',
        geography: d.geography || 'Global',
        status: d.status || 'Signed',
        date: deal_date,
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
      try { await processPending({ deadline: Date.now() + 15000 }); await sweepWatermarks(); await upgradePending({ deadline: Date.now() + 45000 }); } catch (e) { console.error('[CRON] dataroom:', e.message); }
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
