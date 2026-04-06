import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `You are a financial intelligence analyst. Search the web for 8-10 significant M&A, LBO, leveraged finance, project finance, ECM/IPO, and restructuring deals announced or closed in the last 30 days. Search across:
1. News: Reuters, Financial Times, Bloomberg, WSJ
2. Law firm press releases: Freshfields, Linklaters, Clifford Chance, Latham & Watkins, Skadden, Davis Polk
3. Regulatory filings: SEC EDGAR 8-K, FCA RNS, CNMV Spain, LSE RNS

Return ONLY a raw JSON array — no markdown fences, no explanation. Start directly with [

[{
  "headline": "Punchy specific headline about the deal",
  "summary": "2-3 sentences: what happened, rationale, why it matters to the market",
  "buyer": "Acquirer or issuer name",
  "target": "Target company or asset",
  "value": 2500,
  "currency": "EUR",
  "type": "M&A",
  "sector": "Technology",
  "status": "Signed",
  "date": "Apr 01, 2026",
  "advisor": "Goldman Sachs (buy-side) · Lazard (sell-side)",
  "source": "Reuters",
  "source_channel": "news"
}]

Rules:
- type must be: M&A | LBO | LevFin | Project Finance | ECM | Restructuring | Debt Advisory
- status must be: Closed | Signed | Rumoured | Breaking  
- source_channel must be: news | lawfirms | regulatory
- value is a number in millions (e.g. 1500 for €1.5Bn)
- Only include real verified deals from your search results`;

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
    messages: [{ role: 'user', content: PROMPT }],
  });

  const text = message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  return parseDeals(text);
}

export async function fetchDealsFromKnowledge() {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: `List 8 significant real M&A, LBO, leveraged finance, project finance, ECM, and restructuring deals from 2024-2025. Return ONLY a JSON array starting with [, no markdown. Schema: [{headline, summary, buyer, target, value(millions), currency, type(M&A|LBO|LevFin|Project Finance|ECM|Restructuring|Debt Advisory), sector, status(Closed|Signed|Rumoured|Breaking), date, advisor, source, source_channel(news|lawfirms|regulatory)}]`,
    }],
  });

  const text = message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  return parseDeals(text);
}
