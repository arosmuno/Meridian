// pages/academy.js -- MERIDIAN ACADEMY: modelos Excel, guia y coaching.
import { useState, useEffect } from 'react';
import Head from 'next/head';
import NewsletterSignup from '../components/NewsletterSignup';
import { PRODUCTS, GROUPS, GROUP_META } from '../lib/academy';

function ProductCard({ p, accent }) {
  const [open, setOpen] = useState(false);
  const live = !!p.url;
  const action = p.group === 'Coaching' ? 'Book a slot' : 'Get it';
  return (
    <div className="card" style={{ padding: '18px 18px 16px', gap: 9, borderLeft: `3px solid ${accent}`, background: p.featured ? 'var(--bg-hover)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ color: accent, border: `1px solid ${accent}`, padding: '2px 8px', fontFamily: 'var(--s)', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{p.featured ? 'Best value' : p.group}</span>
        <span style={{ fontFamily: 'var(--d)', fontSize: 20, fontWeight: 800, color: 'var(--text-hi)' }}>{p.price}</span>
      </div>
      <h3 style={{ fontFamily: 'var(--d)', fontSize: 19, fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.25, margin: '2px 0 0' }}>{p.name}</h3>
      <p style={{ fontFamily: 'var(--r)', fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.7, margin: 0 }}>{p.blurb}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '2px 0 0', flexGrow: 1 }}>
        {p.bullets.map((b) => (
          <li key={b} style={{ fontFamily: 'var(--s)', fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.7 }}>
            <span style={{ color: accent, marginRight: 7 }}>&#10003;</span>{b}
          </li>
        ))}
      </ul>
      {live ? (
        <a href={p.url} target="_blank" rel="noopener noreferrer"
          style={{ marginTop: 6, textAlign: 'center', background: accent, color: '#fff', fontFamily: 'var(--s)', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', padding: '10px 14px', textDecoration: 'none' }}>
          {action} &rarr;
        </a>
      ) : open ? (
        <div style={{ marginTop: 6 }}><NewsletterSignup compact source="academy" interest={p.id} cta="Notify me" /></div>
      ) : (
        <button onClick={() => setOpen(true)}
          style={{ marginTop: 6, background: 'none', border: `1px solid ${accent}`, color: accent, fontFamily: 'var(--s)', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', padding: '10px 14px', cursor: 'pointer' }}>
          Coming soon &middot; Join the waitlist
        </button>
      )}
    </div>
  );
}

export default function Academy() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    try { const s = localStorage.getItem('meridian_theme_v2'); if (s === 'light' || s === 'dark') setTheme(s); } catch (e) {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('meridian_theme_v2', theme); } catch (e) {}
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <Head>
        <title>Meridian Academy -- Financial models, the guide to breaking in, and 1:1 coaching</title>
        <meta name="description" content="Project finance, LBO and DCF Excel models, a practical guide to breaking into M&A, LevFin and project finance in Spain, and CV reviews and mock interviews." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/academy" />
      </Head>

      <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
        <div style={{ background: 'var(--bg-card)', borderBottom: '3px double var(--border)' }}>
          <div className="masthead-top" style={{ borderBottom: '1px solid var(--border)', padding: '6px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <a href="/" style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.08em', textDecoration: 'none' }}>&larr; BACK TO MERIDIAN</a>
            <span style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.08em' }}>MODELS &middot; GUIDE &middot; COACHING</span>
            <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} title="Light / dark" style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-mid)', padding: '3px 9px', fontSize: 13, lineHeight: 1, cursor: 'pointer' }}>
              {String.fromCharCode(theme === 'dark' ? 9728 : 9790)}
            </button>
          </div>
          <div style={{ textAlign: 'center', padding: '26px 24px 22px' }}>
            <div style={{ fontFamily: 'var(--s)', fontSize: 9, letterSpacing: '.35em', color: 'var(--text-mid)', marginBottom: 8 }}>&#10022; &nbsp; THE CAPITAL MARKETS INTELLIGENCE REVIEW &nbsp; &#10022;</div>
            <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(40px,6.5vw,72px)', fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '-.02em', lineHeight: 1, margin: '0 0 10px' }}>MERIDIAN ACADEMY</h1>
            <p style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', fontStyle: 'italic', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
              The tools we wish we had when starting out: desk-grade Excel models, a straight guide to the Spanish market, and honest one-to-one preparation.
            </p>
          </div>
        </div>

        <div className="content-area" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 44px' }}>
          {GROUPS.map((g, gi) => {
            const items = PRODUCTS.filter((p) => p.group === g);
            const meta = GROUP_META[g];
            return (
              <section key={g} style={{ marginTop: gi === 0 ? 30 : 44 }}>
                <div style={{ borderTop: `2px solid ${meta.accent}`, paddingTop: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--s)', fontSize: 9, fontWeight: 800, letterSpacing: '.18em', color: meta.accent, textTransform: 'uppercase' }}>{meta.tag}</span>
                    <h2 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(24px,3vw,34px)', fontWeight: 800, color: 'var(--text-hi)', margin: 0 }}>{g}</h2>
                  </div>
                  <p style={{ fontFamily: 'var(--r)', fontSize: 13, color: 'var(--text-mid)', fontStyle: 'italic', margin: '6px 0 0', maxWidth: 680, lineHeight: 1.6 }}>{meta.desc}</p>
                </div>
                <div className="cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                  {items.map((p) => <ProductCard key={p.id} p={p} accent={meta.accent} />)}
                </div>
              </section>
            );
          })}

          <section style={{ marginTop: 50, background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '26px 22px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--s)', fontSize: 9, fontWeight: 800, letterSpacing: '.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>Free, every Monday</div>
            <h2 style={{ fontFamily: 'var(--d)', fontSize: 28, fontWeight: 800, color: 'var(--text-hi)', margin: '0 0 8px' }}>The Meridian Weekly</h2>
            <p style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-body)', maxWidth: 560, margin: '0 auto 16px', lineHeight: 1.6 }}>The week's largest M&amp;A, LevFin and infrastructure deals, with an Iberia section. Five minutes, sourced, no noise.</p>
            <NewsletterSignup source="academy-page" />
          </section>

          <p style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-lo)', textAlign: 'center', marginTop: 22, lineHeight: 1.7 }}>
            Educational material only. Models are generic templates and contain no client or employer data. Nothing here is investment advice.
          </p>
        </div>

        <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '18px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 18, color: 'var(--text-mid)', letterSpacing: '.15em', textDecoration: 'none' }}>MERIDIAN</a>
          <div style={{ marginTop: 8 }}>
            <a href="/learn" style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)', textDecoration: 'none', letterSpacing: '.06em', marginRight: 16 }}>Learn</a>
            <a href="/about" style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)', textDecoration: 'none', letterSpacing: '.06em', marginRight: 16 }}>About</a>
            <a href="/privacy" style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)', textDecoration: 'none', letterSpacing: '.06em' }}>Privacy Policy</a>
          </div>
        </div>
      </div>
    </>
  );
}
