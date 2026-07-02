// lib/sources.js
// Ingesta de noticias reales por RSS/Atom desde fuentes primarias (reguladores,
// teletipos y prensa financiera europea), con parser SIN dependencias, dedupe y
// ranking por autoridad + frescura. El objetivo: ser de los mas rapidos de
// Europa con lo que YA se ha publicado, y darle a Gemini titulares REALES para
// que solo resuma/clasifique (nada de inventar).

// weight = autoridad/senal (10 = maxima). region solo informativo.
// SECCION EDITABLE: anade aqui tus Google Alerts (formato RSS) y newsletters/
// Substacks (casi todos publican RSS) para inyectar senal curada/semi-exclusiva.
export const FEEDS = [
  // --- Prensa financiera europea (titulares de operaciones) ---
  { url: 'https://e00-expansion.uecdn.es/rss/empresas.xml',            source: 'Expansion',    weight: 8, region: 'Europe' },
  { url: 'https://e00-expansion.uecdn.es/rss/mercados.xml',            source: 'Expansion',    weight: 7, region: 'Europe' },
  { url: 'https://e00-expansion.uecdn.es/rss/economia.xml',            source: 'Expansion',    weight: 6, region: 'Europe' },
  { url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/cincodias.elpais.com/portada', source: 'Cinco Dias', weight: 8, region: 'Europe' },
  { url: 'https://www.eleconomista.es/rss/rss-category.php?category=empresas',          source: 'El Economista', weight: 7, region: 'Europe' },
  { url: 'https://www.eleconomista.es/rss/rss-category.php?category=mercados-cotizaciones', source: 'El Economista', weight: 6, region: 'Europe' },
  { url: 'https://www.europapress.es/rss/rss.aspx?ch=274',             source: 'Europa Press', weight: 6, region: 'Europe' },
  { url: 'https://www.ft.com/companies?format=rss',                    source: 'Financial Times', weight: 9, region: 'Europe' },
  { url: 'https://www.ft.com/markets?format=rss',                      source: 'Financial Times', weight: 8, region: 'Europe' },
  // --- Teletipos globales (anuncios de empresa, M&A, financiaciones) ---
  { url: 'https://www.globenewswire.com/RssFeed/subjectcode/9-Mergers%20and%20Acquisitions/feedTitle/GlobeNewswire%20-%20Mergers%20and%20Acquisitions', source: 'GlobeNewswire', weight: 8, region: 'Global' },
  { url: 'https://www.prnewswire.com/rss/financial-services-latest-news/financial-services-latest-news-list.rss', source: 'PR Newswire', weight: 6, region: 'Global' },
  { url: 'https://www.prnewswire.com/rss/acquisitions-mergers-and-takeovers-news.rss', source: 'PR Newswire', weight: 7, region: 'Global' },
  // --- Reguladores / filings (primario, rapido) ---
  { url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&dateb=&owner=include&count=60&output=atom', source: 'SEC EDGAR', weight: 5, region: 'North America' },

  // --- TUS FUENTES (Google Alerts RSS / newsletters / Substack) ---
  // { url: 'https://www.google.com/alerts/feeds/XXXX/YYYY', source: 'Alertas', weight: 9, region: 'Europe' },
  // { url: 'https://algun-boletin.substack.com/feed',       source: 'Boletin', weight: 9, region: 'Europe' },
];

const UA = 'MeridianNewsBot/1.0 (+https://meridiancapmarkets.com; contact: arosmuno@gmail.com)';

function decodeEntities(s) {
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

function linkOf(block) {
  // RSS: <link>url</link>  |  Atom: <link rel="alternate" href="url"/>
  const rss = block.match(/<link>\s*([\s\S]*?)\s*<\/link>/i);
  if (rss && /^https?:/i.test(rss[1].trim())) return rss[1].trim();
  const atom = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
            || block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return atom ? atom[1] : '';
}

function parseItems(xml, feed) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    const title = tag(b, 'title');
    const date = tag(b, 'pubDate') || tag(b, 'updated') || tag(b, 'published') || tag(b, 'dc:date');
    const desc = tag(b, 'description') || tag(b, 'summary') || tag(b, 'content') || tag(b, 'content:encoded');
    return {
      title,
      link: linkOf(b),
      snippet: (desc || '').slice(0, 240),
      source: feed.source,
      weight: feed.weight,
      region: feed.region,
      date,
    };
  }).filter((it) => it.title && it.title.length > 8);
}

async function fetchFeed(feed) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(feed.url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    if (!r.ok) return [];
    const xml = await r.text();
    return parseItems(xml, feed);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

// Devuelve los titulares mas relevantes (autoridad + frescura), sin duplicados.
export async function gatherHeadlines() {
  const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
  const items = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  // dedupe por titulo normalizado
  const seen = new Set();
  const uniq = [];
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniq.push(it);
  }

  // score = autoridad + frescura
  const now = Date.now();
  for (const it of uniq) {
    const ts = Date.parse(it.date) || 0;
    it.ts = ts;
    const ageH = ts ? (now - ts) / 3600000 : 999;
    const fresh = ageH <= 6 ? 5 : ageH <= 24 ? 3 : ageH <= 72 ? 1 : 0;
    it.score = (it.weight || 5) + fresh;
  }
  uniq.sort((a, b) => b.score - a.score || (b.ts || 0) - (a.ts || 0));
  return uniq.slice(0, 40);
}
