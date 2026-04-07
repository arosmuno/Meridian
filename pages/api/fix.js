// pages/api/fix.js
// One-time endpoint to translate existing deals and clean old ones
import { supabaseAdmin } from '../../lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LANG_INSTRUCTIONS = {
  es: 'European Spanish (Spain) — Castilian Spanish, NOT Latin American. Use Spain-specific financial vocabulary: "operación", "adquisición", "fusión", "consejo de administración".',
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
        content: `Translate to ${LANG_INSTRUCTIONS[lang]}\n\nKeep all company names, proper nouns, financial figures, percentages and deal values exactly as they are.\n\nInput format: HEADLINE|||SUMMARY###HEADLINE|||SUMMARY###...\nReturn ONLY translated content in exact same format, no explanation.\n\n${input}`,
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
    console.error(`[FIX] Translation ${lang} failed:`, e.message);
    return items.map(() => ({ headline: null, summary: null }));
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 1. Delete deals older than 45 days to keep DB fresh
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 45);
  const { error: deleteError, count: deleted } = await supabaseAdmin
    .from('deals')
    .delete({ count: 'exact' })
    .lt('fetched_at', cutoff.toISOString());

  if (deleteError) console.error('[FIX] Delete error:', deleteError.message);

  // 2. Get all deals without translations
  const { data: deals, error: fetchError } = await supabaseAdmin
    .from('deals')
    .select('id, headline, summary')
    .is('headline_es', null)
    .limit(50);

  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!deals || deals.length === 0) return res.status(200).json({ ok: true, translated: 0, deleted: deleted || 0 });

  // Respond immediately
  res.status(200).json({ ok: true, message: `Translating ${deals.length} deals...`, deleted: deleted || 0 });

  // 3. Translate in batch
  const [transES, transFR, transDE] = await Promise.all([
    translateBatch(deals, 'es'),
    translateBatch(deals, 'fr'),
    translateBatch(deals, 'de'),
  ]);

  // 4. Update each deal
  for (let i = 0; i < deals.length; i++) {
    const { error: updateError } = await supabaseAdmin
      .from('deals')
      .update({
        headline_es: transES[i]?.headline || null,
        summary_es:  transES[i]?.summary  || null,
        headline_fr: transFR[i]?.headline || null,
        summary_fr:  transFR[i]?.summary  || null,
        headline_de: transDE[i]?.headline || null,
        summary_de:  transDE[i]?.summary  || null,
      })
      .eq('id', deals[i].id);

    if (updateError) console.error(`[FIX] Update ${deals[i].id} failed:`, updateError.message);
  }

  console.log(`[FIX] Done. Translated ${deals.length} deals, deleted ${deleted || 0} old ones.`);
}
