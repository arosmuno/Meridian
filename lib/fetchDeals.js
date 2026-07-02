// lib/fetchDeals.js
// FREE engine — Google Gemini (free tier) with Google Search grounding.
// Replaces the paid Anthropic web-search call. Keeps the SAME exported
// function names and JSON output shape, so pages/api/cron.js needs NO changes.
//
// Requires env var: GEMINI_API_KEY  (free key from https://aistudio.google.com/apikey)

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Tipos que son mercado/macro (NO son operaciones): nunca llevan importe de deal.
const MARKET_TYPES = ['Macro', 'Earnings', 'Markets'];

// Rotate focus areas - each cron cycle covers different ground
const FOCUS_AREAS = [
  'M&A and LBO deals last 48h. Yahoo Finance, Reuters, Bloomberg, WSJ, FT.',
  'Leveraged finance, debt markets, ECM/IPO last 48h. Reuters IFR, Bloomberg, FT.',
  'European M&A and corporate deals last 48h. Expansion, Les Echos, Handelsblatt, FT.',
  'Central bank decisions, macro, earnings last 48h. Reuters, Bloomberg, El Economista.',
  'Project finance, infrastructure, restructuring last 48h. Reuters, Infrastructure Journal.',
  'Asia Pacific and EM deals last 48h. Reuters Asia, Nikkei, Bloomberg Asia.',
  'Law firm deal announcements, regulatory filings last 48h. SEC EDGAR, FCA RNS, CNMV.',
];

function getPrompt() {
  const focus = FOCUS_AREAS[Math.floor(Math.random() * FOCUS_AREAS.length)];
  const today = new Date().toISOString().split('T')[0];

  return `Use Google Search to find 8 REAL, recent financial news items. Focus: ${focus}

Today: ${today}. Report ONLY real, verifiable items with accurate figures. NEVER invent numbers.

Classify each item into EXACTLY one of two kinds and label it correctly:

A) DEAL (category "deal"): a single, specific TRANSACTION - M&A, LBO, ECM/IPO, debt issuance, project finance or restructuring - with an identifiable acquirer/issuer AND a target/asset. Its "value" MUST be the size of THAT transaction only:
   - M&A / LBO: enterprise or equity value of the deal
   - ECM / IPO: amount raised / offering size
   - Debt: principal amount issued
   - Fund raise: fund size
   If you cannot find the real transaction value, set value: 0. Use a deal type only when there is a genuine transaction.

B) MARKET / MACRO (category "macro"): central-bank decisions, rates, indices, earnings, or sector/market commentary. There is NO single transaction here, so "value" MUST be 0 and type MUST be Macro, Earnings or Markets.

CRITICAL rule about "value": it is the PRICE OF THE TRANSACTION and nothing else. NEVER put into "value" a market size, total addressable market, sector or industry total, a company revenue or market capitalisation, assets under management, index level, or any aggregate/market figure. If in doubt, use 0 and classify the item as Markets/Macro.

Output JSON array ONLY, no prose, no markdown fences:

[{"headline":"...","summary":"3-4 sentences with figures.","buyer":"acquirer/issuer or N/A","target":"target/asset or N/A","value":0,"currency":"EUR","type":"M&A","sector":"TMT","geography":"Europe","status":"Signed","date":"${today}","advisor":"N/A","source":"Reuters","source_channel":"news","category":"deal"}]

value: transaction size in millions (e.g. 35900 = 35.9 billion). 0 when there is no single transaction.
type: M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory  (real deals)  -  or  Macro|Earnings|Markets  (market/macro items)
status: Closed|Signed|Rumoured|Breaking|Published
geography: Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global
sector: Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|Macro|General
category: deal (real transaction with buyer/target/value) | macro (market, policy, earnings or sector commentary - value 0)`;
}

// Normaliza y refuerza la separacion deal / mercado, por si el modelo se salta reglas.
function normalize(arr) {
  return arr.map((d) => {
    const isMarket = MARKET_TYPES.includes(d.type) || d.category === 'macro';
    return {
      ...d,
      category: isMarket ? 'macro' : 'deal',
      // Los items de mercado/macro NUNCA llevan importe de operacion.
      value: isMarket ? 0 : d.value,
    };
  });
}

function parseDeals(text) {
  const clean = text.replace(/```json|```/gi, '');
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(clean.slice(start, end + 1));
    return Array.isArray(arr) && arr.length > 0 ? normalize(arr) : null;
  } catch { return null; }
}

async function callGemini({ prompt, useSearch }) {
  const key = process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
  if (!key) throw new Error('GEMINI_API_KEY missing');

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 8000, thinkingConfig: { thinkingBudget: 0 } },
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
    'List 4 significant, REAL transactions from 2026 (M&A/LBO/ECM/restructuring). ' +
    'Each must be a single deal with an identifiable buyer/issuer and target. ' +
    'The "value" field is the transaction size in millions ONLY - never a market size, ' +
    'sector total, revenue, market cap or any aggregate; use 0 if the real deal value is unknown. ' +
    '3-4 sentence summaries with figures. Return ONLY a JSON array: ' +
    '[{headline,summary,buyer,target,value(millions),currency,type(M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory),' +
    'sector(Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|General),' +
    'geography(Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global),' +
    'status(Closed|Signed|Rumoured|Breaking|Published),date,advisor,source,source_channel(news|lawfirms|regulatory),category(deal)}]';
  const text = await callGemini({ prompt, useSearch: false });
  return parseDeals(text);
}
