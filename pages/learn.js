// pages/learn.js -- MERIDIAN LEARN: a curated, tiered learning library.
import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import AdSlot from '../components/AdSlot';
import { RESOURCES, GROUPS, TYPES } from '../lib/learnResources';

const LEVELS = ['All', 'Foundations', 'Intermediate', 'Advanced'];

function Badge({ children, tone }) {
  const tones = {
    type: { bg: 'transparent', color: 'var(--text-mid)', border: 'var(--border)' },
    level: { bg: 'transparent', color: 'var(--gold)', border: 'var(--gold)' },
    free: { bg: '#041b0d', color: '#4ade80', border: '#15532e' },
    paid: { bg: 'transparent', color: 'var(--text-lo)', border: 'var(--border)' },
  };
  const t = tones[tone] || tones.type;
  return (
    <span style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}`, padding: '2px 8px', fontFamily: 'var(--s)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

function ResourceCard({ r }) {
  return (
    <a className="card" href={r.url} target="_blank" rel="noopener noreferrer"
      style={{ textDecoration: 'none', padding: '18px 18px 16px', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 2 }}>
        <Badge tone="type">{r.type}</Badge>
        {r.level !== 'All' && <Badge tone="level">{r.level}</Badge>}
        <Badge tone={r.free ? 'free' : 'paid'}>{r.free ? 'Free' : 'Paid'}</Badge>
      </div>
      <h3 style={{ fontFamily: 'var(--d)', fontSize: 19, fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.25, margin: 0 }}>{r.name}</h3>
      <div style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{r.provider}</div>
      <p style={{ fontFamily: 'var(--r)', fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.7, margin: '2px 0 0', flexGrow: 1 }}>{r.blurb}</p>
      <span style={{ fontFamily: 'var(--s)', fontSize: 11, color: 'var(--gold)', fontWeight: 700, letterSpacing: '.06em', marginTop: 6 }}>Visit &rarr;</span>
    </a>
  );
}

export default function Learn() {
  const [theme, setTheme] = useState('dark');
  const [q, setQ] = useState('');
  const [level, setLevel] = useState('All');
  const [type, setType] = useState('All');

  useEffect(() => {
    try { const s = localStorage.getItem('meridian_theme'); if (s === 'light' || s === 'dark') setTheme(s); } catch (e) {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('meridian_theme', theme); } catch (e) {}
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const typeList = ['All', ...TYPES];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return RESOURCES.filter((r) => {
      if (level !== 'All' && r.level !== level && r.level !== 'All') return false;
      if (type !== 'All' && r.type !== type) return false;
      if (needle) {
        const hay = `${r.name} ${r.provider} ${r.blurb} ${r.type} ${r.level}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [q, level, type]);

  const total = filtered.length;

  return (
    <>
      <Head>
        <title>Meridian Learn -- Curated resources to master M&amp;A, capital markets, private equity &amp; investing</title>
        <meta name="description" content="A curated, tiered library of the best books, courses, newsletters, tools and podcasts to learn capital markets, M&A, investment banking, private equity and valuation -- from beginner to advanced." />
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

          <div style={{ textAlign: 'center', padding: '26px 24px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--s)', fontSize: 9, letterSpacing: '.35em', color: 'var(--text-mid)', marginBottom: 8 }}>&#10022; &nbsp; THE CAPITAL MARKETS INTELLIGENCE REVIEW &nbsp; &#10022;</div>
            <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(40px,6.5vw,72px)', fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '-.02em', lineHeight: 1, margin: '0 0 10px' }}>MERIDIAN LEARN</h1>
            <p style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', fontStyle: 'italic', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
              From first principles to the deal room. A hand-picked library of the books, courses, newsletters and tools worth your time -- to actually learn capital markets, M&amp;A, private equity and investing.
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="content-area" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0 12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 3, height: 16, background: 'var(--gold)', display: 'block' }} />
              <span style={{ fontFamily: 'var(--s)', fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: 'var(--gold)', textTransform: 'uppercase' }}>The Library</span>
              <span style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)' }}>{total} resource{total === 1 ? '' : 's'}</span>
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources..."
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-hi)', padding: '6px 12px', fontFamily: 'var(--s)', fontSize: 12, minWidth: 220, outline: 'none' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0 8px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)', letterSpacing: '.1em', textTransform: 'uppercase', minWidth: 46 }}>Level</span>
            <div className="filter-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {LEVELS.map((lv) => (
                <button key={lv} className={`pill ${level === lv ? 'active' : ''}`} onClick={() => setLevel(lv)}>{lv === 'All' ? 'All' : lv}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 14px', borderBottom: '2px solid var(--border)', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)', letterSpacing: '.1em', textTransform: 'uppercase', minWidth: 46 }}>Type</span>
            <div className="filter-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {typeList.map((tp) => (
                <button key={tp} className={`pill ${type === tp ? 'active' : ''}`} onClick={() => setType(tp)}>{tp}</button>
              ))}
            </div>
          </div>

          {/* Ad banner */}
          <div style={{ padding: '14px 0 4px' }}>
            <AdSlot slot="learn-top" format="horizontal" style={{ maxWidth: 728, margin: '0 auto' }} />
          </div>

          {/* GROUPED RESOURCES */}
          <div style={{ padding: '8px 0 40px' }}>
            {GROUPS.map((group, gi) => {
              const items = filtered.filter((r) => r.group === group);
              if (!items.length) return null;
              return (
                <section key={group} style={{ marginTop: gi === 0 ? 18 : 34 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ width: 3, height: 18, background: 'var(--gold)', display: 'block' }} />
                    <h2 style={{ fontFamily: 'var(--s)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--text-hi)', textTransform: 'uppercase', margin: 0 }}>{group}</h2>
                    <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <span style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)' }}>{items.length}</span>
                  </div>
                  <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {items.map((r) => <ResourceCard key={r.name} r={r} />)}
                  </div>
                  {gi === 1 && (
                    <div style={{ marginTop: 18 }}>
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
