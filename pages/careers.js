// pages/careers.js -- CAREERS: open investment-banking roles across Europe.
// The differentiator is not the listing: it is the link back to the deal the
// hiring firm just worked on. That is something only Meridian can show.
import Head from 'next/head';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

const SITE = 'https://www.meridiancapmarkets.com';
const DIVISIONS = ['All', 'M&A', 'LBO', 'ECM', 'LevFin', 'Debt Advisory', 'Project Finance', 'Restructuring'];
const LEVELS = ['All', 'Intern', 'Analyst', 'Associate', 'VP', 'Director', 'MD'];

const curSym = (c) => (c === 'USD' ? '$' : c === 'GBP' ? String.fromCharCode(163) : String.fromCharCode(8364));
function fmtValue(v, sym) {
  const n = Number(v);
  if (!n) return '';
  return n >= 1000 ? sym + (n / 1000).toFixed(1) + 'Bn' : sym + n + 'M';
}
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function daysAgo(d) {
  if (!d) return null;
  const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 7) return n + ' days ago';
  if (n < 14) return 'last week';
  return Math.floor(n / 7) + ' weeks ago';
}

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

// Read Supabase directly rather than fetching our own /api/jobs over HTTP.
// rankings.js fetches SITE + '/api/deals', but SITE is the PRODUCTION domain --
// on a preview deployment that would call production, where this endpoint does
// not exist yet, and the board would silently render empty. Querying the DB
// straight from the server also saves a pointless round trip.
export async function getServerSideProps() {
  let jobs = [];
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, deal:related_deal_id (id, headline, buyer, target, value, currency, deal_date)')
      .eq('status', 'active')
      .order('posted_at', { ascending: false, nullsFirst: false })
      .order('first_seen_at', { ascending: false })
      .limit(200);
    if (!error && data) jobs = data;
  } catch (e) {}
  return { props: { jobs } };
}

const Pill = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    fontFamily: 'var(--s)', fontSize: 10, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
    padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
    background: active ? 'var(--gold)' : 'transparent',
    color: active ? 'var(--bg)' : 'var(--text-mid)',
    border: '1px solid ' + (active ? 'var(--gold)' : 'var(--border)'),
  }}>{label}</button>
);

function JobCard({ j }) {
  const d = j.deal;
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--s)', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: 'var(--gold)', textTransform: 'uppercase' }}>
          {j.division}
        </span>
        <span style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-lo)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          {j.level}
        </span>
      </div>

      <h2 style={{ fontFamily: 'var(--d)', fontSize: 19, fontWeight: 700, color: 'var(--text-hi)', lineHeight: 1.25, margin: '0 0 6px' }}>
        {j.title}
      </h2>

      <div style={{ fontFamily: 'var(--s)', fontSize: 12, color: 'var(--text-mid)', marginBottom: 12 }}>
        <strong style={{ color: 'var(--text-hi)' }}>{j.firm}</strong>
        {' \u00B7 '}{j.city}
        {j.posted_at ? ' \u00B7 ' + daysAgo(j.posted_at) : ''}
      </div>

      {d ? (
        <a href={'/deal/' + slugify(d.headline) + '-' + d.id}
           style={{ display: 'block', textDecoration: 'none', borderLeft: '2px solid var(--gold)', paddingLeft: 12, margin: '0 0 14px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 9, letterSpacing: '.14em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 3 }}>
            {'\u2726 Why they are hiring'}
          </div>
          <div style={{ fontFamily: 'var(--r)', fontSize: 13, color: 'var(--text-mid)', fontStyle: 'italic', lineHeight: 1.45 }}>
            {j.firm} worked on {d.target || d.headline}
            {Number(d.value) > 0 ? ' (' + fmtValue(d.value, curSym(d.currency)) + ')' : ''}
            {d.deal_date ? ', ' + daysAgo(d.deal_date) : ''}.
          </div>
        </a>
      ) : null}

      <div style={{ display: 'flex', gap: 10 }}>
        <a href={j.apply_url} target="_blank" rel="noopener noreferrer" style={{
          fontFamily: 'var(--s)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'var(--bg)', background: 'var(--text-hi)', padding: '7px 14px', textDecoration: 'none',
        }}>Apply</a>
        {j.linkedin_url ? (
          <a href={j.linkedin_url} target="_blank" rel="noopener noreferrer" style={{
            fontFamily: 'var(--s)', fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: 'var(--text-mid)', border: '1px solid var(--border)', padding: '7px 14px', textDecoration: 'none',
          }}>Find on LinkedIn</a>
        ) : null}
      </div>
    </div>
  );
}

export default function Careers({ jobs }) {
  const [division, setDivision] = useState('All');
  const [city, setCity] = useState('All');
  const [level, setLevel] = useState('All');

  const cities = ['All', ...Array.from(new Set(jobs.map((j) => j.city))).sort()];

  const shown = jobs.filter((j) =>
    (division === 'All' || j.division === division) &&
    (city === 'All' || j.city === city) &&
    (level === 'All' || j.level === level)
  );

  const linked = jobs.filter((j) => j.deal).length;

  return (
    <>
      <Head>
        <title>Careers -- Investment banking roles in Europe | Meridian</title>
        <meta name="description" content="Open front-office investment banking roles across London, Paris, Madrid, Milan and Frankfurt -- in M&A, LBO, ECM, LevFin, Debt Advisory, Project Finance and Restructuring, mapped to the deals behind them." />
        <link rel="canonical" href={SITE + '/careers'} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 22px 56px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>
            {'\u2726 Careers'}
          </div>
          <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,54px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.1, margin: '0 0 8px' }}>
            Who is hiring
          </h1>
          <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-mid)', fontStyle: 'italic', margin: '0 0 24px' }}>
            {jobs.length} open front-office roles across Europe
            {linked ? ', ' + linked + ' tied to a deal we cover' : ''}.
          </p>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: 'var(--s)', fontSize: 9, letterSpacing: '.16em', color: 'var(--text-lo)', textTransform: 'uppercase', marginBottom: 6 }}>Division</div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {DIVISIONS.map((d) => <Pill key={d} label={d} active={division === d} onClick={() => setDivision(d)} />)}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: 'var(--s)', fontSize: 9, letterSpacing: '.16em', color: 'var(--text-lo)', textTransform: 'uppercase', marginBottom: 6 }}>City</div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {cities.map((c) => <Pill key={c} label={c} active={city === c} onClick={() => setCity(c)} />)}
            </div>
          </div>

          <div style={{ marginBottom: 26 }}>
            <div style={{ fontFamily: 'var(--s)', fontSize: 9, letterSpacing: '.16em', color: 'var(--text-lo)', textTransform: 'uppercase', marginBottom: 6 }}>Level</div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {LEVELS.map((l) => <Pill key={l} label={l} active={level === l} onClick={() => setLevel(l)} />)}
            </div>
          </div>

          {shown.length ? shown.map((j) => <JobCard key={j.id} j={j} />) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-mid)', fontStyle: 'italic' }}>
                No openings match this filter right now.
              </div>
            </div>
          )}

          <p style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-lo)', lineHeight: 1.6, marginTop: 28, letterSpacing: '.04em' }}>
            Listings are pulled directly from each firm&apos;s own careers system and refreshed daily.
            Meridian is not a recruiter and does not process applications.
          </p>
        </div>
        <Footer />
      </div>
    </>
  );
}
