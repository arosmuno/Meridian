// lib/analysisWriter.js -- escribe el "Meridian analysis" largo (2-3 parrafos) de cada noticia.
//
// Para que un texto de dos parrafos aporte algo sin inventarse nada, el modelo recibe:
//   1. el texto del articulo de origen (si la pagina se puede leer; muchas de pago no),
//   2. operaciones relacionadas que YA estan en la base de Meridian (mismo comprador,
//      mismo objetivo o mismo sector en los ultimos 90 dias), con su fecha e importe.
// Regla de grounding: cifras, nombres y hechos solo de esas dos fuentes. El contexto general
// (como funciona un take-private, que mira un lender en un project finance...) se permite,
// pero sin numeros ni afirmaciones sobre la empresa que no esten en la fuente.

import { llmComplete, llmPrecise } from './llm';
import { cleanAnalysis } from './analysisQuality';
import { webResearch, researchLog } from './webResearch';

const UA = 'Mozilla/5.0 (compatible; MeridianNewsBot/1.0; +https://www.meridiancapmarkets.com)';

function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>|<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

// Texto del articulo: los parrafos largos, que es donde esta la noticia (no menus ni pies).
export async function fetchArticle(url) {
  if (!url) return '';
  let target = url;
  // Los enlaces de Google Alerts envuelven la URL real.
  try { const u = new URL(url.replace(/&amp;/g, '&')); if (u.hostname.endsWith('google.com') && u.searchParams.get('url')) target = u.searchParams.get('url'); } catch (e) {}
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const r = await fetch(target, { headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(t);
    if (!r.ok) return '';
    const text = htmlToText(await r.text());
    const paras = text.split('\n').map((p) => p.trim()).filter((p) => p.length > 120 && !/cookie|subscribe|suscr[ií]b|newsletter|all rights reserved|todos los derechos/i.test(p));
    return paras.join('\n').slice(0, 6000);
  } catch (e) {
    return '';
  }
}

// Operaciones relacionadas de la propia base: mismo comprador / objetivo, o mismo sector y region.
export async function relatedDeals(db, deal) {
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const words = (s) => String(s || '').split(/[,/&]| and /i).map((x) => x.trim()).filter((x) => x.length >= 3 && !/^n\/?a$/i.test(x)).slice(0, 2);
  const targetNames = words(deal.target);
  const names = [...words(deal.buyer), ...targetNames];
  const out = new Map();
  let companyHits = 0;
  try {
    for (const n of names) {
      const first = n.split(/\s+/)[0].replace(/[%_]/g, '');
      if (first.length < 3) continue;
      const { data } = await db.from('deals')
        .select('id, headline, value_eur, deal_date, created_at, type')
        .eq('category', 'deal').is('dup_of', null).neq('id', deal.id).gte('created_at', since)
        .or(`buyer.ilike.%${first}%,target.ilike.%${first}%,headline.ilike.%${first}%`)
        .order('created_at', { ascending: false }).limit(4);
      (data || []).forEach((d) => out.set(d.id, d));
      // Informacion previa sobre ESTA operacion: noticias que nombran al objetivo (o al
      // emisor cuando no hay objetivo). Otras compras del mismo comprador no cuentan.
      if (targetNames.includes(n) || !targetNames.length) companyHits += (data || []).length;
    }
    if (out.size < 4 && deal.sector) {
      let q = db.from('deals')
        .select('id, headline, value_eur, deal_date, created_at, type')
        .eq('category', 'deal').is('dup_of', null).is('excluded_reason', null).neq('id', deal.id)
        .eq('sector', deal.sector).gte('created_at', since).gt('value_eur', 0);
      if (deal.is_iberian) q = q.eq('is_iberian', true);
      const { data } = await q.order('value_eur', { ascending: false }).limit(5);
      (data || []).forEach((d) => { if (out.size < 6) out.set(d.id, d); });
    }
  } catch (e) {}
  const lines = [...out.values()].slice(0, 6).map((d) => {
    const v = Number(d.value_eur) > 0 ? (d.value_eur >= 1000 ? ` (€${(d.value_eur / 1000).toFixed(1)}bn)` : ` (€${Math.round(d.value_eur)}m)`) : '';
    return `- ${String(d.deal_date || d.created_at).slice(0, 10)}: ${d.headline}${v}`;
  });
  lines.companyHits = companyHits;  // operaciones previas de las mismas empresas
  return lines;
}

function buildPrompt(deal, article, related, research) {
  const isDeal = deal.category === 'deal';
  return `You are a senior analyst writing the "Meridian analysis" for MERIDIAN, a European M&A, leveraged finance and infrastructure publication read by bankers, sponsors and lenders.

Write ${isDeal ? 'TWO or THREE paragraphs (220-320 words in total)' : 'TWO paragraphs (170-250 words in total)'} of plain prose. No headings, no bullet points, no preamble. Separate paragraphs with a blank line.

What the analysis must do:
${isDeal ? `- Paragraph 1: what the transaction actually is and where it stands (rumour, mandate, signed, regulatory review, completed), and the role and likely logic of each party (strategic buyer, financial sponsor buying or exiting, lender, issuer). Explain the mechanics a professional would focus on for this type of deal (e.g. take-private, carve-out, stake sale, bond, refinancing, project financing).
- Paragraph 2: why it matters: what it says about the sector, the country or the financing market. Use a RELATED DEAL ON MERIDIAN only when there is a real link (same company, same asset, or the same kind of deal in the same sector and country), and refer to it naturally, e.g. "earlier this month Meridian reported ...". Never force a connection; if none is relevant, explain the sector or financing context in general terms instead.
- Optional paragraph 3: what to watch next and what has NOT been disclosed that a deal professional would want (price or multiple, financing package, advisers, approvals, timetable).` : `- Paragraph 1: what happened and why it matters for dealmaking or financing (cost of debt, credit conditions, appetite for M&A or IPOs, refinancing risk, sector valuations).
- Paragraph 2: who is most exposed and what to watch next. Use a RELATED DEAL ON MERIDIAN only when there is a real link, referring to it naturally ("Meridian reported on ... that ..."). Never force a connection.`}

GROUNDING RULES (critical, breaking them makes the piece unpublishable):
- Every figure, name, date and fact about these companies must come from the SOURCE ARTICLE, the SUMMARY, the WEB RESEARCH or the RELATED DEALS below. Do not estimate or invent prices, multiples, leverage, premiums, advisers, motives presented as fact, or outcomes.
- You MAY explain general deal or market mechanics in general terms (without numbers), and you may say what is typical, as long as it is not presented as a fact about this deal.
- When something is not in the sources, say it was not disclosed. Do not speculate about it, and do not guess motives ("likely driven by", "probably", "a belief that").
- No filler words ("highlights", "underscores", "demonstrates", "signals", "testament", "landscape", "strategic move"). No recommendations, no price targets, no predictions of outcomes.
- Never write labels like "(source: web research)", "(related Meridian reports)" or "according to web research": name the outlet ("according to Reuters") or "Meridian reported on ...".
- Do not assign roles that are not in the sources: a private equity firm is a financial sponsor, not a strategic buyer, and is not a lender unless the source says so.
- English only. Do not repeat the summary; build on it.

HEADLINE: ${deal.headline}
TYPE: ${deal.type || ''} | SECTOR: ${deal.sector || ''} | GEOGRAPHY: ${deal.geography || ''} | STATUS: ${deal.status || ''}
BUYER / ISSUER: ${deal.buyer || 'N/A'} | TARGET / ASSET: ${deal.target || 'N/A'}
SUMMARY: ${deal.summary || ''}

SOURCE ARTICLE (${deal.source || 'source'}):
${article || '(full text not available -- rely on the headline and summary only, and be explicit about what is not disclosed)'}

WEB RESEARCH (facts from reputable outlets found by search; each bullet ends with its outlet in brackets. When you use a fact, attribute it to THAT outlet, e.g. "according to Reuters"; never attribute a fact to an outlet that is not shown next to it):
${research && research.facts ? research.facts : '(none)'}

RELATED DEALS ON MERIDIAN (last 90 days):
${related.length ? related.join('\n') : '(none)'}

Write the analysis now:`;
}

// Control de calidad propio del texto largo: dos parrafos minimo, longitud, y el filtro general.
// Muletillas que el modelo repite aunque se le pida que no: se cambian por un verbo neutro
// antes del control de calidad (no altera el contenido).
function plainVerbs(t) {
  return t
    .replace(/\bhighlighting\b/g, 'showing').replace(/\bhighlights\b/g, 'shows').replace(/\bhighlight\b/g, 'show')
    .replace(/\bunderscoring\b/g, 'reflecting').replace(/\bunderscores\b/g, 'reflects').replace(/\bunderscore\b/g, 'reflect')
    .replace(/\bdemonstrating\b/g, 'showing').replace(/\bdemonstrates\b/g, 'shows')
    .replace(/\bsignals confidence in\b/g, 'is betting on').replace(/\bshowcases\b/g, 'shows').replace(/\bshowcasing\b/g, 'showing');
}

function acceptLong(text, deal, hasArticle) {
  const t = plainVerbs(String(text || '')
    .replace(/\s*\((?:source:?\s*)?(?:web research|related meridian reports?|meridian|summary|source article)\)/gi, '').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/^["']|["']$/g, '').trim());
  const paras = t.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 80);
  if (paras.length < 2) return '';
  // Sin el texto del articulo (fuentes de pago) hay menos material: el minimo baja.
  if (t.length < (hasArticle ? 600 : 420)) return '';
  if (/^(paragraph|analysis)\s*\d*:/im.test(t) || /^[-*•]\s/m.test(t)) return '';
  return cleanAnalysis(paras.join('\n\n'), `${deal.headline} ${deal.summary || ''}`);
}

// Si la fuente principal es de pago, se prueba con las otras fuentes que dieron la misma noticia
// (filas marcadas como duplicado de esta).
async function bestArticle(db, deal) {
  const main = await fetchArticle(deal.source_url);
  if (main.length > 300) return main;
  try {
    const { data } = await db.from('deals').select('source_url').eq('dup_of', deal.id).limit(4);
    for (const r of data || []) {
      const t = await fetchArticle(r.source_url);
      if (t.length > 300) return t;
    }
  } catch (e) {}
  return main;
}

// Frases de relleno "de mercado" que el modelo anade sin fuente. Se quitan salvo que la
// expresion aparezca en las propias fuentes.
const SPECULATIVE = /(\blikely\b|at a time when|heightened|broader strategy|provides a gauge|suggests? that|signals?|indicat(?:es|ing) (?:that|continued|strong|growing)|reflect(?:s|ing) (?:continued|strong|growing|sustained|broader)|sustained interest|continued (?:interest|appetite|activity)|appetite for|driven by|despite (?:broader|the broader|ongoing)|amid (?:broader|ongoing)|economic uncertaint|poised to|is likely|are likely|likely to|probably|could (?:reshape|signal|indicate)|potentially reshap|testament|one of the largest)/i;
function dropUnsupported(text, sourceText) {
  const src = String(sourceText || '').toLowerCase();
  return text.split(/\n\s*\n/).map((p) => {
    // Corte por final de frase (punto + espacio + mayuscula), no por los puntos de "10.8".
    const sents = p.split(/(?<=[.!?])\s+(?=[A-Z"'‘“(€$£0-9])/);
    return sents.filter((s) => {
      const m = s.match(SPECULATIVE);
      return !m || src.includes(m[0].toLowerCase());
    }).join(' ').trim();
  }).filter(Boolean).join('\n\n');
}

// Segunda pasada: un editor de verificacion borra o recorta las frases que afirman algo que
// no esta en las fuentes. No anade nada. Si falla el LLM, se queda el borrador.
async function factCheck(draft, deal, article, related, research) {
  const prompt = `You are the fact-checking editor of a financial publication. Below are the SOURCES and a DRAFT analysis.

Return the DRAFT with these edits only:
- Delete every sentence (or clause) that states a figure, date, name, fact, motive, sector trend or market claim that is NOT supported by the SOURCES. This includes guesses ("likely", "probably"), claims about what the sector or market is doing ("at a time when...", "heightened interest", "appetite for"), and interpretations of a firm's strategy that the SOURCES do not state.
- A headline in the SOURCES supports only what it literally says; do not keep explanations built on top of it.
- If a figure in the draft differs from the SOURCES, correct it to the source figure.
- If the draft says something "was not disclosed" but the SOURCES give it, change that sentence to state the sourced fact.
- Keep general explanations of how this type of deal works (no figures, no claims about this company or market trend).
- Do not add any new information beyond those corrections. Do not add comments, notes or headings. Keep the paragraph breaks (blank line between paragraphs).
Output only the edited text.

SOURCES
HEADLINE: ${deal.headline}
BUYER / ISSUER: ${deal.buyer || 'N/A'} | TARGET / ASSET: ${deal.target || 'N/A'} | STATUS: ${deal.status || ''}
SUMMARY: ${deal.summary || ''}
ARTICLE: ${article ? article.slice(0, 5000) : '(none)'}
WEB RESEARCH:
${research.facts || '(none)'}
RELATED DEALS ON MERIDIAN:
${related.length ? related.join('\n') : '(none)'}

DRAFT
${draft}`;
  try {
    const out = await llmPrecise({ prompt, maxTokens: 1400 });
    return String(out || '').trim() || draft;
  } catch (e) {
    return draft;
  }
}

// Devuelve { text, sources } ('' si no pasa el control de calidad) o null si el LLM esta caido.
export async function writeAnalysis(db, deal, opts = {}) {
  const [article, related] = await Promise.all([bestArticle(db, deal), relatedDeals(db, deal)]);
  // Busqueda web cuando el articulo de origen no aporta (fuente de pago o pagina ilegible) y
  // tampoco hay informacion previa de esta misma operacion en Meridian. "Previa" = noticias que
  // nombran a las mismas empresas; otras operaciones del sector no cuentan como informacion
  // sobre esta.
  const weakArticle = article.length < 800;
  let research = { facts: '', sources: [] };
  if (weakArticle && (related.companyHits || 0) < 2) {
    try { research = await webResearch(deal, fetchArticle); } catch (e) {}
  }
  let text;
  try {
    text = await llmComplete({ prompt: buildPrompt(deal, article, related, research), maxTokens: 1400, temperature: 0.4 });
  } catch (e) {
    return null; // LLM caido: se reintenta en el siguiente ciclo
  }
  const hasMaterial = article.length > 300 || research.facts.length > 300;
  const sourceText = [deal.headline, deal.summary, article, research.facts, related.join('\n')].join('\n');
  const checked = await factCheck(String(text || ''), deal, article, related, research);
  const cleaned = dropUnsupported(checked.replace(/[\u200B-\u200D\uFEFF]/g, ''), sourceText);
  // Si la verificacion deja el texto por debajo del minimo, se rechaza (mejor nada que un texto
  // apoyado en frases sin fuente).
  const ok = acceptLong(cleaned, deal, hasMaterial);
  const sources = ok ? research.sources : [];
  if (opts.debug) return { ok, sources, raw: text, checked, article_chars: article.length, related, research_chars: research.facts.length, research_richness: research.facts.split('\n').filter((l) => /\d/.test(l)).length, research_facts: research.facts, research_sources: research.sources, research_log: researchLog.splice(0) };
  return { text: ok, sources };
}
