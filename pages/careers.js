// pages/careers.js -- CAREERS: open front-office roles across Europe.
// Layout: hero with search, browse panel (by firm / city / division, with live
// counts) and a filterable list underneath. Filters live in the URL
// (?firm=&city=&division=&level=&q=) so any view can be shared or linked.
import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

const SITE = 'https://www.meridiancapmarkets.com';
const LEVELS = ['Intern', 'Analyst', 'Associate', 'VP', 'Director', 'MD'];
const DIVISION_ORDER = ['M&A', 'LBO', 'ECM', 'LevFin', 'Debt Advisory', 'Project Finance', 'Restructuring'];
const DIVISION_NOTE = {
  'M&A': 'Sell-side and buy-side advisory on mergers, acquisitions and disposals.',
  'LBO': 'Sponsor coverage and buyout execution for private equity clients.',
  'ECM': 'IPOs, follow-ons, block trades and other equity raises.',
  'LevFin': 'Leveraged loans and high-yield bonds for sponsors and corporates.',
  'Debt Advisory': 'Independent advice on raising, refinancing and restructuring debt.',
  'Project Finance': 'Non-recourse financing of energy and infrastructure assets.',
  'Restructuring': 'Balance-sheet repair, liability management and distressed M&A.',
};
const PAGE = 25;
const FILTER_KEYS = ['firm', 'city', 'division', 'level', 'q'];

const curSym = (c) => (c === 'USD' ? '$' : c === 'GBP' ? '£' : '€');
function fmtValue(v, sym) {
  const n = Number(v);
  if (!n) return '';
  return n >= 1000 ? sym + (n / 1000).toFixed(1) + 'Bn' : sym + n + 'M';
}
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function ageDays(d) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}
function daysAgo(d) {
  const n = ageDays(d);
  if (n === null) return '';
  if (n <= 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 7) return n + ' days ago';
  if (n < 14) return 'Last week';
  return Math.floor(n / 7) + ' weeks ago';
}
function initials(name) {
  const w = String(name || '').split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
}
function countBy(list, key) {
  const m = new Map();
  list.forEach((j) => { const k = j[key]; if (k) m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

// Read Supabase directly rather than fetching our own /api/jobs over HTTP
// (on a preview deployment SITE would point at production).
export async function getServerSideProps() {
  let jobs = [];
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, deal:related_deal_id (id, headline, buyer, target, value, currency, deal_date)')
      .eq('status', 'active')
      .order('posted_at', { ascending: false, nullsFirst: false })
      .order('first_seen_at', { ascending: false })
      .limit(500);
    if (!error && data) jobs = data;
  } catch (e) {}
  return { props: { jobs } };
}

const kicker = { fontFamily: 'var(--s)', fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase' };

function Footer() {
  return (
    <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '16px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.06em' }}>
        <a href="/" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Home</a>
        <a href="/analysis" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Analysis</a>
        <a href="/rankings" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Rankings</a>
        <a href="/careers" style={{ color: 'var(--gold)', textDecoration: 'none', marginRight: 16 }}>Careers</a>
        <a href="/learn" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Learn</a>
        <a href="/about" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>About</a>
      </div>
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div className="cr-stat">
      <div style={{ fontFamily: 'var(--d)', fontSize: 30, fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1 }}>{n}</div>
      <div style={{ ...kicker, fontSize: 9, color: 'var(--text-mid)', marginTop: 6 }}>{label}</div>
    </div>
  );
}

function BrowseByFirm({ jobs, pick }) {
  const firms = countBy(jobs, 'firm');
  return (
    <div className="cr-panel">
      {firms.map(([firm, n]) => {
        const mine = jobs.filter((j) => j.firm === firm);
        const cities = countBy(mine, 'city');
        const levels = countBy(mine, 'level').map(([l, c]) => c + ' ' + l).slice(0, 3).join(' · ');
        return (
          <div key={firm} className="cr-firm" onClick={() => pick({ firm })}>
            <div className="cr-mono">{initials(firm)}</div>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--d)', fontSize: 19, fontWeight: 700, color: 'var(--text-hi)', lineHeight: 1.2 }}>{firm}</div>
              <div style={{ fontFamily: 'var(--s)', fontSize: 12, color: 'var(--text-mid)', marginTop: 3 }}>
                <strong style={{ color: 'var(--text-body)' }}>{n} open {n === 1 ? 'role' : 'roles'}</strong>{levels ? ' · ' + levels : ''}
              </div>
            </div>
            <div className="cr-chips">
              {cities.map(([c, k]) => (
                <button key={c} className="cr-chip" onClick={(e) => { e.stopPropagation(); pick({ firm, city: c }); }}>
                  {c}<span>{k}</span>
                </button>
              ))}
            </div>
            <div className="cr-arrow">&rarr;</div>
          </div>
        );
      })}
    </div>
  );
}

function BrowseByCity({ jobs, pick }) {
  const cities = countBy(jobs, 'city');
  return (
    <div className="cr-grid">
      {cities.map(([city, n]) => {
        const mine = jobs.filter((j) => j.city === city);
        const country = (mine.find((j) => j.country) || {}).country;
        const top = countBy(mine, 'firm').slice(0, 3).map(([f]) => f).join(', ');
        return (
          <button key={city} className="cr-tile" onClick={() => pick({ city })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: 'var(--d)', fontSize: 22, fontWeight: 800, color: 'var(--text-hi)' }}>{city}</span>
              <span style={{ fontFamily: 'var(--d)', fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{n}</span>
            </div>
            {country ? <div style={{ ...kicker, fontSize: 9, color: 'var(--text-lo)', marginTop: 2 }}>{country}</div> : null}
            <div style={{ fontFamily: 'var(--s)', fontSize: 12, color: 'var(--text-mid)', marginTop: 12, lineHeight: 1.5 }}>{top}</div>
          </button>
        );
      })}
    </div>
  );
}

function BrowseByDivision({ jobs, pick }) {
  const counts = new Map(countBy(jobs, 'division'));
  const divs = [...DIVISION_ORDER.filter((d) => counts.has(d)), ...[...counts.keys()].filter((d) => !DIVISION_ORDER.includes(d))];
  return (
    <div className="cr-grid">
      {divs.map((d) => (
        <button key={d} className="cr-tile" onClick={() => pick({ division: d })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--d)', fontSize: 20, fontWeight: 800, color: 'var(--text-hi)' }}>{d}</span>
            <span style={{ fontFamily: 'var(--d)', fontSize: 22, fontWeight: 800, color: 'var(--gold)' }}>{counts.get(d)}</span>
          </div>
          <div style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-mid)', marginTop: 10, lineHeight: 1.5 }}>{DIVISION_NOTE[d] || ''}</div>
        </button>
      ))}
    </div>
  );
}

function JobRow({ j }) {
  const d = j.deal;
  const fresh = ageDays(j.first_seen_at) !== null && ageDays(j.first_seen_at) <= 3;
  return (
    <div className="cr-row">
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 5 }}>
          <span style={{ ...kicker, fontSize: 9, color: 'var(--gold)' }}>{j.division}</span>
          {fresh ? <span className="cr-new">New</span> : null}
        </div>
        <a href={j.apply_url} target="_blank" rel="noopener noreferrer" className="cr-title">{j.title}</a>
        <div style={{ fontFamily: 'var(--s)', fontSize: 12.5, color: 'var(--text-mid)', marginTop: 5 }}>
          <strong style={{ color: 'var(--text-body)' }}>{j.firm}</strong>
          {' · '}{j.city}{j.level ? ' · ' + j.level : ''}
        </div>
        {d ? (
          <a href={'/deal/' + slugify(d.headline) + '-' + d.id} style={{ display: 'inline-block', marginTop: 8, fontFamily: 'var(--r)', fontSize: 13, fontStyle: 'italic', color: 'var(--text-mid)', textDecoration: 'none', borderLeft: '2px solid var(--gold)', paddingLeft: 10 }}>
            Recently worked on {d.target || d.headline}{Number(d.value) > 0 ? ' (' + fmtValue(d.value, curSym(d.currency)) + ')' : ''}
          </a>
        ) : null}
      </div>
      <div className="cr-row-side">
        <span style={{ fontFamily: 'var(--s)', fontSize: 11, color: 'var(--text-lo)', whiteSpace: 'nowrap' }}>{daysAgo(j.posted_at || j.first_seen_at)}</span>
        <a href={j.apply_url} target="_blank" rel="noopener noreferrer" className="cr-apply">Apply &#8599;</a>
      </div>
    </div>
  );
}

export default function Careers({ jobs }) {
  const router = useRouter();
  const [f, setF] = useState({ firm: '', city: '', division: '', level: '', q: '' });
  const [view, setView] = useState('firm');
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(PAGE);
  const listRef = useRef(null);

  // Read filters from the URL once the router is ready.
  useEffect(() => {
    if (!router.isReady) return;
    const next = {};
    FILTER_KEYS.forEach((k) => { next[k] = typeof router.query[k] === 'string' ? router.query[k] : ''; });
    setF(next);
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  function apply(next, scroll) {
    setF(next);
    setLimit(PAGE);
    const query = {};
    FILTER_KEYS.forEach((k) => { if (next[k]) query[k] = next[k]; });
    router.replace({ pathname: '/careers', query }, undefined, { shallow: true, scroll: false });
    if (scroll && listRef.current) listRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  const pick = (p) => apply({ ...f, firm: '', city: '', division: '', ...p }, true);
  const clear = (k) => apply({ ...f, [k]: '' });

  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const out = jobs.filter((j) =>
      (!f.firm || j.firm === f.firm) &&
      (!f.city || j.city === f.city) &&
      (!f.division || j.division === f.division) &&
      (!f.level || j.level === f.level) &&
      (!q || [j.title, j.firm, j.city, j.country, j.division, j.level].join(' ').toLowerCase().includes(q))
    );
    if (sort === 'firm') out.sort((a, b) => String(a.firm).localeCompare(String(b.firm)) || String(a.title).localeCompare(String(b.title)));
    return out;
  }, [jobs, f, sort]);

  const firmsN = new Set(jobs.map((j) => j.firm)).size;
  const citiesN = new Set(jobs.map((j) => j.city)).size;
  const newN = jobs.filter((j) => { const a = ageDays(j.first_seen_at); return a !== null && a <= 7; }).length;
  const active = ['firm', 'city', 'division', 'level'].filter((k) => f[k]);
  const levelsPresent = LEVELS.filter((l) => jobs.some((j) => j.level === l));

  return (
    <>
      <Head>
        <title>Careers -- Investment banking roles in Europe | Meridian</title>
        <meta name="description" content="Open front-office investment banking roles across London, Paris, Madrid, Milan and Frankfurt. Browse by firm, city or division: M&A, LBO, ECM, LevFin, Debt Advisory, Project Finance and Restructuring." />
        <link rel="canonical" href={SITE + '/careers'} />
      </Head>
      <style>{`
        .cr-wrap { max-width: 1080px; margin: 0 auto; padding: 36px 22px 64px; }
        .cr-hero { background: var(--bg-card); border: 1px solid var(--border); padding: 34px 34px 0; }
        .cr-search { display: flex; border: 1px solid var(--border-hi, var(--border)); background: var(--bg); margin: 22px 0 0; max-width: 640px; }
        .cr-search input { flex: 1; border: none; outline: none; background: transparent; padding: 14px 16px; font-family: var(--s); font-size: 14px; color: var(--text-hi); min-width: 0; }
        .cr-search input::placeholder { color: var(--text-lo); }
        .cr-stats { display: flex; gap: 0; margin: 28px -34px 0; border-top: 1px solid var(--border); }
        .cr-stat { flex: 1; padding: 18px 34px; border-right: 1px solid var(--border); }
        .cr-stat:last-child { border-right: none; }
        .cr-views { display: flex; gap: 0; margin: 34px 0 14px; border-bottom: 1px solid var(--border); }
        .cr-view { background: none; border: none; border-bottom: 2px solid transparent; padding: 10px 20px 10px 0; margin-right: 22px; font-family: var(--s); font-size: 11.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--text-mid); cursor: pointer; }
        .cr-view.on { color: var(--text-hi); border-bottom-color: var(--gold); }
        .cr-panel { border: 1px solid var(--border); background: var(--bg-card); }
        .cr-firm { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; padding: 18px 22px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background .15s; }
        .cr-firm:last-child { border-bottom: none; }
        .cr-firm:hover { background: var(--bg); }
        .cr-firm:hover .cr-arrow { color: var(--gold); transform: translateX(3px); }
        .cr-mono { width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border); background: var(--bg); font-family: var(--d); font-size: 16px; font-weight: 800; color: var(--text-hi); }
        .cr-chips { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; flex: 1 1 260px; }
        .cr-chip { display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--border); background: var(--bg-card); padding: 5px 9px; font-family: var(--s); font-size: 11.5px; color: var(--text-body); cursor: pointer; transition: border-color .15s; }
        .cr-chip span { font-weight: 700; color: var(--gold); }
        .cr-chip:hover { border-color: var(--gold); }
        .cr-arrow { font-size: 16px; color: var(--text-lo); transition: all .15s; }
        .cr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
        .cr-tile { text-align: left; background: var(--bg-card); border: 1px solid var(--border); padding: 18px 20px; cursor: pointer; transition: border-color .15s, transform .15s; }
        .cr-tile:hover { border-color: var(--gold); transform: translateY(-1px); }
        .cr-listhead { display: flex; justify-content: space-between; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin: 46px 0 12px; scroll-margin-top: 16px; }
        .cr-pill { font-family: var(--s); font-size: 10.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; padding: 6px 12px; cursor: pointer; white-space: nowrap; background: transparent; color: var(--text-mid); border: 1px solid var(--border); }
        .cr-pill.on { background: var(--text-hi); color: var(--bg); border-color: var(--text-hi); }
        .cr-tag { display: inline-flex; align-items: center; gap: 8px; font-family: var(--s); font-size: 11.5px; color: var(--text-hi); border: 1px solid var(--gold); padding: 5px 6px 5px 10px; }
        .cr-tag button { background: none; border: none; color: var(--text-mid); cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; }
        .cr-list { border: 1px solid var(--border); background: var(--bg-card); }
        .cr-row { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; padding: 18px 22px; border-bottom: 1px solid var(--border); }
        .cr-row:last-child { border-bottom: none; }
        .cr-title { font-family: var(--d); font-size: 18px; font-weight: 700; color: var(--text-hi); text-decoration: none; line-height: 1.3; }
        .cr-title:hover { color: var(--gold); }
        .cr-row-side { display: flex; align-items: center; gap: 16px; margin-left: auto; }
        .cr-apply { font-family: var(--s); font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--bg); background: var(--text-hi); padding: 9px 14px; text-decoration: none; white-space: nowrap; }
        .cr-new { font-family: var(--s); font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--bg); background: var(--gold); padding: 2px 6px; }
        .cr-select { font-family: var(--s); font-size: 12px; color: var(--text-hi); background: var(--bg-card); border: 1px solid var(--border); padding: 7px 10px; }
        @media (max-width: 700px) {
          .cr-hero { padding: 24px 20px 0; }
          .cr-stats { margin: 22px -20px 0; flex-wrap: wrap; }
          .cr-stat { flex: 1 1 50%; padding: 14px 20px; border-bottom: 1px solid var(--border); }
          .cr-chips { justify-content: flex-start; }
          .cr-arrow { display: none; }
          .cr-row-side { margin-left: 0; width: 100%; justify-content: space-between; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <div className="cr-wrap">
          <div className="cr-hero">
            <div style={{ ...kicker, color: 'var(--gold)', marginBottom: 10 }}>{'✦ Careers'}</div>
            <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,5.5vw,52px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.08, margin: '0 0 10px' }}>Who is hiring</h1>
            <p style={{ fontFamily: 'var(--r)', fontSize: 17, color: 'var(--text-mid)', lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
              Front-office roles in M&amp;A, financing and capital markets across Europe, taken from each firm&rsquo;s own careers site and refreshed daily.
            </p>
            <form className="cr-search" onSubmit={(e) => { e.preventDefault(); apply(f, true); }}>
              <input value={f.q} onChange={(e) => apply({ ...f, q: e.target.value })} placeholder="Search by role, firm or city" aria-label="Search roles" />
              <button type="submit" className="cr-apply" style={{ border: 'none', cursor: 'pointer', padding: '0 20px' }}>Search</button>
            </form>
            <div className="cr-stats">
              <Stat n={jobs.length} label="Open roles" />
              <Stat n={firmsN} label="Firms" />
              <Stat n={citiesN} label="Cities" />
              <Stat n={newN} label="New this week" />
            </div>
          </div>

          <div className="cr-views" role="tablist">
            {[['firm', 'By firm'], ['city', 'By city'], ['division', 'By division']].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={view === k} className={'cr-view' + (view === k ? ' on' : '')} onClick={() => setView(k)}>{label}</button>
            ))}
          </div>

          {jobs.length === 0 ? null : view === 'firm' ? <BrowseByFirm jobs={jobs} pick={pick} />
            : view === 'city' ? <BrowseByCity jobs={jobs} pick={pick} />
            : <BrowseByDivision jobs={jobs} pick={pick} />}

          <div className="cr-listhead" ref={listRef}>
            <div>
              <h2 style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', margin: '0 0 4px' }}>Open roles</h2>
              <div style={{ fontFamily: 'var(--s)', fontSize: 12, color: 'var(--text-mid)' }}>
                {shown.length} of {jobs.length} {jobs.length === 1 ? 'role' : 'roles'}{f.q ? ' matching “' + f.q + '”' : ''}
              </div>
            </div>
            <select className="cr-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="firm">Firm A&ndash;Z</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <button className={'cr-pill' + (!f.level ? ' on' : '')} onClick={() => clear('level')}>All levels</button>
            {levelsPresent.map((l) => (
              <button key={l} className={'cr-pill' + (f.level === l ? ' on' : '')} onClick={() => apply({ ...f, level: f.level === l ? '' : l })}>{l}</button>
            ))}
          </div>

          {active.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
              {active.map((k) => (
                <span key={k} className="cr-tag">{f[k]}<button onClick={() => clear(k)} aria-label={'Remove ' + f[k]}>&times;</button></span>
              ))}
              <button onClick={() => apply({ firm: '', city: '', division: '', level: '', q: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--s)', fontSize: 11.5, color: 'var(--text-mid)', textDecoration: 'underline' }}>Clear all</button>
            </div>
          ) : null}

          {shown.length ? (
            <div className="cr-list">
              {shown.slice(0, limit).map((j) => <JobRow key={j.id} j={j} />)}
            </div>
          ) : (
            <div className="cr-list" style={{ padding: '34px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-mid)', fontStyle: 'italic' }}>No openings match this search right now.</div>
            </div>
          )}

          {shown.length > limit ? (
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <button onClick={() => setLimit(limit + PAGE)} className="cr-pill" style={{ padding: '10px 22px' }}>
                Show more ({shown.length - limit} left)
              </button>
            </div>
          ) : null}

          <p style={{ fontFamily: 'var(--s)', fontSize: 10.5, color: 'var(--text-lo)', lineHeight: 1.6, marginTop: 30, letterSpacing: '.03em' }}>
            Listings link straight to each firm&rsquo;s own application page. Meridian is not a recruiter and does not process applications.
          </p>
        </div>
        <Footer />
      </div>
    </>
  );
}
