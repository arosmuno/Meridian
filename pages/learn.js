// pages/learn.js -- MERIDIAN LEARN: a curated library (Books / Resources / Podcasts / Miscellaneous).
import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import AdSlot from '../components/AdSlot';
import { RESOURCES, GROUPS } from '../lib/learnResources';

const GROUP_META = {
  Books: { accent: '#d4a853', tag: 'The canon', desc: 'The books worth actually reading -- from value-investing scripture to the narratives that show how deals really happen.' },
  Resources: { accent: '#4a9eff', tag: 'Learn for free', desc: 'Free, high-signal places to learn valuation, markets and how the industry really works. No paywalls, no fluff.' },
  Podcasts: { accent: '#a78bfa', tag: 'Listen', desc: 'Long-form conversations that make the commute smarter -- deals, strategy and the people behind them.' },
  Miscellaneous: { accent: '#22c55e', tag: 'The toolkit', desc: 'The daily newsletters, data tools and communities that keep you sharp and current.' },
};

// Ruta visual "de cero a IB": etapas ordenadas de principiante a avanzado.
const IB_STEPS = [
  { n: 1, color: '#22c55e', title: 'Foundations', desc: 'How markets, companies and deals fit together. Build the vocabulary.' },
  { n: 2, color: '#4a9eff', title: 'Accounting', desc: 'Read the income statement, balance sheet and cash flows fluently.' },
  { n: 3, color: '#a78bfa', title: 'Valuation', desc: 'DCF, trading comps and precedent transactions -- what a business is worth.' },
  { n: 4, color: '#d4a853', title: 'Modeling', desc: 'Build 3-statement and LBO models in Excel from a blank sheet.' },
  { n: 5, color: '#fb923c', title: 'Deal types', desc: 'M&A, LBOs, IPOs/ECM, debt and restructuring -- how each actually works.' },
  { n: 6, color: '#e63946', title: 'Recruiting', desc: 'Network, earn referrals, sharpen your story and ace the technicals.' },
];

function PathToIB() {
  return (
    <section style={{ maxWidth: 1100, margin: '0 auto', padding: '30px 20px 6px' }}>
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--s)', fontSize: 9, letterSpacing: '.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>&#10022; The roadmap</div>
        <h2 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(26px,3.4vw,40px)', fontWeight: 800, color: 'var(--text-hi)', margin: '0 0 6px', letterSpacing: '-.01em' }}>The Path to Investment Banking</h2>
        <p style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-mid)', fontStyle: 'italic', maxWidth: 620, margin: '0 auto', lineHeight: 1.6 }}>From zero to offer -- the six stages, in order. Use the library below to work through each one.</p>
      </div>
      <div className="ib-path" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
        {IB_STEPS.map((s, i) => (
          <div key={s.n} style={{ flex: '1 1 150px', minWidth: 140, maxWidth: 200, position: 'relative', padding: '0 6px' }}>
            <div style={{ position: 'relative', height: 46, marginBottom: 12 }}>
              <div style={{ position: 'absolute', top: 22, left: i === 0 ? '50%' : 0, right: i === IB_STEPS.length - 1 ? '50%' : 0, height: 2, background: 'var(--border)' }} />
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 46, height: 46, borderRadius: '50%', background: s.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--d)', fontSize: 21, fontWeight: 800, zIndex: 1, border: '3px solid var(--bg)' }}>{s.n}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--s)', fontSize: 12.5, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.02em', textTransform: 'uppercase' }}>{s.title}</div>
              <p style={{ fontFamily: 'var(--r)', fontSize: 11.5, color: 'var(--text-mid)', margin: '5px 0 0', lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResourceCard({ r, accent }) {
  return (
    <a className="card" href={r.url} target="_blank" rel="noopener noreferrer"
      style={{ textDecoration: 'none', padding: '16px 18px 15px', gap: 9, borderLeft: `3px solid ${accent}` }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = accent; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.borderLeftColor = accent; }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: accent, border: `1px solid ${accent}`, padding: '2px 8px', fontFamily: 'var(--s)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{r.type}</span>
        {r.free && <span style={{ background: '#041b0d', color: '#4ade80', border: '1px solid #15532e', padding: '2px 8px', fontFamily: 'var(--s)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>Free</span>}
      </div>
      <h3 style={{ fontFamily: 'var(--d)', fontSize: 19, fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.25, margin: '2px 0 0' }}>{r.name}</h3>
      <div style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.provider}</div>
      <p style={{ fontFamily: 'var(--r)', fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.7, margin: '2px 0 0', flexGrow: 1 }}>{r.blurb}</p>
      <span style={{ fontFamily: 'var(--s)', fontSize: 11, color: accent, fontWeight: 700, letterSpacing: '.06em', marginTop: 6 }}>Visit &rarr;</span>
    </a>
  );
}

export default function Learn() {
  const [theme, setTheme] = useState('light');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');

  useEffect(() => {
    try { const s = localStorage.getItem('meridian_theme_v2'); if (s === 'light' || s === 'dark') setTheme(s); } catch (e) {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('meridian_theme_v2', theme); } catch (e) {}
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return RESOURCES.filter((r) => {
      if (group !== 'All' && r.group !== group) return false;
      if (needle) {
        const hay = `${r.name} ${r.provider} ${r.blurb} ${r.type}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [q, group]);

  const total = filtered.length;
  const shownGroups = group === 'All' ? GROUPS : [group];

  return (
    <>
      <Head>
        <title>Meridian Learn -- The best books, resources &amp; podcasts to master M&amp;A, capital markets &amp; investing</title>
        <meta name="description" content="A hand-picked library to learn capital markets, M&A, private equity, valuation and investing: the best books, free resources, podcasts and tools -- curated, no paid-course noise." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/learn" />
      </Head>

      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        {/* MASTHEAD */}
        <div style={{ background: 'var(--bg-card)', borderBottom: '3px double var(--border)' }}>
          <div className="masthead-top" style={{ borderBottom: '1px solid var(--border)', padding: '6px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <a href="/" style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.08em', textDecoration: 'none' }}>&larr; BACK TO MERIDIAN</a>
            <span style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.08em' }}>CURATED LEARNING LIBRARY</span>
            <button onClick={toggleTheme} title="Light / dark" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-mid)', padding: '3px 9px', fontSize: 13, lineHeight: 1, cursor: 'pointer' }}>
              {String.fromCharCode(theme === 'dark' ? 9728 : 9790)}
            </button>
          </div>

          <div style={{ textAlign: 'center', padding: '26px 24px 22px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--s)', fontSize: 9, letterSpacing: '.35em', color: 'var(--text-mid)', marginBottom: 8 }}>&#10022; &nbsp; THE CAPITAL MARKETS INTELLIGENCE REVIEW &nbsp; &#10022;</div>
            <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(40px,6.5vw,72px)', fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '-.02em', lineHeight: 1, margin: '0 0 10px' }}>MERIDIAN LEARN</h1>
            <p style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', fontStyle: 'italic', maxWidth: 660, margin: '0 auto', lineHeight: 1.6 }}>
              A hand-picked library to actually learn this business -- the best books, free resources and podcasts on capital markets, M&amp;A, private equity and investing. Only what we would recommend to a friend.
            </p>
          </div>
        </div>

        {/* PATH TO IB */}
        <PathToIB />

        {/* CONTROLS */}
        <div className="content-area" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0 14px', borderBottom: '2px solid var(--border)', flexWrap: 'wrap', gap: 12 }}>
            <div className="filter-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All', ...GROUPS].map((g) => (
                <button key={g} className={`pill ${group === g ? 'active' : ''}`} onClick={() => setGroup(g)}>{g}</button>
              ))}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library..."
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-hi)', padding: '6px 12px', fontFamily: 'var(--s)', fontSize: 12, minWidth: 220, outline: 'none' }} />
          </div>

          {/* Ad banner */}
          <div style={{ padding: '14px 0 4px' }}>
            <AdSlot slot="learn-top" format="horizontal" style={{ maxWidth: 728, margin: '0 auto' }} />
          </div>

          {/* SECTIONS */}
          <div style={{ padding: '8px 0 44px' }}>
            {shownGroups.map((g, gi) => {
              const items = filtered.filter((r) => r.group === g);
              if (!items.length) return null;
              const meta = GROUP_META[g] || { accent: 'var(--gold)', tag: '', desc: '' };
              return (
                <section key={g} style={{ marginTop: gi === 0 ? 20 : 40 }}>
                  <div style={{ borderTop: `2px solid ${meta.accent}`, paddingTop: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--s)', fontSize: 9, fontWeight: 800, letterSpacing: '.18em', color: meta.accent, textTransform: 'uppercase' }}>{meta.tag}</span>
                      <h2 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(24px,3vw,34px)', fontWeight: 800, color: 'var(--text-hi)', margin: 0, letterSpacing: '-.01em' }}>{g}</h2>
                      <span style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)' }}>{items.length}</span>
                    </div>
                    <p style={{ fontFamily: 'var(--r)', fontSize: 13, color: 'var(--text-mid)', fontStyle: 'italic', margin: '6px 0 0', maxWidth: 680, lineHeight: 1.6 }}>{meta.desc}</p>
                  </div>
                  <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {items.map((r) => <ResourceCard key={r.name} r={r} accent={meta.accent} />)}
                  </div>
                  {gi === 0 && group === 'All' && (
                    <div style={{ marginTop: 20 }}>
                      <AdSlot slot="learn-mid" format="horizontal" />
                    </div>
                  )}
                </section>
              );
            })}

            {total === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: 'var(--r)', color: 'var(--text-mid)', fontStyle: 'italic' }}>No resources match your search.</div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '18px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 18, color: 'var(--text-mid)', letterSpacing: '.15em', textDecoration: 'none' }}>MERIDIAN</a>
          <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', marginTop: 3, letterSpacing: '.06em' }}>
            LEARN &middot; DEALS &middot; CAPITAL &middot; STRATEGY
          </div>
          <div style={{ marginTop: 8 }}>
            <a href="/privacidad" style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)', textDecoration: 'none', letterSpacing: '.06em' }}>Politica de privacidad</a>
          </div>
        </div>
      </div>
    </>
  );
}
