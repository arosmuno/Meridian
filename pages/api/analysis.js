import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { deal, lang = 'en', langName = 'English' } = req.body;
  if (!deal) return res.status(400).json({ error: 'No deal provided' });

  try {
    const c = deal.currency === 'USD' ? '$' : deal.currency === 'GBP' ? '£' : '€';
    const val = Number(deal.value) >= 1000 ? `${c}${(Number(deal.value)/1000).toFixed(1)}Bn` : `${c}${deal.value}M`;
    const langInstruction = lang !== 'en' ? `Write the analysis in ${langName}. Keep all financial terms, company names, numbers and deal values in their original form.` : '';

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: `You are a sharp M&A analyst writing editorial commentary for MERIDIAN, a premium capital markets publication. Write a concise 3-paragraph analysis (no headers, flowing prose) of this deal. Be direct, use precise financial language, surface what the deal signals about broader market dynamics. ${langInstruction}

Deal: ${deal.headline}
Buyer: ${deal.buyer} | Target: ${deal.target} | Value: ${val} | Type: ${deal.type} | Sector: ${deal.sector}
${deal.summary}

Start directly with the analysis, no preamble:`,
      }],
    });

    const analysis = message.content[0]?.text || 'Analysis unavailable.';
    return res.status(200).json({ analysis });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
