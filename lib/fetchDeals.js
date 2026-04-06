import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `You are a senior financial journalist and M&A analyst. Search the web for 8-10 significant M&A, LBO, leveraged finance, project finance, ECM/IPO, and restructuring deals announced or closed in the last 30 days. Search across these sources:

INTERNATIONAL: Reuters, Financial Times, Bloomberg, Wall Street Journal, Dow Jones
SPANISH: Expansión, Cinco Días, El Economista, El País Economía, CNMV.es
FRENCH: Les Echos, La Tribune, BFM Business, AMF France
GERMAN: Handelsblatt, Manager Magazin, Börsen-Zeitung, BaFin
ITALIAN: Il Sole 24 Ore, MilanoFinanza
LAW FIRMS: Freshfields, Linklaters, Clifford Chance, Latham & Watkins, Skadden, Uría Menéndez, Cuatrecasas
REGULATORY: SEC EDGAR 8-K, FCA RNS, CNMV Spain, LSE RNS

For each deal write a DETAILED 4-6 sentence summary: what happened, strategic rationale, deal structure/financing (equity, debt, multiples, premiums), and market significance. Be specific with numbers.

Return ONLY a raw JSON array — no markdown fences, no explanation. Start directly with [

[{
  "headline": "Punchy specific headline",
  "summary": "4-6 sentences: parties, structure, rationale, market context. Specific numbers, multiples, premiums.",
  "buyer": "Acquirer name",
  "target": "Target name",
  "value": 2500,
  "currency": "EUR",
  "type": "M&A",
  "sector": "Healthcare",
  "geography": "Europe",
  "status": "Signed",
  "date": "Apr 01, 2026",
  "advisor": "Goldman Sachs (buy-side)",
  "source": "Expansión",
  "source_channel": "news"
}]

Rules:
- type: M&A | LBO | LevFin | Project Finance | ECM | Restructuring | Debt Advisory
- status: Closed | Signed | Rumoured | Breaking
- source_channel: news | lawfirms | regulatory
- geography: Europe | North America | Asia Pacific | Latin America | Middle East & Africa | Global
- sector: Healthcare | TMT | Infrastructure | Energy & Renewables | Financial Services | Consumer | Industrials | Real Estate | General
- value in millions, summary minimum 4 sentences
- Prioritise European deals especially Spanish, French, German markets`;

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
