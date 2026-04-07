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
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return `You are a senior financial journalist. Today is ${today}. Search the web and find 8-10 RECENT financial news stories with this focus: ${focus}

IMPORTANT: Only include stories from the last 48-72 hours maximum. Do NOT repeat well-known older deals. Search specifically for what is NEW and RECENT today.

For each story write a DETAILED 4-6 sentence summary including: what happened, specific financial details (amounts, rates, multiples, premiums, % changes), strategic or macro context, and market significance.

Return ONLY a raw JSON array — no markdown fences, no explanation. Start directly with [

[{
  "headline": "Punchy specific headline with company names and figures",
  "summary": "4-6 sentences with specific numbers, context and significance.",
  "buyer": "Company/institution or 'N/A' for macro",
  "target": "Target company, asset, or topic",
  "value": 2500,
  "currency": "EUR",
  "type": "M&A",
  "sector": "Healthcare",
  "geography": "Europe",
  "status": "Signed",
  "date": "Apr 07, 2026",
  "advisor": "Goldman Sachs (buy-side) or 'N/A'",
  "source": "Reuters",
  "source_channel": "news",
  "category": "deal"
}]

Rules:
- type: M&A | LBO | LevFin | Project Finance | ECM | Restructuring | Debt Advisory | Macro | Earnings | Markets
- status: Closed | Signed | Rumoured | Breaking | Published
- source_channel: news | lawfirms | regulatory
- geography: Europe | North America | Asia Pacific | Latin America | Middle East & Africa | Global
- sector: Healthcare | TMT | Infrastructure | Energy & Renewables | Financial Services | Consumer | Industrials | Real Estate | Macro | General
- category: deal | macro
- value: number in millions, 0 for macro/earnings
- date: today's date or the actual announcement date if known
- Only include REAL stories you found in your search, not fabricated ones`;
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
