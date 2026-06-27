// lib/fetchDeals.js
// FREE engine — Google Gemini (free tier) with Google Search grounding.
// Replaces the paid Anthropic web-search call. Keeps the SAME exported
// function names and JSON output shape, so pages/api/cron.js needs NO changes.
//
// Requires env var: GEMINI_API_KEY  (free key from https://aistudio.google.com/apikey)

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Rotate focus areas - each cron cycle covers different ground
const FOCUS_AREAS = [
  'M&A and LBO deals last 48h. Yahoo Finance, Reuters, Bloomberg, WSJ, FT.',
  'Leveraged finance, debt markets, ECM/IPO last 48h. Reuters IFR, Bloomberg, FT.',
  'European M&A and corporate deals last 48h. Expansión, Les Echos, Handelsblatt, FT.',
  'Central bank decisions, macro, earnings last 48h. Reuters, Bloomberg, El Economista.',
  'Project finance, infrastructure, restructuring last 48h. Reuters, Infrastructure Journal.',
  'Asia Pacific and EM deals last 48h. Reuters Asia, Nikkei, Bloomberg Asia.',
  'Law firm deal announcements, regulatory filings last 48h. SEC EDGAR, FCA RNS, CNMV.',
];

function getPrompt() {
  const focus = FOCUS_AREAS[Math.floor(Date.now() / (10 * 60 * 1000)) % FOCUS_AREAS.length];
  const today = new Date().toISOString().split('T')[0];

  return `Use Google Search to find 4 REAL financial news stories from the last 48 hours. Focus: ${focus}

Today: ${today}. Only REAL, verifiable stories with accurate figures. Output JSON array ONLY, no prose, no markdown fences:

[{"headline":"...","summary":"3-4 sentences with figures.","buyer":"...","target":"...","value":0,"currency":"EUR","type":"M&A","sector":"TMT","geography":"Europe","status":"Signed","date":"${today}","advisor":"N/A","source":"Reuters","source_channel":"news","category":"deal"}]

value: in millions (e.g. 35900 for 35.9 billion)
type: M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory|Macro|Earnings|Markets
status: Closed|Signed|Rumoured|Breaking|Published
geography: Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global
sector: Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|Macro|General
category: deal|macro`;
}

function parseDeals(text) {
  const clean = text.replace(/```json|```/gi, '');
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(clean.slice(start, end + 1));
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch { return null; }
}

async function callGemini({ prompt, useSearch }) {
  // Acepta ambas grafías del nombre de la variable (por si difiere el casing en Vercel)
  const key = process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
  if (!key) throw new Error('GEMINI_API_KEY missing');

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 4000 },
  };
  if (useSearch) body.tools = [{ google_search: {} }];

  const r = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    throw new Error('Gemini error: ' + JSON.stringify(data).slice(0, 300));
  }
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text).filter(Boolean).join('\n');
}

export async function fetchDealsFromWeb() {
  const text = await callGemini({ prompt: getPrompt(), useSearch: true });
  return parseDeals(text);
}

export async function fetchDealsFromKnowledge() {
  const prompt =
    'List 4 significant real M&A/LBO/ECM/restructuring deals from 2026. ' +
    '3-4 sentence summaries with figures. Return ONLY a JSON array: ' +
    '[{headline,summary,buyer,target,value(millions),currency,type(M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory),' +
    'sector(Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|General),' +
    'geography(Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global),' +
    'status(Closed|Signed|Rumoured|Breaking|Published),date,advisor,source,source_channel(news|lawfirms|regulatory),category(deal|macro)}]';
  const text = await callGemini({ prompt, useSearch: false });
  return parseDeals(text);
}
