import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  return `Find 4 real financial news stories from the last 48 hours. Focus: ${focus}

Today: ${today}. Only REAL verifiable stories. Return JSON array only:

[{"headline":"...","summary":"3-4 sentences with figures.","buyer":"...","target":"...","value":0,"currency":"EUR","type":"M&A","sector":"TMT","geography":"Europe","status":"Signed","date":"${today}","advisor":"N/A","source":"Reuters","source_channel":"news","category":"deal"}]

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

export async function fetchDealsFromWeb() {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: getPrompt() }],
  });
  const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  return parseDeals(text);
}

export async function fetchDealsFromKnowledge() {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: 'List 4 significant real M&A/LBO/ECM/restructuring deals from early 2026. 3-4 sentence summaries with figures. Return ONLY JSON array: [{headline,summary,buyer,target,value(millions),currency,type(M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory),sector(Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|General),geography(Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global),status(Closed|Signed|Rumoured|Breaking|Published),date,advisor,source,source_channel(news|lawfirms|regulatory),category(deal|macro)}]',
    }],
  });
  const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  return parseDeals(text);
}
