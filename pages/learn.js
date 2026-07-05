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

// Ruta INTERACTIVA "de cero a IB": clic en cada etapa para explorarla.
const IB_STEPS = [
  {
    n: 1, color: '#22c55e', icon: 'foundations', title: 'Foundations', tag: 'Understand the field',
    desc: "Get the lay of the land: what investment banks actually do, how deals and capital markets fit together, and the vocabulary everyone assumes you already know.",
    skills: ['Financial literacy', 'Market awareness', 'The lingo'],
    learn: ['What the IB divisions do: M&A, ECM, DCM, advisory', 'How a deal flows from first pitch to close', "Who's who: sponsors, advisors, lenders and targets"],
  },
  {
    n: 2, color: '#4a9eff', icon: 'accounting', title: 'Accounting', tag: 'Read the numbers',
    desc: 'Learn to read the three financial statements fluently and see how they connect -- the language every valuation and model is built on.',
    skills: ['Income statement', 'Balance sheet', 'Cash flow'],
    learn: ['How the three statements link together', 'Accruals, working capital and D&A', 'Reading a 10-K and an annual report'],
  },
  {
    n: 3, color: '#a78bfa', icon: 'valuation', title: 'Valuation', tag: 'What is it worth?',
    desc: 'Master the core valuation toolkit -- how bankers put a defensible number on a business from three independent angles.',
    skills: ['DCF', 'Trading comps', 'Precedents'],
    learn: ['Discounted cash flow and WACC', 'Comparable companies and multiples', 'Precedent transactions and control premia'],
  },
  {
    n: 4, color: '#d4a853', icon: 'modeling', title: 'Modeling', tag: 'Build it in Excel',
    desc: 'Turn theory into models: build a 3-statement model and an LBO from a blank sheet, the way analysts are actually trained.',
    skills: ['3-statement', 'LBO', 'Excel speed'],
    learn: ['A fully-linked 3-statement model', 'LBO mechanics: debt, returns and IRR', 'Formatting, shortcuts and best practice'],
  },
  {
    n: 5, color: '#fb923c', icon: 'deals', title: 'Deal types', tag: 'How deals really work',
    desc: 'Understand the mechanics of each transaction type and what makes them tick -- so you can talk about live deals with confidence.',
    skills: ['M&A', 'LBO', 'ECM / DCM'],
    learn: ['M&A: strategic versus financial buyers', 'LBOs, IPOs and follow-on offerings', 'Debt financing and restructuring'],
  },
  {
    n: 6, color: '#e63946', icon: 'recruiting', title: 'Recruiting', tag: 'Land the offer',
    desc: 'Put it all together: build your story, network your way in, and walk into interviews ready for the technicals and the fit questions.',
    skills: ['Networking', 'Your story', 'Technicals'],
    learn: ['Coffee chats and earning referrals', 'A crisp story: why banking, why you', 'Acing technical and behavioural interviews'],
  },
];

function IbIcon({ name, size = 22 }) {
  const d = {
    foundations: 'M3 21h18M5 21V9l7-5 7 5v12M10 21v-5h4v5',
    accounting: 'M7 3h7l4 4v14H7zM14 3v4h4M9 12h6M9 16h4',
    valuation: 'M12 3v18M6 7h12M8 7l-3 6a3 3 0 006 0zM19 7l-3 6a3 3 0 006 0z',
    modeling: 'M3 4h18v16H3zM3 9h18M3 14h18M9 4v16M15 4v16',
    deals: 'M4 8h13l-3-3M20 16H7l3 3',
    recruiting: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M17 3.1a4 4 0 010 7.8',
  }[name] || '';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function PathToIB() {
  const [active, setActive] = useState(0);
  const s = IB_STEPS[active];
  const last = IB_STEPS.length - 1;
  const pct = active / last;
  return (
    <section style={{ maxWidth: 1000, margin: '0 auto', padding: '34px 20px 8px' }}>
      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{ fontFamily: 'var(--s)', fontSize: 9, letterSpacing: '.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 6 }}>&#10022; The roadmap</div>
        <h2 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(26px,3.4vw,40px)', fontWeight: 800, color: 'var(--text-hi)', margin: '0 0 6px', letterSpacing: '-.01em' }}>The Path to Investment Banking</h2>
        <p style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-mid)', fontStyle: 'italic', maxWidth: 620, margin: '0 auto', lineHeight: 1.6 }}>From zero to offer -- six stages, in order. Click any stage to explore it.</p>
      </div>

      {/* Stepper interactivo */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '0 auto 22px', maxWidth: 860 }}>
        <div style={{ position: 'absolute', top: 25, left: 25, right: 25, height: 3, background: 'var(--border)', borderRadius: 3 }} />
        <div style={{ position: 'absolute', top: 25, left: 25, height: 3, width: 'calc((100% - 50px) * ' + pct + ')', background: s.color, borderRadius: 3, transition: 'width .4s ease, background .3s' }} />
        {IB_STEPS.map((st, i) => {
          const on = i === active;
          const done = i < active;
          return (
            <button key={st.n} onClick={() => setActive(i)} aria-label={st.title}
              style={{ position: 'relative', zIndex: 1, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: 0, flex: '0 0 auto', width: 92 }}>
              <span style={{ width: 50, height: 50, borderRadius: '50%', background: (on || done) ? st.color : 'var(--bg-card)', color: (on || done) ? '#fff' : 'var(--text-mid)', border: '3px solid ' + (on || done ? st.color : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .25s ease', transform: on ? 'scale(1.14)' : 'scale(1)', boxShadow: on ? '0 0 0 5px ' + st.color + '22, 0 8px 20px ' + st.color + '55' : 'none' }}>
                <IbIcon name={st.icon} size={22} />
              </span>
              <span style={{ fontFamily: 'var(--s)', fontSize: 10.5, fontWeight: on ? 800 : 600, color: on ? 'var(--text-hi)' : 'var(--text-mid)', letterSpacing: '.03em', textTransform: 'uppercase', transition: 'all .2s' }}>{st.title}</span>
            </button>
          );
        })}
      </div>

      {/* Panel de detalle de la etapa activa */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: '4px solid ' + s.color, padding: '24px 26px', display: 'flex', flexWrap: 'wrap', gap: 28 }}>
        <div style={{ flex: '1 1 320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 12 }}>
            <span style={{ width: 46, height: 46, borderRadius: 12, background: s.color + '1a', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IbIcon name={s.icon} size={24} />
            </span>
            <div>
              <div style={{ fontFamily: 'var(--s)', fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: s.color, textTransform: 'uppercase' }}>Stage {s.n} &middot; {s.tag}</div>
              <h3 style={{ fontFamily: 'var(--d)', fontSize: 27, fontWeight: 800, color: 'var(--text-hi)', margin: '2px 0 0', letterSpacing: '-.01em' }}>{s.title}</h3>
            </div>
          </div>
          <p style={{ fontFamily: 'var(--r)', fontSize: 14.5, color: 'var(--text-body)', lineHeight: 1.75, margin: 0 }}>{s.desc}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 15 }}>
            {s.skills.map((sk) => (
              <span key={sk} style={{ fontFamily: 'var(--s)', fontSize: 11, fontWeight: 700, color: s.color, border: '1px solid ' + s.color + '66', background: s.color + '12', padding: '4px 11px', borderRadius: 20, letterSpacing: '.03em' }}>{sk}</span>
            ))}
          </div>
        </div>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, fontWeight: 800, letterSpacing: '.14em', color: 'var(--text-mid)', textTransform: 'uppercase', marginBottom: 12 }}>What you will learn</div>
          {s.learn.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', marginBottom: 11 }}>
              <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: s.color + '1a', color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--s)', fontSize: 11, fontWeight: 800, marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-body)', lineHeight: 1.55 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Navegacion previa / siguiente */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <button onClick={() => setActive((a) => Math.max(0, a - 1))} disabled={active === 0}
          style={{ background: 'none', border: '1px solid var(--border)', color: active === 0 ? 'var(--text-lo)' : 'var(--text-mid)', fontFamily: 'var(--s)', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', padding: '8px 16px', cursor: active === 0 ? 'default' : 'pointer', opacity: active === 0 ? 0.5 : 1 }}>&larr; Prev</button>
        <div style={{ display: 'flex', gap: 7 }}>
          {IB_STEPS.map((st, i) => (
            <span key={i} onClick={() => setActive(i)} style={{ width: i === active ? 22 : 8, height: 8, borderRadius: 4, background: i === active ? st.color : 'var(--border-hi)', cursor: 'pointer', transition: 'all .3s' }} />
          ))}
        </div>
        <button onClick={() => setActive((a) => Math.min(last, a + 1))} disabled={active === last}
          style={{ background: active === last ? 'none' : s.color, border: '1px solid ' + (active === last ? 'var(--border)' : s.color), color: active === last ? 'var(--text-lo)' : '#fff', fontFamily: 'var(--s)', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', padding: '8px 16px', cursor: active === last ? 'default' : 'pointer', opacity: active === last ? 0.5 : 1 }}>Next &rarr;</button>
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
            <a href="/privacy" style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-mid)', textDecoration: 'none', letterSpacing: '.06em' }}>Privacy Policy</a>
          </div>
        </div>
      </div>
    </>
  );
}
