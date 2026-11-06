// pages/alberto.js -- perfil profesional de Alberto (Meridian Modelling).
// Pensado para quien llega desde Upwork, Fiverr, Malt o LinkedIn: que vea en un minuto
// quien es, que hace, con que experiencia y como contratarle.
// Sin nombres de clientes ni de bancos en las operaciones: descripcion generica.
import Head from 'next/head';

const H2 = (p) => <h2 style={{ fontFamily: 'var(--s)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', margin: '40px 0 14px' }}>{p.children}</h2>;
const P = (p) => <p style={{ fontFamily: 'var(--r)', fontSize: 17, color: 'var(--text-body)', lineHeight: 1.8, margin: '0 0 16px' }}>{p.children}</p>;

const SERVICES = [
  {
    name: 'Build',
    line: 'A new model from your business plan, deck or notes.',
    items: ['3-statement model (P&L, balance sheet, cash flow) that ties, with checks', 'One assumptions sheet, Base / Upside / Downside switch', 'Funding need, debt sizing or valuation, depending on what it is for'],
    time: 'Typically 5–7 days',
  },
  {
    name: 'Fix',
    line: 'The model you already have, made reliable.',
    items: ['Broken formulas, hardcodes and circular references', 'Scenario switches, checks and a clean structure', 'Excel macros where they save real time'],
    time: 'Typically 2–4 days',
  },
  {
    name: 'Review',
    line: 'A second pair of eyes before an investor or a bank opens it.',
    items: ['Line-by-line check of logic, links and assumptions', 'Findings log: each issue, its impact and the fix', 'A short call to walk you through it'],
    time: 'Typically 2–3 days',
  },
];

const DEALS = [
  ['Project finance', 'Offshore wind, Poland', '~€2bn financing of a 390 MW offshore wind farm. Lender side, within the bank syndicate.'],
  ['Acquisition finance', 'Hydro, Spain', 'Financing for the acquisition of a 175 MW portfolio of 23 small hydro plants.'],
  ['Bridge financing', 'Gas distribution, Iberia', 'Two bridge loans supporting a sponsor’s stake in a gas distribution business.'],
  ['M&A', 'Data centres, Spain', 'Sale of a data-centre platform to a European private equity fund. Coverage and coordination with the M&A teams.'],
  ['Corporate lending', 'Energy, industrials, consumer', 'Dozens of working capital, short-term and trade finance facilities of €10–200m.'],
];

export default function Alberto() {
  return (
    <>
      <Head>
        <title>Alberto Rosado -- Financial modelling and transaction support | Meridian</title>
        <meta name="description" content="Financial models that hold up when an investor or a bank opens them. Build, fix and review, from a former corporate and investment banker (Project Finance, M&A, LevFin). Madrid, Spanish and English." />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <article style={{ maxWidth: 820, margin: '0 auto', padding: '48px 22px 64px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--text-mid)', textTransform: 'uppercase', marginBottom: 10 }}>Meridian Modelling</div>
          <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,56px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.08, margin: '0 0 8px' }}>Alberto Rosado</h1>
          <div style={{ fontFamily: 'var(--s)', fontSize: 13, color: 'var(--text-mid)', letterSpacing: '.04em', margin: '0 0 26px' }}>Financial modelling and transaction support &middot; Madrid &middot; Spanish and English</div>

          <p style={{ fontFamily: 'var(--r)', fontSize: 21, color: 'var(--text-hi)', lineHeight: 1.6, margin: '0 0 18px' }}>
            I build, fix and review financial models: the kind that hold up when an investor or a bank actually opens them.
          </p>
          <P>I spent five years in corporate and investment banking at BBVA and BNP Paribas, working on Project Finance, M&amp;A, Leveraged Finance and Debt Advisory deals, mostly for energy and infrastructure sponsors. I built the first numbers, prepared the credit papers and sat in the process that decides which deals get approved. Today I work in value creation at an infrastructure investor, and I run Meridian.</P>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '26px 0 6px' }}>
            <a href="mailto:arosmuno@gmail.com?subject=Financial%20model" style={{ background: 'var(--text-hi)', color: 'var(--bg)', fontFamily: 'var(--s)', fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', padding: '12px 20px', textDecoration: 'none' }}>Send me your file</a>
            <a href="#samples" style={{ border: '1px solid var(--border-hi)', color: 'var(--text-hi)', fontFamily: 'var(--s)', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', padding: '12px 20px', textDecoration: 'none' }}>See samples</a>
          </div>

          <H2>What I do</H2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            {SERVICES.map((s) => (
              <div key={s.name} style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: '20px 20px 18px' }}>
                <div style={{ fontFamily: 'var(--d)', fontSize: 22, fontWeight: 800, color: 'var(--text-hi)', marginBottom: 6 }}>{s.name}</div>
                <div style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', lineHeight: 1.6, marginBottom: 12 }}>{s.line}</div>
                <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
                  {s.items.map((i) => <li key={i} style={{ fontFamily: 'var(--s)', fontSize: 13, color: 'var(--text-body)', lineHeight: 1.7 }}>{i}</li>)}
                </ul>
                <div style={{ fontFamily: 'var(--s)', fontSize: 11, color: 'var(--text-mid)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{s.time}</div>
              </div>
            ))}
          </div>
          <P><span style={{ fontSize: 15, color: 'var(--text-mid)' }}>Fixed price, agreed before I start. Not sure which one you need? Send the file or a short description and I’ll tell you honestly.</span></P>

          <H2>Selected experience</H2>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {DEALS.map(([type, where, what]) => (
              <div key={what} style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: '0 0 190px' }}>
                  <div style={{ fontFamily: 'var(--s)', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--gold)' }}>{type}</div>
                  <div style={{ fontFamily: 'var(--s)', fontSize: 12, color: 'var(--text-mid)', marginTop: 2 }}>{where}</div>
                </div>
                <div style={{ flex: '1 1 320px', fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', lineHeight: 1.6 }}>{what}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--s)', fontSize: 11, color: 'var(--text-lo)', marginTop: 8 }}>Clients are not named. Each deal is described from public information only.</div>

          <H2>How I work</H2>
          <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
            {[
              'One assumptions sheet. No hidden hardcodes. Every statement ties, with checks you can see.',
              'Built so you understand it, not just receive it: clear layout and a short note on how it works.',
              'Excel by default; Google Sheets on request (without macros).',
              'Your files stay confidential. NDA on request; client work is never reused or shared.',
              'Spanish or English, whichever you prefer.',
            ].map((t) => <li key={t} style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-body)', lineHeight: 1.8 }}>{t}</li>)}
          </ul>

          <H2><span id="samples">Samples</span></H2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 20 }}>
              <div style={{ fontFamily: 'var(--d)', fontSize: 18, fontWeight: 800, color: 'var(--text-hi)', marginBottom: 6 }}>SaaS model, 5 years</div>
              <div style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', lineHeight: 1.6 }}>Investor-ready 3-statement model for a B2B SaaS: customer cohorts, ARR, unit economics (LTV/CAC, payback), full financial statements, scenario switch and a funding-gap check.</div>
            </div>
            <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', padding: 20 }}>
              <div style={{ fontFamily: 'var(--d)', fontSize: 18, fontWeight: 800, color: 'var(--text-hi)', marginBottom: 6 }}>Model review and fix</div>
              <div style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', lineHeight: 1.6 }}>A 12-month SME budget as received, the findings log and the rebuilt version. Seven issues, including rent never deducted from EBITDA: full-year EBITDA was overstated by €72k and December cash by €97k.</div>
            </div>
          </div>
          <P><span style={{ fontSize: 15, color: 'var(--text-mid)' }}>Both files are available on request, in Excel.</span></P>

          <H2>Background</H2>
          <P>BSc (Hons) Business Economics &middot; Master’s in M&amp;A and Corporate Finance (ISBIF). Five years in corporate and investment banking (BBVA, BNP Paribas) across Project Finance, M&amp;A, Leveraged Finance and Debt Advisory. Now in value creation at an infrastructure investor. More about Meridian on the <a href="/about" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>about page</a>.</P>

          <div style={{ border: '1px solid var(--border-hi)', padding: '24px 24px 20px', marginTop: 36, textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--d)', fontSize: 24, fontWeight: 800, color: 'var(--text-hi)', marginBottom: 8 }}>Have a model that needs to be right?</div>
            <div style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-body)', marginBottom: 16 }}>Send it over with a line on what it is for. I’ll reply with scope and a fixed price, usually the same day.</div>
            <a href="mailto:arosmuno@gmail.com?subject=Financial%20model" style={{ fontFamily: 'var(--d)', fontSize: 20, fontWeight: 700, color: 'var(--gold)', textDecoration: 'none' }}>arosmuno@gmail.com</a>
          </div>
        </article>

        <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '16px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.06em' }}>
            <a href="/about" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>About</a>
            <a href="/academy" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Academy</a>
            <a href="/contact" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Contact</a>
            <a href="/privacy" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Privacy</a>
          </div>
        </div>
      </div>
    </>
  );
}
