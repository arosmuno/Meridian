// lib/dealAnalysis.js -- genera el "Meridian Analysis" (comentario editorial de 3 parrafos).
// Usa el motor multi-proveedor lib/llm.js (Gemini flash-lite -> flash -> Groq) para no
// quedarse sin cuota. SIN cache aqui: el que llama decide si guardar en Supabase.

import { llmComplete } from './llm';

export async function generateAnalysis(deal) {
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

  return await llmComplete({ prompt, maxTokens: 1600, temperature: 0.6 });
}
