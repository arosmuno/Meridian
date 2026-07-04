// lib/dealAnalysis.js -- generador del "Meridian Analysis" (comentario editorial de 3
// parrafos) via Google Gemini. Usa gemini-2.5-flash-lite (1000 req/dia, mas disponible
// que flash) y reintenta ante 503 (sobrecarga temporal) y 429 (cuota). SIN cache aqui:
// el que llama decide si guardar en Supabase.

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export async function generateAnalysis(deal) {
  const key = process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
  if (!key) throw new Error('GEMINI_API_KEY missing');
  if (!deal || !deal.headline) throw new Error('No deal provided');

  const c = deal.currency === 'USD' ? '$' : deal.currency === 'GBP' ? '£' : '€';
  const val = Number(deal.value) >= 1000
    ? `${c}${(Number(deal.value) / 1000).toFixed(1)}Bn`
    : `${c}${deal.value}M`;

  const prompt = `You are a sharp M&A analyst writing editorial commentary for MERIDIAN, a premium capital markets publication. Write a substantial THREE-paragraph analysis (roughly 200-280 words, no headers, flowing prose) of this deal. Paragraph 1: the strategic rationale and what's really driving it. Paragraph 2: the financial and structural read (valuation, leverage, premium, financing). Paragraph 3: what it signals about broader market dynamics. Be direct and use precise financial language.

Deal: ${deal.headline}
Buyer: ${deal.buyer} | Target: ${deal.target} | Value: ${val} | Type: ${deal.type} | Sector: ${deal.sector}
${deal.summary || ''}

Start directly with the analysis, no preamble:`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.6, maxOutputTokens: 1600, thinkingConfig: { thinkingBudget: 0 } },
  };

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      return parts.map((p) => p.text).filter(Boolean).join('\n').trim();
    }
    const code = (data && data.error && data.error.code) || r.status;
    lastErr = new Error('Gemini error: ' + JSON.stringify(data).slice(0, 200));
    if (code === 503 || code === 429) { await sleep(1400 * (attempt + 1)); continue; }
    throw lastErr;
  }
  throw lastErr;
}
