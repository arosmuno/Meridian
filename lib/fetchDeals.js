// lib/fetchDeals.js
// Motor de noticias de MERIDIAN.
// NUEVO enfoque: en vez de "pedirle a Gemini que busque" (lento, con riesgo de
// inventar), tiramos de TITULARES REALES en tiempo real (RSS de reguladores,
// teletipos y prensa financiera europea via lib/sources.js), los rankeamos por
// autoridad+frescura y usamos Gemini SOLO para seleccionar y estructurar los
// mas relevantes. Si los feeds fallan, caemos al modo busqueda (fallback).
//
// Requiere env var: GEMINI_API_KEY

import { gatherHeadlines } from './sources';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MARKET_TYPES = ['Macro', 'Earnings', 'Markets'];

const SCHEMA_RULES = `
Output JSON array ONLY, no prose, no markdown fences:
[{"headline":"...","summary":"3-4 sentences with figures.","buyer":"acquirer/issuer or N/A","target":"target/asset or N/A","value":0,"currency":"EUR","type":"M&A","sector":"TMT","geography":"Europe","status":"Signed","date":"TODAY","advisor":"N/A","source":"Reuters","source_channel":"news","category":"deal","source_index":1}]

Rules:
- LANGUAGE: write EVERY "headline" and "summary" in ENGLISH. If a source headline is in Spanish, French, German or any other language, TRANSLATE it into clear, natural English. Keep company, brand and person names unchanged.
- HEADLINE: a clean, professional English newspaper headline about the deal itself. NEVER include a reporter\'s name, "on LinkedIn", social handles, URLs, or the outlet/source name inside the headline. No language other than English.
- DEAL (category "deal"): a single real TRANSACTION with an identifiable acquirer/issuer AND target/asset. "value" = size of THAT transaction ONLY, in millions (e.g. 35900 = 35.9bn). NEVER put a market size, sector total, revenue, market cap, AUM, index level or any aggregate into "value". If the real transaction value is unknown, use 0.
- MARKET/MACRO (category "macro"): central banks, rates, indices, earnings, sector/market commentary. "value" MUST be 0 and type MUST be Macro, Earnings or Markets.
- type (deals): M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory. type (market): Macro|Earnings|Markets.
- status: Closed|Signed|Rumoured|Breaking|Published
- geography: Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global
- sector: Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|Macro|General
- source_index: the NUMBER (1-40) of the EXACT headline from the HEADLINES list that this record is based on. This lets us attach the original article photo. If you cannot identify a single source headline, use 0.`;

// Foco aleatorio para el fallback de busqueda
const FOCUS_AREAS = [
  'M&A and LBO deals last 48h. Reuters, Bloomberg, WSJ, FT, Expansion.',
  'Leveraged finance, debt markets, ECM/IPO last 48h. Reuters IFR, Bloomberg, FT.',
  'European M&A and corporate deals last 48h. Expansion, Cinco Dias, Les Echos, Handelsblatt, FT.',
  'Central bank decisions, macro, earnings last 48h. Reuters, Bloomberg, El Economista.',
  'Project finance, infrastructure, restructuring last 48h. Reuters, Infrastructure Journal.',
];

function today() {
  return new Date().toISOString().split('T')[0];
}

// Prompt de ENRIQUECIMIENTO: le damos titulares reales y elige/estructura.
function enrichPrompt(heads) {
  const list = heads
    .slice(0, 40)
    .map((h, i) => `${i + 1}. [${h.source}${h.date ? ', ' + h.date : ''}] ${h.title}${h.snippet ? ' - ' + h.snippet : ''}`)
    .join('\n');

  return `You are the editor of MERIDIAN, a European capital-markets newspaper. Today is ${today()}.

Below are REAL, fresh headlines pulled live from primary sources (regulators, PR wires, financial press). Select the 14 MOST newsworthy for an M&A / capital-markets audience -- prefer breadth: include every distinct real transaction you can, not just the biggest. Prioritise: European deals; M&A, LBOs, IPOs/ECM, debt financings, restructurings. Do NOT select two headlines that describe the SAME underlying transaction -- pick the single best one per deal. You may include at most 2 major macro/market items. IGNORE trivial filings (director changes, routine appointments, tiny small-caps, boilerplate results).

For each selected item, output a structured record based ONLY on the headline and snippet provided. NEVER invent: if a transaction value is not clearly stated in the headline or snippet, set value: 0. Set "source" to the outlet that reported it. Set "date" to ${today()} if unknown.
${SCHEMA_RULES}

HEADLINES:
${list}`;
}

// Prompt de FALLBACK (busqueda) por si no hay feeds disponibles.
function searchPrompt() {
  const focus = FOCUS_AREAS[Math.floor(Math.random() * FOCUS_AREAS.length)];
  return `Use Google Search to find 8 REAL, recent financial news items. Focus: ${focus}
Today: ${today()}. Report ONLY real, verifiable items with accurate figures. NEVER invent numbers.
${SCHEMA_RULES}`;
}

// Adjunta la imagen y el enlace del titular original (por source_index) a cada deal.
function attachMedia(deals, heads) {
  return deals.map((d) => {
    const idx = Number(d.source_index) || 0;
    const h = idx >= 1 && idx <= heads.length ? heads[idx - 1] : null;
    const image = h && h.image ? h.image : '';
    const link = h && h.link ? h.link : '';
    const { source_index, ...rest } = d;
    return { ...rest, image, source_url: link };
  });
}

function normalize(arr) {
  return arr.map((d) => {
    const isMarket = MARKET_TYPES.includes(d.type) || d.category === 'macro';
    return { ...d, category: isMarket ? 'macro' : 'deal', value: isMarket ? 0 : d.value };
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
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function callGemini({ prompt, useSearch }) {
  const key = process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
  if (!key) throw new Error('GEMINI_API_KEY missing');

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 8000, thinkingConfig: { thinkingBudget: 0 } },
  };
  if (useSearch) body.tools = [{ google_search: {} }];

  // Reintenta ante 503 (sobrecarga temporal del free tier) y 429 (rate/quota).
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`${GEMINI_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      const parts = data?.candidates?.[0]?.content?.parts || [];
      return parts.map((p) => p.text).filter(Boolean).join('\n');
    }
    const code = data?.error?.code || r.status;
    lastErr = new Error('Gemini error: ' + JSON.stringify(data).slice(0, 300));
    if (code === 503 || code === 429) { await sleep(1500 * (attempt + 1)); continue; }
    throw lastErr; // error no reintentable
  }
  throw lastErr;
}

export async function fetchDealsFromWeb() {
  // 1) Intentar con titulares REALES de los feeds (rapido + fiable).
  let heads = [];
  try {
    heads = await gatherHeadlines();
  } catch {
    heads = [];
  }

  if (heads && heads.length >= 3) {
    try {
      // Sin google_search: la cuota de "grounding" del free tier se agota (429) y
      // tumba el cron. Ya le pasamos titulares REALES; Gemini solo estructura.
      const text = await callGemini({ prompt: enrichPrompt(heads), useSearch: false });
      const deals = parseDeals(text);
      if (deals && deals.length) return attachMedia(deals, heads.slice(0, 40));
    } catch {
      /* cae al fallback */
    }
  }

  // 2) Fallback: modo busqueda directa (por si los feeds fallan).
  const text = await callGemini({ prompt: searchPrompt(), useSearch: true });
  return parseDeals(text);
}

export async function fetchDealsFromKnowledge() {
  const prompt =
    'List 4 significant, REAL transactions from 2026 (M&A/LBO/ECM/restructuring). ' +
    'Each must be a single deal with an identifiable buyer/issuer and target. ' +
    'The "value" field is the transaction size in millions ONLY - never a market size, ' +
    'sector total, revenue, market cap or any aggregate; use 0 if the real deal value is unknown. ' +
    '3-4 sentence summaries with figures. Return ONLY a JSON array with keys: ' +
    'headline,summary,buyer,target,value,currency,type,sector,geography,status,date,advisor,source,source_channel,category.';
  const text = await callGemini({ prompt, useSearch: false });
  return parseDeals(text);
}
