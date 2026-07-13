// lib/fetchDeals.js
// Motor de noticias de MERIDIAN.
//
// INVARIANTE DURA: una fila solo existe si procede de un titular REAL de los feeds
// (lib/sources.js) y conserva su URL de origen. El LLM SOLO estructura y traduce
// titulares que ya tenemos delante. Nunca genera noticias.
//
// Si los feeds fallan, NO se publica nada. Un feed vacio es un feed vacio, no una
// invitacion a inventar. (El fallback anterior pedia "Use Google Search" a un modelo
// SIN acceso a busqueda -> se inventaba los deals y copiaba los nombres de medios
// del propio prompt. De ahi los ~295 deals fabricados con "Source: Reuters/WSJ/FT"
// y source_url NULL.)
//
// Requiere env var: GEMINI_API_KEY

import { gatherHeadlines } from './sources';
import { llmComplete } from './llm';

const SCHEMA_RULES = `
Output JSON array ONLY, no prose, no markdown fences:
[{"headline":"...","summary":"3-4 sentences with figures.","buyer":"acquirer/issuer or N/A","target":"target/asset or N/A","value":0,"currency":"EUR","type":"M&A","sector":"TMT","geography":"Europe","status":"Signed","date":"TODAY","advisor":"N/A","source_channel":"news","category":"deal","source_index":1}]

Rules:
- LANGUAGE: write EVERY "headline" and "summary" in ENGLISH. If a source headline is in Spanish, French, German or any other language, TRANSLATE it into clear, natural English. Keep company, brand and person names unchanged.
- HEADLINE: a clean, professional English newspaper headline about the deal itself. NEVER include a reporter's name, "on LinkedIn", social handles, URLs, or the outlet/source name inside the headline. No language other than English.
- GROUNDING (critical): every record MUST be based on exactly ONE headline from the HEADLINES list below. Use ONLY facts present in that headline and its snippet. If a fact is not there, do not state it. Never add figures, multiples, financing structures, advisers or dates that are not in the source text.
- DO NOT output a "source" field. The outlet is attached automatically from the source headline.
- DEAL (category "deal"): a single real TRANSACTION with an identifiable acquirer/issuer AND target/asset. "value" = size of THAT transaction ONLY, in millions (e.g. 35900 = 35.9bn). NEVER put a market size, sector total, revenue, market cap, AUM, index level or any aggregate into "value". If the real transaction value is not stated in the source text, use 0.
- MARKET/MACRO (category "macro"): central banks, rates, indices, earnings, sector/market commentary. "value" MUST be 0 and type MUST be Macro, Earnings or Markets.
- type (deals): M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory. type (market): Macro|Earnings|Markets.
- status: Closed|Signed|Rumoured|Breaking|Published
- source_channel: derive from the SOURCE outlet. GlobeNewswire, PR Newswire, Business Wire or any newswire/company release = press release. SEC, SEC EDGAR, CMA, European Commission, CNMV or ESMA and other regulators/filings = regulatory. A law firm such as names ending in LLP or JD Supra = law firm. Everything else = news.
- geography: Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global
- sector: Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|Macro|General
- source_index: the NUMBER (1-40) of the EXACT headline from the HEADLINES list that this record is based on. This is MANDATORY. If you cannot tie the record to a single headline in the list, DO NOT OUTPUT THE RECORD AT ALL. Never use 0.`;

function today() {
  return new Date().toISOString().split('T')[0];
}

function enrichPrompt(heads) {
  const list = heads
    .slice(0, 40)
    .map((h, i) => `${i + 1}. [${h.source}${h.date ? ', ' + h.date : ''}] ${h.title}${h.snippet ? ' - ' + h.snippet : ''}`)
    .join('\n');

  return `You are the editor of MERIDIAN, a European capital-markets newspaper. Today is ${today()}.

Below are REAL, fresh headlines pulled live from primary sources (regulators, PR wires, financial press). Select the 14 MOST newsworthy for an M&A / capital-markets audience -- prefer breadth: include every distinct real transaction you can, not just the biggest. Prioritise: European deals; M&A, LBOs, IPOs/ECM, debt financings, restructurings. Do NOT select two headlines that describe the SAME underlying transaction -- pick the single best one per deal. You may include at most 2 major macro/market items. IGNORE trivial filings (director changes, routine appointments, tiny small-caps, boilerplate results).

For each selected item, output a structured record based ONLY on the headline and snippet provided. You are a structuring engine, not a reporter: you may translate and reformat, never add. If a transaction value is not clearly stated in the headline or snippet, set value: 0.
${SCHEMA_RULES}

HEADLINES:
${list}`;
}

// Ancla cada deal a su titular real: adjunta outlet, URL e imagen DESDE el feed.
// Cualquier registro que no se pueda anclar a un titular con URL se DESCARTA.
function attachMedia(deals, heads) {
  const out = [];
  let dropped = 0;

  for (const d of deals) {
    const idx = Number(d.source_index) || 0;
    const h = idx >= 1 && idx <= heads.length ? heads[idx - 1] : null;

    // INVARIANTE: sin titular de origen o sin URL -> no se publica.
    if (!h || !h.link) {
      dropped++;
      continue;
    }

    const { source_index, source: _ignoredLlmSource, ...rest } = d;
    out.push({
      ...rest,
      source: h.source || '',   // el outlet SIEMPRE sale del feed, nunca del LLM
      source_url: h.link,
      image: h.image || '',
    });
  }

  if (dropped) console.warn(`[fetchDeals] Descartados ${dropped} registros sin titular de origen anclable`);
  return out;
}

function normalize(arr) {
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
    return { ...d, headline, category: isMarket ? 'macro' : 'deal', value: isMarket ? 0 : d.value };
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

async function callLlm({ prompt }) {
  return await llmComplete({ prompt, maxTokens: 8000, temperature: 0.2 });
}

/**
 * Devuelve deals SOLO si proceden de titulares reales con URL.
 * Si no hay feeds, devuelve [] — nunca inventa. No hay fallback generativo.
 */
export async function fetchDealsFromWeb() {
  let heads = [];
  try {
    heads = await gatherHeadlines();
  } catch (e) {
    console.error('[fetchDeals] gatherHeadlines fallo:', e.message);
    return [];
  }

  if (!heads || heads.length < 3) {
    console.warn(`[fetchDeals] Solo ${heads?.length || 0} titulares. No se publica nada.`);
    return [];
  }

  // Solo consideramos titulares que traigan URL: son los unicos anclables.
  const usable = heads.filter((h) => h && h.link).slice(0, 40);
  if (usable.length < 3) {
    console.warn('[fetchDeals] Titulares sin URL utilizable. No se publica nada.');
    return [];
  }

  let text;
  try {
    text = await callLlm({ prompt: enrichPrompt(usable) });
  } catch (e) {
    console.error('[fetchDeals] LLM fallo:', e.message);
    return [];   // el LLM caido NO es motivo para generar nada
  }

  const deals = parseDeals(text);
  if (!deals || !deals.length) return [];

  return attachMedia(deals, usable);
}
