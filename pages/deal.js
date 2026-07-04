// pages/deal.js -- per-deal share page.
// Pretty URL: /deal/<slug>-<id> (via next.config rewrite -> /deal?slug=...).
// Back-compat: /deal?id=<id> still works. Server-renders og/twitter tags so X /
// LinkedIn / WhatsApp show the FT-style /api/social card. The Meridian analysis
// loads and shows INLINE automatically -- no click needed.
import { useState, useEffect } from 'react';
import Head from 'next/head';

const SITE = 'https://www.meridiancapmarkets.com';
const ACCENT = {
  'M&A': '#e63946', 'LBO': '#a78bfa', 'LevFin': '#4a9eff', 'Project Finance': '#22c55e',
  'ECM': '#c084fc', 'Restructuring': '#f43f5e', 'Debt Advisory': '#f59e0b',
  'Macro': '#38bdf8', 'Earnings': '#fb923c', 'Markets': '#a3e635',
};
const curSym = (c) => (c === 'USD' ? '$' : c === 'GBP' ? String.fromCharCode(163) : String.fromCharCode(8364));
function fmtValue(v, sym) {
  const n = Number(v);
  if (!n) return '';
  return n >= 1000 ? sym + (n / 1000).toFixed(1) + 'Bn' : sym + n + 'M';
}
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export async function getServerSideProps(ctx) {
  const q = ctx.query || {};
  let id = String(q.id || '');
  if (!id && q.slug) {
    const m = String(q.slug).match(/(\d+)$/);
    id = m ? m[1] : '';
  }
  let deal = null;
  if (id) {
    try {
      const r = await fetch(SITE + '/api/deals?limit=100');
      if (r.ok) {
        const j = await r.json();
        const arr = (j && j.deals) || [];
        deal = arr.find((d) => String(d.id) === id) || null;
      }
    } catch (e) {}
  }
  return { props: { deal, id } };
}

export default function DealPage({ deal, id }) {
  const [analysis, setAnalysis] = useState((deal && deal.analysis) || '');
  const [loadingA, setLoadingA] = useState(false);

  useEffect(() => {
    if (!deal || analysis) return;
    let alive = true;
    setLoadingA(true);
    fetch('/api/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deal }),
    })
      .then((r) => r.json())
      .then((d) => { if (alive && d && d.analysis) setAnalysis(d.analysis); })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingA(false); });
    return () => { alive = false; };
  }, [deal, analysis]);

  if (!deal) {
    return (
      <>
        <Head>
          <title>Meridian -- Capital Markets Intelligence</title>
          <meta name="description" content="Live M&A and capital-markets deal intelligence." />
        </Head>
        <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'var(--s)', textAlign: 'center', padding: 24 }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 40, fontWeight: 800, color: 'var(--text-hi)', textDecoration: 'none' }}>MERIDIAN</a>
          <div style={{ color: 'var(--text-mid)' }}>This deal is no longer available.</div>
          <a href="/" style={{ color: 'var(--gold)', fontWeight: 700, textDecoration: 'none' }}>Go to the latest deals -&gt;</a>
        </main>
      </>
    );
  }

  const accent = ACCENT[deal.type] || '#c9b99a';
  const headline = deal.headline || 'Capital markets deal';
  const summary = deal.summary || '';
  const type = deal.type || 'DEAL';
  const sector = deal.sector || '';
  const status = (deal.status || '').toUpperCase();
  const date = deal.date || '';
  const value = fmtValue(deal.value, curSym(deal.currency));
  const slug = slugify(headline);
  const url = SITE + '/deal/' + (slug ? slug + '-' : '') + id;
  const img = SITE + '/api/social?headline=' + encodeURIComponent(headline) +
    '&type=' + encodeURIComponent(type) + '&sector=' + encodeURIComponent(sector) +
    '&status=' + encodeURIComponent(status) + '&date=' + encodeURIComponent(date);
  const desc = (summary || headline).slice(0, 200);
  const hasBuyer = deal.buyer && deal.buyer !== 'N/A';
  const hasTarget = deal.target && deal.target !== 'N/A';

  return (
    <>
      <Head>
        <title>{headline + ' -- Meridian'}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Meridian" />
        <meta property="og:title" content={headline} />
        <meta property="og:description" content={desc} />
        <meta property="og:image" content={img} />
        <meta property="og:url" content={url} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={headline} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={img} />
      </Head>

      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '10px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 24, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <article style={{ maxWidth: 760, margin: '0 auto', padding: '40px 22px 60px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
            <span style={{ background: accent, color: '#fff', fontFamily: 'var(--s)', fontSize: 11, fontWeight: 800, letterSpacing: '.12em', padding: '4px 12px', textTransform: 'uppercase' }}>{type}</span>
            {sector ? <span style={{ fontFamily: 'var(--s)', fontSize: 11, color: 'var(--text-mid)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{sector}</span> : null}
            {status ? <span style={{ fontFamily: 'var(--s)', fontSize: 11, color: accent, fontWeight: 700, letterSpacing: '.08em' }}>{status}</span> : null}
          </div>

          <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(30px,5vw,50px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.15, margin: '0 0 18px' }}>{headline}</h1>

          <figure style={{ margin: '0 0 24px' }}>
            <div style={{ width: '100%', maxHeight: 430, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <img src={'/api/photo?sector=' + encodeURIComponent(sector || 'General') + '&id=' + (id || 0) + '&pv=4'} alt=""
                onError={(e)=>{e.currentTarget.closest('figure').style.display='none';}}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
            </div>
            <figcaption style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', marginTop: 6, letterSpacing: '.04em' }}>Photo via Pexels</figcaption>
          </figure>

          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'baseline', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
            {value ? (
              <div>
                <div style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>Value</div>
                <div style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: accent }}>{value}</div>
              </div>
            ) : null}
            {hasBuyer ? (
              <div>
                <div style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>Acquirer</div>
                <div style={{ fontFamily: 'var(--s)', fontSize: 15, fontWeight: 600, color: 'var(--text-hi)' }}>{deal.buyer}</div>
              </div>
            ) : null}
            {hasTarget ? (
              <div>
                <div style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>Target</div>
                <div style={{ fontFamily: 'var(--s)', fontSize: 15, fontWeight: 600, color: 'var(--text-hi)' }}>{deal.target}</div>
              </div>
            ) : null}
          </div>

          <p style={{ fontFamily: 'var(--r)', fontSize: 18, color: 'var(--text-body)', lineHeight: 1.8, margin: '0 0 26px' }}>{deal.summary}</p>

          {(analysis || loadingA) ? (
            <div style={{ marginBottom: 30, paddingTop: 22, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--s)', fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: accent, textTransform: 'uppercase', marginBottom: 12 }}>&#10022; Meridian Analysis</div>
              {loadingA && !analysis ? (
                <div style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-mid)', fontStyle: 'italic' }}>Drafting editorial analysis...</div>
              ) : null}
              {analysis ? (
                <div style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-body)', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{analysis}</div>
              ) : null}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontFamily: 'var(--s)', fontSize: 12, color: 'var(--text-mid)', marginBottom: 34 }}>
            {deal.source ? (deal.source_url
              ? <a href={deal.source_url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: accent, textDecoration: 'none', fontWeight: 700 }}>Read the original at {deal.source} &rarr;</a>
              : <span>Source: {deal.source}</span>) : null}
            {date ? <span>{date}</span> : null}
            {deal.geography ? <span>{deal.geography}</span> : null}
          </div>

          <a href="/" style={{ display: 'inline-block', background: accent, color: '#fff', fontFamily: 'var(--s)', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', padding: '12px 22px', textDecoration: 'none' }}>MORE DEALS ON MERIDIAN -&gt;</a>
        </article>
      </div>
    </>
  );
}
