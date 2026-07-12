// lib/fetchJobs.js -- CAREERS ingestion.
//
// SOURCES ARE ATS APIs ONLY. Zero Anthropic tokens, on purpose:
// the Tier 1 rate limit (30K input tokens/min) is the recurring constraint on
// this project, and a job board is not worth spending a single token on when
// the firms publish structured JSON for free.
//
// Every endpoint below was verified live on 12 Jul 2026. Guessing Workday
// tenants does not work -- these were found by inspecting each careers page.

const CITIES = [
  'London', 'Paris', 'Madrid', 'Milan', 'Frankfurt', 'Berlin',
  'Zurich', 'Amsterdam', 'Luxembourg', 'Dublin', 'Lisbon',
];

const LEVELS = ['Intern', 'Analyst', 'Associate', 'VP', 'Director', 'MD'];

// Order is the logic -- first match wins.
//  * 'M&A Analyst, Financial Sponsors Group' is M&A advisory, NOT private equity,
//    so explicit M&A must beat the LBO rule that catches 'financial sponsors'.
//  * 'LBO Financing Analyst' is LevFin, so LevFin must beat LBO.
// The generic 'investment banking / coverage' catch-all goes last.
const DIVISION_RULES = [
  ['Restructuring',   /restructur|distressed|special situations|turnaround|insolvenc/i],
  ['LevFin',          /leveraged finance|high[- ]?yield|acquisition finance|\blevfin\b|\blbo financ/i],
  ['Project Finance', /project finance|infrastructure finance|energy finance/i],
  ['Debt Advisory',   /debt capital markets|\bdcm\b|debt advisory|private credit|direct lending|debt financ/i],
  ['ECM',             /equity capital markets|\becm\b|\bipo\b|equity syndicate|equity origination|equity private placement/i],
  ['M&A',             /\bm&a\b|mergers?\s*(and|&)\s*acquisitions?/i],
  ['LBO',             /private equity|buyout|financial sponsors?|sponsors? coverage|\blbo\b/i],
  ['M&A',             /corporate finance|investment banking|\bibc\b|\bibcm\b|coverage/i],
];

// \b matters: bare /intern/ matches 'InterNational', bare /partner/ matches 'Partnerships'.
const LEVEL_RULES = [
  ['Intern',    /\bintern(ship)?s?\b|\bplacement\b|summer analyst|off[- ]cycle|spring week|graduate|working student/i],
  ['MD',        /managing director|\bmd\b|\bpartner\b/i],
  ['Director',  /\bdirector\b|executive director|principal/i],
  ['VP',        /vice president|\bvp\b|senior associate/i],
  ['Associate', /associate/i],
  ['Analyst',   /analyst/i],
];

// Verified 12 Jul 2026. Workday needs POST; Greenhouse is a plain GET.
export const SOURCES = [
  { firm: 'Houlihan Lokey', tier: 'Boutique', ats: 'workday',
    base: 'https://hl.wd1.myworkdayjobs.com', tenant: 'hl', site: 'Lateral' },
  { firm: 'Deutsche Bank', tier: 'BB', ats: 'workday',
    base: 'https://db.wd3.myworkdayjobs.com', tenant: 'db', site: 'DBWebsite',
    // 1,074 postings: paginating all of them would blow the function timeout.
    // Searching by division term is far cheaper and hits the same roles.
    searchTerms: ['M&A', 'Investment Banking', 'Leveraged Finance', 'Equity Capital Markets',
                  'Debt Capital Markets', 'Restructuring', 'Corporate Finance', 'Coverage'] },
  { firm: 'Blackstone', tier: 'PE', ats: 'workday',
    base: 'https://blackstone.wd1.myworkdayjobs.com', tenant: 'blackstone', site: 'Blackstone_Careers' },
  { firm: 'Lincoln International', tier: 'Boutique', ats: 'greenhouse', board: 'lincolninternational' },
  { firm: 'General Atlantic', tier: 'PE', ats: 'greenhouse', board: 'generalatlantic' },
  { firm: 'William Blair', tier: 'Boutique', ats: 'greenhouse', board: 'williamblair' },
  { firm: 'Teneo', tier: 'Boutique', ats: 'greenhouse', board: 'teneo' },
];

const UA = 'Mozilla/5.0 (compatible; MeridianBot/1.0; +https://www.meridiancapmarkets.com)';

function classify(rules, text, fallback = null) {
  for (const [label, re] of rules) if (re.test(text)) return label;
  return fallback;
}
const matchCity = (loc = '') => CITIES.find((c) => new RegExp(c, 'i').test(loc)) || null;

// Stable dedupe key. Same firm + title + city = same opening.
async function sourceHash(firm, title, city) {
  const crypto = await import('crypto');
  return crypto.createHash('md5').update((firm + '|' + title + '|' + city).toLowerCase()).digest('hex');
}

// We BUILD a LinkedIn search URL. We never scrape LinkedIn: that breaks their
// terms and gets you IP-banned. Linking out is fine, and sends the reader there anyway.
function linkedinSearchUrl(firm, title, city) {
  return 'https://www.linkedin.com/jobs/search/?keywords=' +
    encodeURIComponent(title + ' ' + firm) + '&location=' + encodeURIComponent(city);
}

async function normalize({ firm, tier, title, locationText, postedAt, applyUrl, source }) {
  const city = matchCity(locationText);
  if (!city) return null;
  const t = (title || '').trim();
  const division = classify(DIVISION_RULES, t);
  if (!division) return null; // not front-office IB -- the filter IS the product
  const level = classify(LEVEL_RULES, t, 'Analyst');
  return {
    source_hash: await sourceHash(firm, t, city),
    firm, title: t, division,
    level: LEVELS.includes(level) ? level : 'Analyst',
    city,
    apply_url: applyUrl,
    linkedin_url: linkedinSearchUrl(firm, t, city),
    posted_at: postedAt || null,
    source, source_tier: tier || null,
  };
}

async function workdayPage(src, searchText, offset) {
  const url = src.base + '/wday/cxs/' + src.tenant + '/' + src.site + '/jobs';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText }),
  });
  if (!res.ok) throw new Error('workday ' + src.firm + ' HTTP ' + res.status);
  const data = await res.json();
  return data.jobPostings || [];
}

async function fetchWorkday(src) {
  const byPath = new Map();
  const terms = src.searchTerms || [''];
  for (const term of terms) {
    for (let offset = 0; offset < 60; offset += 20) {
      const postings = await workdayPage(src, term, offset);
      if (postings.length === 0) break;
      for (const p of postings) byPath.set(p.externalPath, p);
      if (postings.length < 20) break;
    }
  }
  return [...byPath.values()].map((p) => ({
    firm: src.firm, tier: src.tier,
    title: p.title || '',
    locationText: p.locationsText || '',
    // Workday returns 'Posted 3 Days Ago', not a date. Leave null and let the
    // board fall back to first_seen_at, which is our own reliable timestamp.
    postedAt: null,
    applyUrl: src.base + '/en-US/' + src.site + (p.externalPath || ''),
    source: 'workday',
  }));
}

async function fetchGreenhouse(src) {
  const res = await fetch('https://boards-api.greenhouse.io/v1/boards/' + src.board + '/jobs',
    { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('greenhouse ' + src.firm + ' HTTP ' + res.status);
  const { jobs = [] } = await res.json();
  return jobs.map((j) => ({
    firm: src.firm, tier: src.tier,
    title: j.title || '',
    locationText: (j.location && j.location.name) || '',
    postedAt: j.updated_at || null,
    applyUrl: j.absolute_url,
    source: 'greenhouse',
  }));
}

const HANDLERS = { workday: fetchWorkday, greenhouse: fetchGreenhouse };

export async function fetchAllJobs() {
  const jobs = [];
  const healthyFirms = [];

  // Sequential on purpose. Parallel fan-out is what produced the 429s and
  // timeouts on the deals cron; there is no deadline here worth that risk.
  for (const src of SOURCES) {
    try {
      const raw = await HANDLERS[src.ats](src);
      const kept = (await Promise.all(raw.map(normalize))).filter(Boolean);
      console.log('[jobs] ' + src.firm + ' (' + src.ats + '): ' + raw.length + ' raw -> ' + kept.length + ' IB/Europe');
      jobs.push(...kept);
      // Only firms whose source ANSWERED count as healthy. A firm whose endpoint
      // is down must not have its listings aged out -- see increment_missed_cycles.
      healthyFirms.push(src.firm);
    } catch (e) {
      console.error('[jobs] ' + src.firm + ' failed:', e.message);
    }
  }

  // Dedupe across sources; structured ATS data always wins.
  const byHash = new Map();
  for (const j of jobs) byHash.set(j.source_hash, j);
  const all = [...byHash.values()];

  console.log('[jobs] total after dedupe: ' + all.length + ' | healthy firms: ' + healthyFirms.length);
  return { jobs: all, healthyFirms };
}

export async function upsertJobs(supabase, jobs, healthyFirms) {
  if (!jobs.length) return { upserted: 0 };
  const now = new Date().toISOString();
  let upserted = 0;

  // Batched upsert, not a select+insert loop per row: 200 rows x 2 round trips
  // would exceed the function timeout, cron-job.org would retry, and we would
  // end up with two concurrent ingests.
  for (let i = 0; i < jobs.length; i += 100) {
    const batch = jobs.slice(i, i + 100);
    const { error } = await supabase.from('jobs').upsert(batch, { onConflict: 'source_hash', ignoreDuplicates: true });
    if (error) console.error('[jobs] upsert batch failed:', error.message);
    else upserted += batch.length;
  }

  const seen = jobs.map((j) => j.source_hash);

  // Anything we saw again is alive: refresh it and reset its absence counter.
  // .neq('status','filled') so a role you manually marked filled does not resurrect.
  for (let i = 0; i < seen.length; i += 100) {
    const { error } = await supabase.from('jobs')
      .update({ last_seen_at: now, missed_cycles: 0, status: 'active' })
      .in('source_hash', seen.slice(i, i + 100))
      .neq('status', 'filled');
    if (error) console.error('[jobs] refresh failed:', error.message);
  }

  // Penalise only listings from firms whose source responded this cycle.
  await supabase.rpc('increment_missed_cycles', { seen_hashes: seen, healthy_firms: healthyFirms });

  return { upserted };
}
