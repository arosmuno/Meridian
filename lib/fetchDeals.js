import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `You are a senior financial journalist combining the depth of Expansión with the editorial voice of a premium capital markets publication. Search the web for 10-12 significant financial stories from the last 30 days across TWO categories:

CATEGORY A — DEALS (6-8 stories): M&A, LBO, leveraged finance, project finance, ECM/IPO, restructuring. Sources: Reuters, FT, Bloomberg, WSJ, Expansión, Cinco Días, Les Echos, Handelsblatt, Il Sole 24 Ore, Freshfields/Linklaters/Clifford Chance press releases, SEC EDGAR 8-K, FCA RNS, CNMV Spain.

CATEGORY B — MARKETS & MACRO (3-4 stories): Central bank decisions (ECB, Fed, BoE), significant earnings results (IBEX 35, DAX, FTSE, S&P 500 companies), sovereign debt moves, currency market events, significant IPO performances, credit market developments. Sources: same as above plus El País Economía, El Economista, Börsen-Zeitung.

For each story write a DETAILED 4-6 sentence summary: what happened, the financial details (rates, multiples, % changes, amounts), strategic or macroeconomic context, and market significance.

Return ONLY a raw JSON array — no markdown fences, no explanation. Start directly with [

[{
  "headline": "Punchy specific headline",
  "summary": "4-6 sentences: specific figures, context, market significance.",
  "buyer": "Company, institution or 'N/A' for macro",
  "target": "Target, asset, or topic (e.g. 'ECB Rate Decision')",
  "value": 2500,
  "currency": "EUR",
  "type": "M&A",
  "sector": "Healthcare",
  "geography": "Europe",
  "status": "Signed",
  "date": "Apr 01, 2026",
  "advisor": "Goldman Sachs (buy-side) or 'N/A'",
  "source": "Expansión",
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
- value: set to 0 for macro/earnings stories
- Prioritise European stories especially Spanish, French and German markets
- summary minimum 4 sentences with specific financial figures`;

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
    messages: [{ role: 'user', content: PROMPT }],
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
      content: 'List 8 significant real M&A, LBO, leveraged finance, project finance, ECM, and restructuring deals from 2024-2025. For each deal write a detailed 4-6 sentence summary with financial specifics including multiples, premiums, and strategic rationale. Return ONLY a JSON array starting with [, no markdown. Schema: [{headline, summary, buyer, target, value(millions), currency, type(M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory), sector(Healthcare|TMT|Infrastructure|Energy & Renewables|Financial Services|Consumer|Industrials|Real Estate|General), geography(Europe|North America|Asia Pacific|Latin America|Middle East & Africa|Global), status(Closed|Signed|Rumoured|Breaking), date, advisor, source, source_channel(news|lawfirms|regulatory)}]',
    }],
  });
  const text = message.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  return parseDeals(text);
}
