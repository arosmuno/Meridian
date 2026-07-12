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
import { llmComplete } from './llm';

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
- source_channel: copy the channel shown in brackets next to the source headline you used (news | press release | regulatory | law firm).
- geography: Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global
- sector: use EXACTLY one of these and nothing else: Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|Materials|Hospitality|Macro|General. Never invent a new sector label.
- advisor: name the investment banks, advisers or law firms named in the headline or snippet, comma-separated (e.g. "Goldman Sachs, Rothschild & Co"). Use "N/A" ONLY when none is named -- never guess. This powers the CAREERS cross-reference (which firm worked the deal and is now hiring), so extract it whenever it is genuinely present.
- source_index: the NUMBER (1-44) of the EXACT headline from the HEADLINES list that this record is based on. This lets us attach the original article photo. If you cannot identify a single source headline, use 0.`;

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
    .slice(0, 44)
    .map((h, i) => `${i + 1}. [${h.source} · ${h.channel || 'news'}${h.date ? ', ' + h.date : ''}] ${h.title}${h.snippet ? ' - ' + h.snippet : ''}`)
    .join('\n');

  return `You are the editor of MERIDIAN, a European capital-markets newspaper. Today is ${today()}.

Below are REAL, fresh headlines pulled live from primary sources (regulators, PR wires, financial press). Select the 14 MOST newsworthy for an M&A / capital-markets audience -- prefer breadth: include every distinct real transaction you can, not just the biggest. Prioritise: European deals; M&A, LBOs, IPOs/ECM, debt financings, restructurings. Do NOT select two headlines that describe the SAME underlying transaction -- pick the single best one per deal. You may include at most 2 major macro/market items.

COVERAGE RULE: each headline is tagged with its channel. If the list contains headlines tagged "regulatory" (CMA, European Commission, SEC) or "law firm" (JD Supra) that concern a real merger, acquisition, clearance, phase-2 investigation or deal-related filing, you MUST select at least 2 of them. Merger clearances and antitrust probes are core Meridian content, NOT trivial filings. Only ignore genuinely trivial items (director changes, routine appointments, boilerplate results, tiny small-caps).

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

// Adjunta la imagen, el enlace y el CANAL del titular original (por source_index) a cada deal.
// El canal lo decide el FEED, no el LLM: asi 'regulatory' y 'law firm' no se pierden nunca.
function attachMedia(deals, heads) {
  return deals.map((d) => {
    const idx = Number(d.source_index) || 0;
    const h = idx >= 1 && idx <= heads.length ? heads[idx - 1] : null;
    const image = h && h.image ? h.image : '';
    const link = h && h.link ? h.link : '';
    const { source_index, ...rest } = d;
    return {
      ...rest,
      image,
      source_url: link,
      source_channel: (h && h.channel) || d.source_channel || 'news',
    };
  });
}

// --- Taxonomia canonica (el LLM se inventa etiquetas si no se le impone) ---
const SECTORS = new Set([
  'Healthcare', 'TMT', 'Infrastructure', 'Energy & Renewables', 'Financial Services',
  'Consumer', 'Industrials', 'Real Estate', 'Macro', 'General', 'Materials', 'Hospitality',
]);
const SECTOR_ALIAS = {
  technology: 'TMT', tech: 'TMT', telecom: 'TMT', telecoms: 'TMT', media: 'TMT', software: 'TMT',
  automotive: 'Industrials', logistics: 'Industrials', transport: 'Industrials',
  transportation: 'Industrials', defence: 'Industrials', defense: 'Industrials', aerospace: 'Industrials',
  utilities: 'Energy & Renewables', energy: 'Energy & Renewables', renewables: 'Energy & Renewables',
  'oil & gas': 'Energy & Renewables', power: 'Energy & Renewables',
  education: 'Consumer', retail: 'Consumer', 'food & beverage': 'Consumer', consumer_goods: 'Consumer',
  leisure: 'Hospitality', travel: 'Hospitality', hotels: 'Hospitality',
  banking: 'Financial Services', insurance: 'Financial Services', fintech: 'Financial Services',
  pharma: 'Healthcare', pharmaceuticals: 'Healthcare', biotech: 'Healthcare', 'life sciences': 'Healthcare',
  mining: 'Materials', chemicals: 'Materials', metals: 'Materials',
  construction: 'Infrastructure', 'real estate & construction': 'Real Estate',
};
function canonSector(s) {
  const raw = String(s || '').trim();
  if (SECTORS.has(raw)) return raw;
  return SECTOR_ALIAS[raw.toLowerCase()] || 'General';
}

// --- Nombres de fuente canonicos (WSJ / Wall Street Journal, FT / Financial Times...) ---
const SOURCE_ALIAS = {
  ft: 'Financial Times', 'financial times (ft)': 'Financial Times',
  wsj: 'Wall Street Journal', 'the wall street journal': 'Wall Street Journal',
  ifr: 'Reuters IFR',
  'cinco días': 'Cinco Dias', 'expansión': 'Expansion', 'les échos': 'Les Echos',
  'bloomberg news': 'Bloomberg', 'thomson reuters': 'Reuters',
  'globe newswire': 'GlobeNewswire', prnewswire: 'PR Newswire', businesswire: 'Business Wire',
  'infra journal': 'Infrastructure Journal', sec: 'SEC EDGAR', ec: 'European Commission',
};
function canonSource(s) {
  const raw = String(s || '').trim();
  return SOURCE_ALIAS[raw.toLowerCase()] || raw;
}

function normalize(arr) {
  // Deterministic guards so market/non-deal news never lands in the deals feed,
  // headline social/URL junk is stripped, and sector/source stay canonical.
  // Complements the LLM prompt (which the model ignores from time to time).
  const MARKET_TYPES = new Set(['Macro', 'Markets', 'Earnings']);
  const NON_DEAL = /\b(lay ?offs?|cuts? \d[\d,]* (?:jobs|roles|staff)|to cut jobs|fired|fine[ds]|lawsuit|tax court|court case|verdict|ruling|sentenced|acquitted|investigation|probe|bequeath|inheritance|shares? (?:soar|surge|jump|jumps|plunge|tumble|slump|slide|slides|sink|rally)|profit warning|resigns?|steps down)\b/i;
  const isNA = (s) => !s || /^n\/?a$/i.test(String(s).trim());
  const cleanHeadline = (h) => String(h || '')
    .replace(/\s*https?:\/\/\S+/gi, '')
    .replace(/\s*\|\s.*$/, '')
    .replace(/\s+—\s+(?:Publicación|Ver el perfil|.*\bLinkedIn\b).*/i, '')
    .trim();
  return arr.map((d) => {
    const headline = cleanHeadline(d.headline);
    const isMarket = MARKET_TYPES.has(d.type)
      || (isNA(d.buyer) && isNA(d.target))
      || NON_DEAL.test(headline);
    return {
      ...d,
      headline,
      sector: canonSector(d.sector),
      source: canonSource(d.source),
      category: isMarket ? 'macro' : 'deal',
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
  } catch {
    return null;
  }
}

// Enriquecimiento via motor multi-proveedor (Gemini flash-lite -> flash -> Groq): reparte
// la carga entre varias cuotas gratuitas y hace failover. useSearch se ignora (ya no usamos
// grounding; le damos titulares REALES para que solo estructure).
async function callGemini({ prompt }) {
  return await llmComplete({ prompt, maxTokens: 8000, temperature: 0.4 });
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
      if (deals && deals.length) return attachMedia(deals, heads.slice(0, 44));
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
