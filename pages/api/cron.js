import { fetchDealsFromWeb, fetchDealsFromKnowledge } from '../../lib/fetchDeals';
import { supabaseAdmin } from '../../lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 300 };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Single API call translates ALL 3 languages at once to save rate limit
async function translateAllLanguages(items) {
  const input = items.map((d, i) => `[${i}] ${d.headline} ||| ${d.summary}`).join('\n---\n');
  try {
    // Wait 5 seconds after deal fetch to avoid rate limit burst
    await new Promise(r => setTimeout(r, 5000));

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [{
        role: 'user',
        content: `Translate each item below into 3 languages. Keep company names, figures, % unchanged.

Return ONLY this exact format for each item (no extra text):
[index]
ES: headline ||| summary
FR: headline ||| summary
DE: headline ||| summary
---

Items to translate:
${input}`,
      }],
    });

    const output = message.content[0]?.text || '';
    const results = items.map(() => ({
      es: { headline: null, summary: null },
      fr: { headline: null, summary: null },
      de: { headline: null, summary: null },
    }));

    // Parse the multi-language response
    const blocks = output.split('---').map(b => b.trim()).filter(Boolean);
    for (const block of blocks) {
      const indexMatch = block.match(/^\[(\d+)\]/);
      if (!indexMatch) continue;
      const idx = parseInt(indexMatch[1]);
      if (idx >= items.length) continue;

      const lines = block.split('\n');
      for (const line of lines) {
        const langMatch = line.match(/^(ES|FR|DE):\s*(.+)$/i);
        if (!langMatch) continue;
        const lang = langMatch[1].toLowerCase();
        const parts = langMatch[2].split('|||');
        if (parts.length >= 2 && results[idx][lang]) {
          results[idx][lang].headline = parts[0].trim();
          results[idx][lang].summary = parts[1].trim();
        }
      }
    }

    return results;
  } catch (e) {
    console.error('[CRON] Translation failed:', e.message);
    return items.map(() => ({
      es: { headline: null, summary: null },
      fr: { headline: null, summary: null },
      de: { headline: null, summary: null },
    }));
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const isAuthed = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isAuthed) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('[CRON] Starting at', new Date().toISOString());

  try {
    let deals = null;
    let source = 'live';

    // Step 1: Fetch deals (1 API call)
    try {
      deals = await fetchDealsFromWeb();
      console.log(`[CRON] Web search returned ${deals?.length || 0} deals`);
    } catch (e) {
      console.error('[CRON] Web search failed:', e.message);
    }

    if (!deals || deals.length < 2) {
      try {
        // Wait before fallback to avoid rate limit
        await new Promise(r => setTimeout(r, 5000));
        deals = await fetchDealsFromKnowledge();
        source = 'knowledge';
        console.log(`[CRON] Knowledge base returned ${deals?.length || 0} deals`);
      } catch (e) {
        console.error('[CRON] Knowledge base failed:', e.message);
      }
    }

    if (!deals || deals.length === 0) {
      return res.status(200).json({ ok: true, saved: 0, message: 'No deals found' });
    }

    // Step 2: Translate all languages in ONE call (1 API call instead of 3)
    console.log(`[CRON] Translating ${deals.length} deals (all languages in 1 call)...`);
    const translations = await translateAllLanguages(deals);

    // Step 3: Build rows and save
    const rows = deals.map((d, i) => {
      let deal_date = null;
      if (d.date) {
        const parsed = new Date(d.date);
        if (!isNaN(parsed)) deal_date = parsed.toISOString().split('T')[0];
      }
      const t = translations[i] || { es: {}, fr: {}, de: {} };
      return {
        headline: d.headline,
        summary: d.summary,
        headline_es: t.es?.headline || null,
        summary_es:  t.es?.summary  || null,
        headline_fr: t.fr?.headline || null,
        summary_fr:  t.fr?.summary  || null,
        headline_de: t.de?.headline || null,
        summary_de:  t.de?.summary  || null,
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
      .upsert(rows, { onConflict: 'headline', ignoreDuplicates: true });

    if (error) {
      console.error('[CRON] Supabase error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[CRON] Saved ${rows.length} deals with translations`);
    return res.status(200).json({ ok: true, saved: rows.length, source });

  } catch (err) {
    console.error('[CRON] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
