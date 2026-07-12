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
// Hard exclusion, applied BEFORE division matching.
//
// The catch-all 'investment banking' rule was dragging in back-office roles that
// merely carry the words: 'Internal Audit Manager, Vice President - Commercial
// Investment Banking' landed on the board tagged M&A. The board promises
// front-office only, and a single audit role on it destroys that promise.
//
// Note it deliberately does NOT blanket-ban 'technology': 'Associate - Corporate
// Finance (Technology M&A)' is a real coverage role.
const NOT_FRONT_OFFICE = /internal audit|\baudit\b|compliance|quality (and|&) risk|risk management|\blegal\b|counsel|paralegal|software|\bengineer\b|developer|full[- ]stack|\bdevops\b|cyber|\bkyc\b|\baml\b|human resources|recruit|payroll|facilities|help ?desk|desktop support|middle office|back office|operations manager|data (scientist|engineer)|product (owner|manager)/i;

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

  // Bulge bracket. Endpoints verified live 12 Jul 2026.
  { firm: 'JPMorgan', tier: 'BB', ats: 'oracle',
    base: 'https://jpmc.fa.oraclecloud.com', site: 'CX_1001',
    searchTerms: ['M&A', 'Investment Banking', 'Leveraged Finance', 'Equity Capital Markets',
                  'Debt Capital Markets', 'Corporate Finance'] },
  { firm: 'Citi', tier: 'BB', ats: 'workday',
    base: 'https://citi.wd5.myworkdayjobs.com', tenant: 'citi', site: '2',
    searchTerms: ['M&A', 'Investment Banking', 'Leveraged Finance', 'Equity Capital Markets',
                  'Debt Capital Markets', 'Restructuring', 'Corporate Finance', 'Coverage'] },
  { firm: 'Barclays', tier: 'BB', ats: 'workday',
    base: 'https://barclays.wd3.myworkdayjobs.com', tenant: 'barclays',
    site: 'External_Career_Site_Barclays',
    searchTerms: ['M&A', 'Investment Banking', 'Leveraged Finance', 'Equity Capital Markets',
                  'Debt Capital Markets', 'Restructuring', 'Corporate Finance', 'Coverage'] },
  { firm: 'Lazard', tier: 'Boutique', ats: 'oracle',
    base: 'https://icbpjb.fa.ocs.oraclecloud.com', site: 'CX_1',
    searchTerms: ['M&A', 'Investment Banking', 'Restructuring', 'Corporate Finance'] },
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
  if (NOT_FRONT_OFFICE.test(t)) return null; // audit/compliance/tech: not what this board is for
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

// Oracle Recruiting (JPMorgan, Lazard). Same principle as Workday CXS: it is the
// JSON endpoint the firm's own careers page calls. No auth, structured data, and
// unlike Workday it returns a real PostedDate.
async function fetchOracle(src) {
  const byId = new Map();
  for (const term of (src.searchTerms || [''])) {
    const url = src.base +
      '/hcmRestApi/resources/latest/recruitingCEJobRequisitions' +
      '?onlyData=true&expand=requisitionList.secondaryLocations' +
      '&finder=findReqs;siteNumber=' + src.site +
      (term ? ',keyword=' + encodeURIComponent(term) : '') +
      ',limit=100,sortBy=POSTING_DATES_DESC';
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
    if (!res.ok) throw new Error('oracle ' + src.firm + ' HTTP ' + res.status);
    const data = await res.json();
    const list = (data.items && data.items[0] && data.items[0].requisitionList) || [];
    for (const j of list) byId.set(j.Id, j);
  }
  return [...byId.values()].map((j) => ({
    firm: src.firm, tier: src.tier,
    title: j.Title || '',
    locationText: j.PrimaryLocation || '',
    postedAt: j.PostedDate || null,
    applyUrl: src.base + '/hcmUI/CandidateExperience/en/sites/' + src.site + '/job/' + j.Id,
    source: 'oracle',
  }));
}

const HANDLERS = { workday: fetchWorkday, greenhouse: fetchGreenhouse, oracle: fetchOracle };

export async function fetchAllJobs() {
  // Parallel ACROSS firms, sequential WITHIN a firm.
  //
  // The deals cron's 429s came from fanning out against ONE provider. Here every
  // source is a different host (Workday, Oracle, Greenhouse), so they share no rate
  // limit and cannot throttle each other. Sequential would be ~90 HTTP round trips
  // in series -- comfortably past the 60s maxDuration on Vercel Hobby, at which
  // point the function is killed mid-ingest.
  //
  // One firm failing must never take down the run: each is caught on its own, and
  // a firm that did NOT answer is left out of healthyFirms so its listings are not
  // aged out by increment_missed_cycles.
  const results = await Promise.all(SOURCES.map(async (src) => {
    try {
      const raw = await HANDLERS[src.ats](src);
      const kept = (await Promise.all(raw.map(normalize))).filter(Boolean);
      console.log('[jobs] ' + src.firm + ' (' + src.ats + '): ' + raw.length + ' raw -> ' + kept.length + ' IB/Europe');
      return { jobs: kept, firm: src.firm, ok: true };
    } catch (e) {
      console.error('[jobs] ' + src.firm + ' failed:', e.message);
      return { jobs: [], firm: src.firm, ok: false };
    }
  }));

  const healthyFirms = results.filter((r) => r.ok).map((r) => r.firm);

  // Dedupe across sources.
  const byHash = new Map();
  for (const r of results) for (const j of r.jobs) byHash.set(j.source_hash, j);
  const all = [...byHash.values()];

  console.log('[jobs] total after dedupe: ' + all.length + ' | healthy firms: ' + healthyFirms.length + '/' + SOURCES.length);
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
