// pages/api/cron.js
import { fetchDealsFromWeb, fetchDealsFromKnowledge } from '../../lib/fetchDeals';
import { supabaseAdmin } from '../../lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 300 };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LANG_INSTRUCTIONS = {
  es: 'European Spanish (Spain) — Castilian Spanish, NOT Latin American. Use Spain-specific financial vocabulary: "operación" not "negocio", "adquisición", "fusión", "consejo de administración".',
  fr: 'French — standard French financial terminology.',
  de: 'German — standard German financial terminology.',
};

async function translateBatch(items, lang) {
  const input = items.map(d => `${d.headline}|||${d.summary}`).join('###');
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [{
        role: 'user',
        content: `Translate to ${LANG_INSTRUCTIONS[lang]}\n\nKeep all company names, proper nouns, financial figures, percentages and deal values exactly as they are. Only translate surrounding text.\n\nInput format: HEADLINE|||SUMMARY###HEADLINE|||SUMMARY###...\nReturn ONLY translated content in exact same format, no explanation.\n\n${input}`,
      }],
    });
    const output = message.content[0]?.text || '';
    const parts = output.split('###');
    return items.map((_, i) => {
      const part = parts[i] || '';
      const split = part.split('|||');
      return { headline: split[0]?.trim() || null, summary: split[1]?.trim() || null };
    });
  } catch (e) {
    console.error(`[CRON] Translation ${lang} failed:`, e.message);
    return items.map(() => ({ headline: null, summary: null }));
  }
}

async function processDeals() {
  let deals = null;
  let source = 'live';

  try {
    deals = await fetchDealsFromWeb();
    console.log(`[CRON] Web search returned ${deals?.length || 0} deals`);
  } catch (e) {
    console.error('[CRON] Web search failed:', e.message);
  }

  if (!deals || deals.length < 3) {
    try {
      deals = await fetchDealsFromKnowledge();
      source = 'knowledge';
    } catch (e) {
      console.error('[CRON] Knowledge base failed:', e.message);
    }
  }

  if (!deals || deals.length === 0) return { saved: 0 };

  console.log(`[CRON] Translating ${deals.length} deals...`);
  const [transES, transFR, transDE] = await Promise.all([
    translateBatch(deals, 'es'),
    translateBatch(deals, 'fr'),
    translateBatch(deals, 'de'),
  ]);

  const rows = deals.map((d, i) => {
    let deal_date = null;
    if (d.date) {
      const parsed = new Date(d.date);
      if (!isNaN(parsed)) deal_date = parsed.toISOString().split('T')[0];
    }
    return {
      headline: d.headline,
      summary: d.summary,
      headline_es: transES[i]?.headline || null,
      summary_es: transES[i]?.summary || null,
      headline_fr: transFR[i]?.headline || null,
      summary_fr: transFR[i]?.summary || null,
      headline_de: transDE[i]?.headline || null,
      summary_de: transDE[i]?.summary || null,
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
      source: d.source || '',
      source_channel: d.source_channel || 'news',
      category: d.category || 'deal',
      fetched_at: new Date().toISOString(),
      data_source: source,
    };
  });

  const { error } = await supabaseAdmin
    .from('deals')
    .upsert(rows, { onConflict: 'headline', ignoreDuplicates: false });

  if (error) console.error('[CRON] Supabase error:', error);
  else console.log(`[CRON] Saved ${rows.length} deals with translations`);

  return { saved: rows.length, source };
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthed = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isAuthed) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('[CRON] Starting at', new Date().toISOString());
  res.status(200).json({ ok: true, message: 'Processing started' });

  try {
    await processDeals();
  } catch (err) {
    console.error('[CRON] Fatal error:', err);
  }
}
