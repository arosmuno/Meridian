// pages/rankings.js -- League tables: biggest deals, most active sectors & acquirers.
import Head from 'next/head';

const SITE = 'https://www.meridiancapmarkets.com';
const curSym = (c) => (c === 'USD' ? '$' : c === 'GBP' ? String.fromCharCode(163) : String.fromCharCode(8364));
function fmtValue(v, sym) {
  const n = Number(v);
  if (!n) return '';
  return n >= 1000 ? sym + (n / 1000).toFixed(1) + 'Bn' : sym + n + 'M';
}
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
const isNA = (s) => !s || /^n\/?a$/i.test(String(s).trim());

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
  let biggest = [], sectors = [], acquirers = [], total = 0, count = 0;
  try {
    const r = await fetch(SITE + '/api/deals?limit=100');
    if (r.ok) {
      const j = await r.json();
      const seen = new Set();
      const deals = (j.deals || []).filter((d) => {
        if (d.category === 'macro') return false;
        if (!d.headline) return false;
        if (seen.has(d.headline)) return false; seen.add(d.headline); return true;
      });
      count = deals.length;
      biggest = deals.filter((d) => Number(d.value) > 0)
        .sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 10)
        .map((d) => ({ id: d.id, headline: d.headline, buyer: d.buyer, target: d.target, value: Number(d.value), currency: d.currency, type: d.type }));
      total = deals.reduce((s, d) => s + Number(d.value || 0), 0);
      const bySector = {}; const byBuyer = {};
      deals.forEach((d) => {
        if (d.sector && !isNA(d.sector)) bySector[d.sector] = (bySector[d.sector] || 0) + 1;
        if (!isNA(d.buyer)) byBuyer[d.buyer] = (byBuyer[d.buyer] || 0) + 1;
      });
      sectors = Object.entries(bySector).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
      acquirers = Object.entries(byBuyer).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 8);
    }
  } catch (e) {}
  return { props: { biggest, sectors, acquirers, total, count } };
}

const Card = ({ title, children }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 18 }}>
    <div style={{ fontFamily: 'var(--s)', fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 14 }}>{title}</div>
    {children}
  </div>
);
const Row = ({ n, main, sub, right, accent }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: n === 1 ? 'none' : '1px solid var(--border)' }}>
    <span style={{ fontFamily: 'var(--d)', fontSize: 16, fontWeight: 700, color: 'var(--border-hi)', width: 24, flexShrink: 0 }}>{n < 10 ? '0' + n : n}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--s)', fontSize: 13, fontWeight: 600, color: 'var(--text-hi)', lineHeight: 1.3 }}>{main}</div>
      {sub ? <div style={{ fontFamily: 'var(--s)', fontSize: 11, color: 'var(--text-mid)', marginTop: 1 }}>{sub}</div> : null}
    </div>
    {right ? <div style={{ fontFamily: 'var(--d)', fontSize: 15, fontWeight: 700, color: accent || 'var(--text-hi)', flexShrink: 0 }}>{right}</div> : null}
  </div>
);

export default function Rankings({ biggest, sectors, acquirers, total, count }) {
  return (
    <>
      <Head>
        <title>League Tables -- Meridian</title>
        <meta name="description" content="Meridian league tables: the biggest capital-markets deals, the most active sectors and the most active acquirers, ranked from live data." />
        <link rel="canonical" href={SITE + '/rankings'} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 22px 56px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>&#10022; League tables</div>
          <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,54px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.1, margin: '0 0 8px' }}>The rankings</h1>
          <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-mid)', fontStyle: 'italic', margin: '0 0 22px' }}>
            {count} recent deals tracked{total ? ', ' + fmtValue(total, String.fromCharCode(8364)) + ' in combined value' : ''}.
          </p>

          <Card title="Biggest deals by value">
            {biggest.length ? biggest.map((d, i) => (
              <a key={d.id} href={'/deal/' + slugify(d.headline) + '-' + d.id} style={{ textDecoration: 'none', display: 'block' }}>
                <Row n={i + 1}
                  main={(!isNA(d.buyer) ? d.buyer : d.headline)}
                  sub={!isNA(d.target) ? d.target : (d.type || '')}
                  right={fmtValue(d.value, curSym(d.currency))} accent="var(--gold)" />
              </a>
            )) : <div style={{ fontFamily: 'var(--r)', color: 'var(--text-mid)' }}>No data yet.</div>}
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }} className="cards-grid">
            <Card title="Most active sectors">
              {sectors.length ? sectors.map((s, i) => (
                <Row key={s.k} n={i + 1} main={s.k} right={s.v + ' deals'} />
              )) : <div style={{ fontFamily: 'var(--r)', color: 'var(--text-mid)' }}>No data yet.</div>}
            </Card>
            <Card title="Most active acquirers">
              {acquirers.length ? acquirers.map((s, i) => (
                <Row key={s.k} n={i + 1} main={s.k} right={s.v + 'x'} />
              )) : <div style={{ fontFamily: 'var(--r)', color: 'var(--text-mid)' }}>No data yet.</div>}
            </Card>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}
