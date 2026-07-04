// pages/sector.js -- per-sector deal feed. Clean URL /sector/<slug> (rewrite) or ?name=<sector>.
import Head from 'next/head';
import { dedupeDeals } from '../lib/dedupe';

const SITE = 'https://www.meridiancapmarkets.com';
const SECTORS = ['Healthcare', 'TMT', 'Infrastructure', 'Energy & Renewables', 'Financial Services', 'Consumer', 'Industrials', 'Real Estate', 'Macro', 'General'];
const ACCENT = {
  'M&A': '#e63946', 'LBO': '#a78bfa', 'LevFin': '#4a9eff', 'Project Finance': '#22c55e',
  'ECM': '#c084fc', 'Restructuring': '#f43f5e', 'Debt Advisory': '#f59e0b',
  'Macro': '#38bdf8', 'Earnings': '#fb923c', 'Markets': '#a3e635',
};
const curSym = (c) => (c === 'USD' ? '$' : c === 'GBP' ? String.fromCharCode(163) : String.fromCharCode(8364));
function fmtValue(v, sym) { const n = Number(v); if (!n) return ''; return n >= 1000 ? sym + (n / 1000).toFixed(1) + 'Bn' : sym + n + 'M'; }
function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80); }

function Footer() {
  return (
    <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '18px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)', letterSpacing: '.06em', lineHeight: 2 }}>
        {SECTORS.filter((s) => s !== 'Macro' && s !== 'General').map((s) => (
          <a key={s} href={'/sector/' + slugify(s)} style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 14 }}>{s}</a>
        ))}
      </div>
      <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.06em', marginTop: 8 }}>
        <a href="/" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Home</a>
        <a href="/analysis" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Analysis</a>
        <a href="/rankings" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Rankings</a>
        <a href="/learn" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Learn</a>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  const q = ctx.query || {};
  const key = String(q.name || q.slug || '');
  const sector = SECTORS.find((s) => s === key || slugify(s) === slugify(key)) || null;
  let deals = [];
  if (sector) {
    try {
      const r = await fetch(SITE + '/api/deals?limit=100');
      if (r.ok) {
        const j = await r.json();
        deals = dedupeDeals((j.deals || []).filter((d) => d.headline && (d.sector || '').toLowerCase() === sector.toLowerCase()))
          .map((d) => ({ id: d.id, headline: d.headline, summary: (d.summary || '').slice(0, 160), type: d.type || 'DEAL', value: fmtValue(d.value, curSym(d.currency)), date: d.date || '', status: (d.status || '').toUpperCase() }));
      }
    } catch (e) {}
  }
  return { props: { sector, deals } };
}

export default function SectorPage({ sector, deals }) {
  if (!sector) {
    return (
      <>
        <Head><title>Sector -- Meridian</title></Head>
        <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, fontFamily: 'var(--s)', textAlign: 'center', padding: 24 }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 36, fontWeight: 800, color: 'var(--text-hi)', textDecoration: 'none' }}>MERIDIAN</a>
          <div style={{ color: 'var(--text-mid)' }}>Sector not found.</div>
          <a href="/" style={{ color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>Back to the latest deals -&gt;</a>
        </div>
      </>
    );
  }
  const desc = 'The latest ' + sector + ' deals -- M&A, financing, ECM and restructuring -- tracked by Meridian.';
  return (
    <>
      <Head>
        <title>{sector + ' deals -- Meridian'}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={SITE + '/sector/' + slugify(sector)} />
        <meta property="og:title" content={sector + ' deals -- Meridian'} />
        <meta property="og:description" content={desc} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 22px 56px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>Sector</div>
          <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,54px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.1, margin: '0 0 8px' }}>{sector}</h1>
          <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-mid)', fontStyle: 'italic', margin: '0 0 24px' }}>{deals.length} deal{deals.length === 1 ? '' : 's'} tracked in {sector}.</p>

          {deals.length === 0 ? (
            <p style={{ fontFamily: 'var(--r)', color: 'var(--text-mid)' }}>No deals in this sector right now. <a href="/" style={{ color: 'var(--gold)', textDecoration: 'none' }}>See all deals -&gt;</a></p>
          ) : (
            <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {deals.map((d) => {
                const accent = ACCENT[d.type] || 'var(--gold)';
                return (
                  <a key={d.id} href={'/deal/' + slugify(d.headline) + '-' + d.id} className="card" style={{ textDecoration: 'none', padding: '16px 18px', gap: 8, borderLeft: '3px solid ' + accent }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--s)', fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: accent, textTransform: 'uppercase' }}>{d.type}</span>
                      {d.status ? <span style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)', letterSpacing: '.08em' }}>{d.status}</span> : null}
                    </div>
                    <h3 style={{ fontFamily: 'var(--d)', fontSize: 17, fontWeight: 700, color: 'var(--text-hi)', lineHeight: 1.3, margin: 0 }}>{d.headline}</h3>
                    <p style={{ fontFamily: 'var(--r)', fontSize: 13, color: 'var(--text-body)', lineHeight: 1.6, margin: 0, flexGrow: 1 }}>{d.summary}{d.summary.length >= 160 ? '…' : ''}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <span style={{ fontFamily: 'var(--d)', fontSize: 16, fontWeight: 700, color: accent }}>{d.value || ''}</span>
                      <span style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-lo)' }}>{d.date}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <Footer />
      </div>
    </>
  );
}
