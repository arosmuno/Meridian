// pages/api/analysis.js
// Análisis editorial vía Google Gemini (free tier), CON CACHÉ en Supabase.
// Se genera UNA vez por deal (clave: headline) y se reutiliza → evita rate limits.

import { supabaseAdmin } from '../../lib/supabase';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { deal } = req.body || {};
  if (!deal || !deal.headline) return res.status(400).json({ error: 'No deal provided' });

  // 1) ¿Ya está cacheado en la base de datos?
  try {
    const { data: existing } = await supabaseAdmin
      .from('deals')
      .select('analysis')
      .eq('headline', deal.headline)
      .limit(1)
      .maybeSingle();
    if (existing && existing.analysis) {
      return res.status(200).json({ analysis: existing.analysis, cached: true });
    }
  } catch (e) {
    // Si la columna no existe aún o falla la lectura, seguimos a generar (sin cachear).
  }

  const key = process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

  try {
    const c = deal.currency === 'USD' ? '$' : deal.currency === 'GBP' ? '£' : '€';
    const val = Number(deal.value) >= 1000
      ? `${c}${(Number(deal.value) / 1000).toFixed(1)}Bn`
      : `${c}${deal.value}M`;

    const prompt = `You are a sharp M&A analyst writing editorial commentary for MERIDIAN, a premium capital markets publication. Write a substantial THREE-paragraph analysis (roughly 200-280 words, no headers, flowing prose) of this deal. Paragraph 1: the strategic rationale and what's really driving it. Paragraph 2: the financial and structural read (valuation, leverage, premium, financing). Paragraph 3: what it signals about broader market dynamics. Be direct and use precise financial language.

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

    // 2) Guardar en caché (no bloqueante si falla)
    try {
      await supabaseAdmin.from('deals').update({ analysis }).eq('headline', deal.headline);
    } catch (e) { /* ignora si la columna no existe todavía */ }

    return res.status(200).json({ analysis });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
