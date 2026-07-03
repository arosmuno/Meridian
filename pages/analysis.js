// pages/analysis.js -- Analysis hub: every deal that has a Meridian Analysis, as an articles feed.
import Head from 'next/head';

const SITE = 'https://www.meridiancapmarkets.com';
const ACCENT = {
  'M&A': '#e63946', 'LBO': '#a78bfa', 'LevFin': '#4a9eff', 'Project Finance': '#22c55e',
  'ECM': '#c084fc', 'Restructuring': '#f43f5e', 'Debt Advisory': '#f59e0b',
  'Macro': '#38bdf8', 'Earnings': '#fb923c', 'Markets': '#a3e635',
};
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function Footer() {
  return (
    <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '16px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.06em' }}>
        <a href="/" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Home</a>
        <a href="/analysis" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Analysis</a>
        <a href="/rankings" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Rankings</a>
        <a href="/learn" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Learn</a>
        <a href="/about" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>About</a>
        <a href="/contact" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Contact</a>
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  let items = [];
  try {
    const r = await fetch(SITE + '/api/deals?limit=100');
    if (r.ok) {
      const j = await r.json();
      const seen = new Set();
      items = (j.deals || [])
        .filter((d) => d.analysis && d.analysis.length > 60 && d.headline)
        .filter((d) => { const k = d.headline; if (seen.has(k)) return false; seen.add(k); return true; })
        .map((d) => ({
          id: d.id, headline: d.headline, type: d.type || 'DEAL', sector: d.sector || '',
          date: d.date || '', excerpt: String(d.analysis).replace(/\s+/g, ' ').slice(0, 240),
        }));
    }
  } catch (e) {}
  return { props: { items } };
}

export default function AnalysisHub({ items }) {
  return (
    <>
      <Head>
        <title>Analysis -- Meridian</title>
        <meta name="description" content="Meridian Analysis: sharp editorial commentary on the biggest M&A, LBO, ECM and financing deals -- strategic rationale, the financial read, and what each signals for the market." />
        <link rel="canonical" href={SITE + '/analysis'} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 22px 56px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>&#10022; The desk</div>
          <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,54px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.1, margin: '0 0 8px' }}>Meridian Analysis</h1>
          <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-mid)', fontStyle: 'italic', margin: '0 0 8px' }}>Editorial commentary on the deals that matter -- the rationale, the numbers, and the signal.</p>

          {items.length === 0 ? (
            <p style={{ fontFamily: 'var(--r)', color: 'var(--text-mid)', marginTop: 30 }}>Fresh analysis is being written. Check back shortly.</p>
          ) : (
            <div style={{ marginTop: 20 }}>
              {items.map((d) => {
                const accent = ACCENT[d.type] || 'var(--gold)';
                const href = '/deal/' + slugify(d.headline) + '-' + d.id;
                return (
                  <a key={d.id} href={href} style={{ display: 'block', textDecoration: 'none', borderTop: '1px solid var(--border)', padding: '22px 0' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--s)', fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: accent, textTransform: 'uppercase' }}>{d.type}</span>
                      {d.sector ? <span style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{d.sector}</span> : null}
                      {d.date ? <span style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-lo)' }}>{d.date}</span> : null}
                    </div>
                    <h2 style={{ fontFamily: 'var(--d)', fontSize: 24, fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.2, margin: '0 0 8px' }}>{d.headline}</h2>
                    <p style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', lineHeight: 1.7, margin: 0 }}>{d.excerpt}&#8230;</p>
                    <span style={{ fontFamily: 'var(--s)', fontSize: 11, color: accent, fontWeight: 700, letterSpacing: '.06em', display: 'inline-block', marginTop: 8 }}>Read the analysis &rarr;</span>
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
