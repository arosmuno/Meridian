// lib/webResearch.js -- busqueda web de contexto para el "Meridian analysis".
//
// Se usa cuando el articulo de origen no se puede leer (fuentes de pago) y en la base de
// Meridian no hay operaciones previas de las mismas empresas. Dos vias:
//   1. Gemini con Google Search (grounding): resume los hechos y devuelve las fuentes.
//   2. Si falla o no hay clave: Bing News RSS + lectura de los articulos de dominios fiables.
// Solo cuentan fuentes de una lista de medios y fuentes primarias de confianza; si no sale
// ninguna, no se usa nada (mejor un analisis mas corto que uno apoyado en webs dudosas).

const UA = 'Mozilla/5.0 (compatible; MeridianNewsBot/1.0; +https://www.meridiancapmarkets.com)';

// Medios financieros, agencias, reguladores y fuentes primarias. Se compara por sufijo de dominio.
const TRUSTED = [
  'reuters.com', 'ft.com', 'bloomberg.com', 'wsj.com', 'economist.com', 'cnbc.com', 'barrons.com', 'apnews.com',
  'expansion.com', 'cincodias.elpais.com', 'elpais.com', 'eleconomista.es', 'elconfidencial.com', 'europapress.es',
  'lavanguardia.com', 'abc.es', 'elmundo.es', 'vozpopuli.com', 'lainformacion.com', 'eljornaldigital.com',
  'jornaldenegocios.pt', 'eco.sapo.pt', 'expresso.pt', 'publico.pt', 'observador.pt',
  'handelsblatt.com', 'faz.net', 'lesechos.fr', 'lefigaro.fr', 'ilsole24ore.com', 'milanofinanza.it', 'fd.nl',
  'pehub.com', 'privateequityinternational.com', 'infralogic.com', 'ijglobal.com', 'debtwire.com', 'mergermarket.com',
  'globalcapital.com', 'pitchbook.com', 'theglobeandmail.com', 'nikkei.com', 'scmp.com', 'axios.com',
  'prnewswire.com', 'globenewswire.com', 'businesswire.com', 'sec.gov', 'cnmv.es', 'cmvm.pt', 'europa.eu',
  'gov.uk', 'bde.es', 'ecb.europa.eu', 'boe.es',
];

function domainOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; }
}
export function isTrusted(u) {
  const d = domainOf(u);
  return !!d && TRUSTED.some((t) => d === t || d.endsWith('.' + t));
}

// Los enlaces de grounding de Gemini son redirecciones: se resuelven a la URL real.
async function resolveRedirect(u) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(u, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA }, signal: ctrl.signal });
    clearTimeout(t);
    return r.headers.get('location') || u;
  } catch (e) { return u; }
}

function query(deal) {
  const parts = [deal.buyer, deal.target].filter((x) => x && !/^n\/?a$/i.test(String(x).trim()));
  return parts.length ? `${parts.join(' ')} ${deal.type || ''}`.trim() : deal.headline;
}

// Via 1: Gemini + Google Search.
async function geminiResearch(deal) {
  const key = process.env.GEMINI_API_KEY || process.env.Gemini_Api_key;
  if (!key) return null;
  const prompt = `Search the web for reliable reporting on this news item and list the verifiable facts.

ITEM: ${deal.headline}
SUMMARY: ${deal.summary || ''}

Use only reputable financial press (Reuters, FT, Bloomberg, WSJ, Expansión, Cinco Días, El Economista, El Confidencial, Handelsblatt, Les Echos and similar), company press releases and regulators. Ignore blogs, forums, aggregators and AI-generated sites.
Return 6-12 short bullet points with concrete facts: deal terms, price, premium, financing, advisers, timeline, approvals, background of the parties, earlier related transactions. Put the date next to each fact when known. If you cannot find reliable reporting, answer exactly: NO RELIABLE SOURCES.`;
  for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 900 },
        }),
      });
      if (!r.ok) continue;
      const j = await r.json();
      const c = j.candidates && j.candidates[0];
      const text = ((c && c.content && c.content.parts) || []).map((p) => p.text).filter(Boolean).join('\n').trim();
      if (!text || /NO RELIABLE SOURCES/i.test(text)) return { facts: '', sources: [] };
      const chunks = (c.groundingMetadata && c.groundingMetadata.groundingChunks) || [];
      const raw = chunks.map((ch) => ch.web).filter(Boolean).slice(0, 8);
      const resolved = await Promise.all(raw.map(async (w) => ({ title: w.title || '', url: await resolveRedirect(w.uri) })));
      // El titulo del chunk suele ser el dominio: sirve de respaldo si la redireccion no se resuelve.
      const titleIsTrusted = (t) => { const d = String(t || '').replace(/^www\./, '').toLowerCase(); return TRUSTED.some((x) => d === x || d.endsWith('.' + x)); };
      const sources = resolved.filter((s) => isTrusted(s.url) || titleIsTrusted(s.title));
      if (!sources.length) return { facts: '', sources: [] };
      return { facts: text.slice(0, 3500), sources: dedupeSources(sources) };
    } catch (e) { /* siguiente modelo */ }
  }
  return null;
}

// Via 2: Bing News RSS (sin clave) y lectura de los articulos de dominios fiables.
async function bingResearch(deal, fetchArticle) {
  try {
    const u = 'https://www.bing.com/news/search?format=rss&q=' + encodeURIComponent(query(deal));
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    if (!r.ok) return { facts: '', sources: [] };
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const g = (tag) => ((m[1].match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      let link = g('link').replace(/&amp;/g, '&');
      try { const p = new URL(link); if (p.searchParams.get('url')) link = p.searchParams.get('url'); } catch (e) {}
      return { title: g('title'), url: link };
    }).filter((x) => isTrusted(x.url)).slice(0, 3);
    const texts = [];
    const sources = [];
    for (const it of items) {
      const t = await fetchArticle(it.url);
      if (t.length > 300) { texts.push(`[${domainOf(it.url)}] ${t.slice(0, 1800)}`); sources.push(it); }
    }
    return { facts: texts.join('\n\n').slice(0, 4000), sources: dedupeSources(sources) };
  } catch (e) {
    return { facts: '', sources: [] };
  }
}

function dedupeSources(list) {
  const seen = new Set();
  return list.filter((s) => { const k = s.url.split('?')[0]; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 5).map((s) => ({ title: String(s.title || domainOf(s.url)).slice(0, 140), url: s.url }));
}

export async function webResearch(deal, fetchArticle) {
  const g = await geminiResearch(deal);
  if (g && g.facts) return g;
  const b = await bingResearch(deal, fetchArticle);
  return b.facts ? b : { facts: '', sources: [] };
}
