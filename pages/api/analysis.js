// pages/api/analysis.js
// Análisis editorial vía Google Gemini (free tier). Sin Anthropic.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { deal, lang = 'en', langName = 'English' } = req.body || {};
  if (!deal) return res.status(400).json({ error: 'No deal provided' });

  const key = process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

  try {
    const c = deal.currency === 'USD' ? '$' : deal.currency === 'GBP' ? '£' : '€';
    const val = Number(deal.value) >= 1000
      ? `${c}${(Number(deal.value) / 1000).toFixed(1)}Bn`
      : `${c}${deal.value}M`;
    const langInstruction = lang !== 'en'
      ? `Write the analysis in ${langName}. Keep all financial terms, company names, numbers and deal values in their original form.`
      : '';

    const prompt = `You are a sharp M&A analyst writing editorial commentary for MERIDIAN, a premium capital markets publication. Write a substantial THREE-paragraph analysis (roughly 200-280 words, no headers, flowing prose) of this deal. Paragraph 1: the strategic rationale and what's really driving it. Paragraph 2: the financial and structural read (valuation, leverage, premium, financing). Paragraph 3: what it signals about broader market dynamics. Be direct and use precise financial language. ${langInstruction}

Deal: ${deal.headline}
Buyer: ${deal.buyer} | Target: ${deal.target} | Value: ${val} | Type: ${deal.type} | Sector: ${deal.sector}
${deal.summary}

Start directly with the analysis, no preamble:`;

    const r = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1600,
          // Flash activa "thinking" por defecto y se come el presupuesto → respuesta corta.
          // Lo desactivamos para que todos los tokens vayan a la respuesta visible.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(500).json({ error: 'Gemini error: ' + JSON.stringify(data).slice(0, 200) });
    }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const analysis = parts.map((p) => p.text).filter(Boolean).join('\n').trim() || 'Analysis unavailable.';
    return res.status(200).json({ analysis });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
