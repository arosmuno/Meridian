import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Rotate focus areas so each cron cycle covers different ground
const FOCUS_AREAS = [
  'M&A and LBO deals announced in the last 48 hours. Search Yahoo Finance, Reuters M&A, Bloomberg Deals, WSJ Deal Journal, FT Lex.',
  'Leveraged finance, debt markets, and ECM/IPO activity from the last 48 hours. Search Reuters IFR, Bloomberg Capital Markets, FT Capital Markets.',
  'European M&A and corporate deals from the last 48 hours. Search Expansión, Cinco Días, Les Echos, Handelsblatt, Il Sole 24 Ore, FT Europe.',
  'Central bank decisions, macro news, and significant earnings from the last 48 hours. Search Reuters, Bloomberg Economics, El Economista, Börsen-Zeitung.',
  'Project finance, infrastructure deals, and restructuring from the last 48 hours. Search Reuters Project Finance, Infrastructure Journal, Reorg.',
  'Asia Pacific and emerging market deals from the last 48 hours. Search Reuters Asia, Nikkei, South China Morning Post, Bloomberg Asia.',
  'Law firm deal announcements and regulatory filings from the last 48 hours. Search Freshfields, Linklaters, Clifford Chance, Latham, Skadden, Uría Menéndez press releases, SEC EDGAR 8-K, FCA RNS, CNMV Spain.',
];

function getPrompt() {
  const focus = FOCUS_AREAS[Math.floor(Date.now() / (10 * 60 * 1000)) % FOCUS_AREAS.length];
  const today = new Date().toISOString().split('T')[0];

  return `Search the web for 6 recent financial news stories (last 48h). Focus: ${focus}

Today: ${today}. Only REAL recent stories. Return JSON array only, no markdown:

[{"headline":"...","summary":"3-4 sentences with figures.","buyer":"...","target":"...","value":0,"currency":"EUR","type":"M&A","sector":"TMT","geography":"Europe","status":"Signed","date":"${today}","advisor":"N/A","source":"Reuters","source_channel":"news","category":"deal"}]

type: M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory|Macro|Earnings|Markets
status: Closed|Signed|Rumoured|Breaking|Published
geography: Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global
sector: Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|Macro|General
category: deal|macro`;
}

function parseDeals(text) {
  const clean = text.replace(/\`\`\`json|\`\`\`/gi, '');
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(clean.slice(start, end + 1));
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch { return null; }
}

export async function fetchDealsFromWeb() {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: getPrompt() }],
  });
  const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  return parseDeals(text);
}

export async function fetchDealsFromKnowledge() {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: 'List 8 significant real M&A, LBO, leveraged finance, project finance, ECM, and restructuring deals from early 2026. For each deal write a detailed 4-6 sentence summary with financial specifics. Return ONLY a JSON array starting with [, no markdown. Schema: [{headline, summary, buyer, target, value(millions), currency, type(M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory), sector(Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|General), geography(Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global), status(Closed|Signed|Rumoured|Breaking|Published), date, advisor, source, source_channel(news|lawfirms|regulatory), category(deal|macro)}]',
    }],
  });
  const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  return parseDeals(text);
}
