// pages/methodology.js -- Como se construye Meridian. Que entra, que no, y por que.
// Esta pagina es el ancla de credibilidad del sitio: una base de datos de deals sin
// metodologia publicada no es un producto, es una lista.
import Head from 'next/head';
import { supabaseAdmin } from '../lib/supabase';

const SITE = 'https://www.meridiancapmarkets.com';

function Footer() {
  return (
    <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '16px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.06em' }}>
        <a href="/" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Home</a>
        <a href="/rankings" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Rankings</a>
        <a href="/methodology" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Methodology</a>
        <a href="/about" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>About</a>
        <a href="/learn" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Learn</a>
        <a href="/contact" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Contact</a>
      </div>
    </div>
  );
}

const H2 = (p) => <h2 style={{ fontFamily: 'var(--s)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', margin: '34px 0 12px' }}>{p.children}</h2>;
const P = (p) => <p style={{ fontFamily: 'var(--r)', fontSize: 17, color: 'var(--text-body)', lineHeight: 1.85, margin: '0 0 16px' }}>{p.children}</p>;
const LI = (p) => (
  <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', margin: '0 0 10px' }}>
    <span style={{ color: 'var(--gold)', fontFamily: 'var(--d)', fontWeight: 800, flexShrink: 0, lineHeight: 1.7 }}>&middot;</span>
    <span style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-body)', lineHeight: 1.75 }}>{p.children}</span>
  </div>
);

export async function getServerSideProps(ctx) {
  try { ctx.res.setHeader('Cache-Control', 'no-store, max-age=0'); } catch (e) {}

  let stats = { tracked: 0, eligible: 0, excluded: 0, volume: 0 };
  let fx = [];
  let reasons = [];

  try {
    const { count: tracked } = await supabaseAdmin
      .from('deals').select('id', { count: 'exact', head: true }).eq('category', 'deal');

    const { data: elig } = await supabaseAdmin
      .from('deals').select('value_eur')
      .eq('category', 'deal').is('excluded_reason', null).gt('value_eur', 0);

    const { count: excluded } = await supabaseAdmin
      .from('deals').select('id', { count: 'exact', head: true })
      .eq('category', 'deal').not('excluded_reason', 'is', null);

    const { data: rates } = await supabaseAdmin
      .from('fx_daily').select('currency').order('currency');

    stats = {
      tracked: tracked || 0,
      eligible: (elig || []).length,
      excluded: excluded || 0,
      volume: Math.round((elig || []).reduce((s, d) => s + Number(d.value_eur || 0), 0)),
    };
    fx = [...new Set((rates || []).map((r) => r.currency))].sort().map((c) => ({ currency: c }));

    const { data: rs } = await supabaseAdmin
      .from('deals').select('excluded_reason').not('excluded_reason', 'is', null).eq('category', 'deal');
    const tally = {};
    (rs || []).forEach((r) => { tally[r.excluded_reason] = (tally[r.excluded_reason] || 0) + 1; });
    reasons = Object.entries(tally).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  } catch (e) {}

  return { props: { stats, fx, reasons } };
}

export default function Methodology({ stats, fx, reasons }) {
  const bn = (m) => '€' + (m / 1000).toFixed(1) + 'bn';

  return (
    <>
      <Head>
        <title>Methodology -- Meridian</title>
        <meta name="description" content="How Meridian's deal database is built: what counts as a deal, what is excluded and why, how currencies are converted, and how to report an error." />
        <link rel="canonical" href={SITE + '/methodology'} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <article style={{ maxWidth: 760, margin: '0 auto', padding: '44px 22px 64px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--text-mid)', textTransform: 'uppercase', marginBottom: 10 }}>Methodology</div>
          <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(32px,5.5vw,52px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.12, margin: '0 0 18px' }}>How this database is built</h1>

          <P>A deal database without a published methodology is not a product, it is a list. This page sets out exactly what Meridian counts, what it throws out, and why. If you disagree with a rule, you can see it and argue with it. That is the point.</P>

          {/* Live counters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, margin: '28px 0 8px' }}>
            {[
              { k: 'Transactions tracked', v: stats.tracked },
              { k: 'Eligible for league tables', v: stats.eligible },
              { k: 'Excluded', v: stats.excluded },
              { k: 'Eligible volume', v: bn(stats.volume) },
            ].map((c) => (
              <div key={c.k} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.1 }}>{c.v}</div>
                <div style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 3 }}>{c.k}</div>
              </div>
            ))}
          </div>

          <H2>Where the data comes from</H2>
          <P>Meridian ingests headlines in near real time from regulators and exchanges, newswires and company releases, and the financial press -- with a deliberate weight towards Iberian outlets, because Iberian mid-market deals are poorly covered in English.</P>
          <P><strong>Every record is tied to a published source article, and every record links to it.</strong> A language model is used for one job: to translate headlines into English and sort them into fields. It selects and structures. It does not report, it does not add facts, and it does not write commentary. If a record cannot be traced to a source article, it is not published.</P>

          <H2>What counts as a deal</H2>
          <LI>A single, identifiable transaction: an acquisition, a buyout, an equity or debt issue, a project financing, a restructuring.</LI>
          <LI>It has a source article we can link to.</LI>
          <LI>For M&amp;A and LBOs: both an identified acquirer and an identified target.</LI>
          <LI>Its value, where stated, is the size of <em>that transaction</em> -- not a valuation, a market size, a sector total, a market capitalisation or an aggregate.</LI>

          <H2>What is excluded, and why</H2>
          <P>Exclusions are recorded against each record with a reason, so the decision is auditable rather than arbitrary. The current tally:</P>
          {reasons && reasons.length ? (
            <div style={{ border: '1px solid var(--border)', margin: '4px 0 18px' }}>
              {reasons.map((r, i) => (
                <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '11px 15px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)' }}>{r.k}</span>
                  <strong style={{ fontFamily: 'var(--d)', fontSize: 15, color: 'var(--text-hi)', flexShrink: 0 }}>{r.v}</strong>
                </div>
              ))}
            </div>
          ) : null}
          <P>Market aggregates are the most common trap. &ldquo;AI groups issue $182bn in bonds&rdquo; is not a transaction; a $2tn IPO valuation is not a deal size; a government infrastructure programme is not an acquisition. All of these are tracked as market news and carry no value in the league tables.</P>

          <H2>Currency</H2>
          <P>Values are recorded in the currency of the source and converted to euros so that they can be compared. Adding dollars, pounds and euros together without converting them produces a number that means nothing.</P>
          <P><strong>Each transaction is converted at the European Central Bank reference rate for its own date</strong> -- not at a single fixed rate applied across the whole period. A fixed rate quietly distorts any cross-currency table; over six months of a moving euro it can shift a ranking. Where a deal falls on a weekend or a holiday, the most recent preceding ECB rate is used. The rate applied to each deal, and the date it came from, are stored against that record.</P>
          <P style={{ fontSize: 15 }}><em>Source: European Central Bank daily reference rates. Currencies covered: {fx && fx.length ? fx.map((f) => f.currency).join(', ') : 'EUR, USD, GBP, CAD, SEK, DKK, JPY, KRW, HKD'}. If a deal is denominated in a currency the ECB does not publish, it is recorded but carries no euro value and does not enter the league tables.</em></P>

          <H2>What this database is not</H2>
          <P>It is not exhaustive. It captures deals that were reported in the sources we track, which means smaller and private transactions are under-represented, and the Iberian coverage -- although it is our focus -- is still building. Treat the league tables as a picture of <em>reported</em> dealmaking, not of all dealmaking.</P>

          <H2>Corrections</H2>
          <P>Automated pipelines make mistakes: a mis-tagged sector, a value read from the wrong line, a rumour recorded as signed. If you find one, tell us and we will correct or remove the record. Write to us via the <a href="/contact" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>contact page</a>. Corrections are the cheapest credibility there is.</P>
        </article>
        <Footer />
      </div>
    </>
  );
}
