// pages/rankings.js -- League tables sobre el dataset LIMPIO.
//
// La version anterior leia los ultimos 100 deals de 7 dias via /api/deals y sumaba
// monedas distintas sin convertir. Eso no era una league table, era un "lo mas grande
// de esta semana" con un total sin sentido.
//
// Ahora: lee de Supabase, solo filas con excluded_reason IS NULL (ver /methodology),
// y usa value_eur -- convertido con el tipo del BCE de la FECHA DE CADA OPERACION.
import Head from 'next/head';
import { supabaseAdmin } from '../lib/supabase';

const SITE = 'https://www.meridiancapmarkets.com';
const ACCENT = {
  'M&A': '#e63946', 'LBO': '#a78bfa', 'LevFin': '#4a9eff', 'Project Finance': '#22c55e',
  'ECM': '#c084fc', 'Restructuring': '#f43f5e', 'Debt Advisory': '#f59e0b',
};
const IBERIAN_SOURCES = ['Expansion', 'Cinco Dias', 'El Economista'];

function eur(m) {
  const n = Number(m) || 0;
  if (n >= 1000) return '€' + (n / 1000).toFixed(1) + 'bn';
  return '€' + Math.round(n) + 'm';
}
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function Footer() {
  return (
    <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '16px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.06em' }}>
        <a href="/" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Home</a>
        <a href="/rankings" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Rankings</a>
        <a href="/methodology" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Methodology</a>
        <a href="/learn" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Learn</a>
        <a href="/about" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>About</a>
        <a href="/contact" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Contact</a>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  try { ctx.res.setHeader('Cache-Control', 'no-store, max-age=0'); } catch (e) {}

  let all = [];
  try {
    const { data } = await supabaseAdmin
      .from('deals')
      .select('id,headline,buyer,target,value_eur,type,sector,source,deal_date')
      .eq('category', 'deal')
      .is('excluded_reason', null)
      .gt('value_eur', 0)
      .order('value_eur', { ascending: false })
      .limit(600);
    all = data || [];
  } catch (e) {}

  const iberian = all.filter((d) => IBERIAN_SOURCES.includes(d.source));

  const tally = (rows, key) => {
    const m = {};
    rows.forEach((d) => {
      const k = d[key];
      if (!k || /^n\/?a$/i.test(String(k).trim())) return;
      if (!m[k]) m[k] = { k, n: 0, v: 0 };
      m[k].n += 1;
      m[k].v += Number(d.value_eur || 0);
    });
    return Object.values(m);
  };

  const props = {
    count: all.length,
    volume: Math.round(all.reduce((s, d) => s + Number(d.value_eur || 0), 0)),
    biggest: all.slice(0, 10),
    iberianCount: iberian.length,
    iberianVolume: Math.round(iberian.reduce((s, d) => s + Number(d.value_eur || 0), 0)),
    iberianBiggest: iberian.slice(0, 10),
    acquirers: tally(all, 'buyer').sort((a, b) => b.v - a.v).slice(0, 10),
    sectors: tally(all, 'sector').sort((a, b) => b.v - a.v).slice(0, 8),
    types: tally(all, 'type').sort((a, b) => b.v - a.v).slice(0, 8),
  };
  return { props };
}

const Card = ({ title, sub, children }) => (
  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '18px 20px', marginBottom: 18 }}>
    <div style={{ fontFamily: 'var(--s)', fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--gold)', textTransform: 'uppercase' }}>{title}</div>
    {sub ? <div style={{ fontFamily: 'var(--r)', fontSize: 12.5, color: 'var(--text-mid)', fontStyle: 'italic', margin: '4px 0 0' }}>{sub}</div> : null}
    <div style={{ marginTop: 14 }}>{children}</div>
  </div>
);

const Row = ({ n, main, sub, right, accent }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: n === 1 ? 'none' : '1px solid var(--border)' }}>
    <span style={{ fontFamily: 'var(--d)', fontSize: 15, fontWeight: 700, color: 'var(--border-hi)', width: 22, flexShrink: 0 }}>{n < 10 ? '0' + n : n}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--s)', fontSize: 13, fontWeight: 600, color: 'var(--text-hi)', lineHeight: 1.3 }}>{main}</div>
      {sub ? <div style={{ fontFamily: 'var(--s)', fontSize: 11, color: 'var(--text-mid)', marginTop: 1 }}>{sub}</div> : null}
    </div>
    {right ? <div style={{ fontFamily: 'var(--d)', fontSize: 14, fontWeight: 700, color: accent || 'var(--text-hi)', flexShrink: 0 }}>{right}</div> : null}
  </div>
);

const DealRows = ({ rows }) => (
  rows.length ? rows.map((d, i) => (
    <a key={d.id} href={'/deal/' + slugify(d.headline) + '-' + d.id} style={{ textDecoration: 'none', display: 'block' }}>
      <Row n={i + 1}
        main={d.buyer && !/^n\/?a$/i.test(d.buyer) ? d.buyer : d.headline.slice(0, 50)}
        sub={d.target && !/^n\/?a$/i.test(d.target) ? d.target : d.type}
        right={eur(d.value_eur)}
        accent={ACCENT[d.type] || 'var(--gold)'} />
    </a>
  )) : <div style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-mid)', fontStyle: 'italic' }}>Not enough eligible deals yet.</div>
);

export default function Rankings(p) {
  return (
    <>
      <Head>
        <title>League Tables -- Meridian</title>
        <meta name="description" content="Meridian league tables: the largest European and Iberian transactions, most active acquirers and sectors, ranked from sourced deals and converted at deal-date ECB rates." />
        <link rel="canonical" href={SITE + '/rankings'} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <div style={{ maxWidth: 940, margin: '0 auto', padding: '40px 22px 56px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>&#10022; League tables</div>
          <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,54px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.1, margin: '0 0 10px' }}>The rankings</h1>
          <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-body)', lineHeight: 1.7, margin: '0 0 6px' }}>
            <strong>{p.count}</strong> eligible transactions &middot; <strong>{eur(p.volume)}</strong> in combined value.
            Values are converted to euros at the <strong>ECB reference rate for each deal&rsquo;s own date</strong>.
          </p>
          <p style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-mid)', fontStyle: 'italic', margin: '0 0 24px' }}>
            Rumours, market aggregates, supply contracts and unsourced records are excluded. Every rule is set out on the{' '}
            <a href="/methodology" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>methodology page</a>.
          </p>

          {/* IBERIA -- el foco del sitio, arriba del todo */}
          <div style={{ border: '2px solid var(--gold)', padding: '4px', marginBottom: 22 }}>
            <Card
              title="&#10022; Iberia &mdash; the focus"
              sub={`${p.iberianCount} eligible Iberian transactions, ${eur(p.iberianVolume)} combined. Sourced from Expansión, Cinco Días and El Economista -- deals the English-language press does not cover.`}>
              <DealRows rows={p.iberianBiggest} />
            </Card>
          </div>

          <Card title="Largest transactions" sub="All geographies, by euro value at deal-date FX.">
            <DealRows rows={p.biggest} />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }} className="cards-grid">
            <Card title="Most active acquirers" sub="By combined euro value.">
              {p.acquirers.length ? p.acquirers.map((a, i) => (
                <Row key={a.k} n={i + 1} main={a.k} sub={a.n + (a.n === 1 ? ' deal' : ' deals')} right={eur(a.v)} />
              )) : <div style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-mid)', fontStyle: 'italic' }}>No data yet.</div>}
            </Card>

            <Card title="By sector" sub="By combined euro value.">
              {p.sectors.length ? p.sectors.map((s, i) => (
                <Row key={s.k} n={i + 1} main={s.k} sub={s.n + (s.n === 1 ? ' deal' : ' deals')} right={eur(s.v)} />
              )) : <div style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-mid)', fontStyle: 'italic' }}>No data yet.</div>}
            </Card>
          </div>

          <Card title="By transaction type" sub="M&A, LBO, ECM, LevFin, project finance, restructuring.">
            {p.types.length ? p.types.map((t, i) => (
              <Row key={t.k} n={i + 1} main={t.k} sub={t.n + (t.n === 1 ? ' deal' : ' deals')} right={eur(t.v)} accent={ACCENT[t.k]} />
            )) : <div style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-mid)', fontStyle: 'italic' }}>No data yet.</div>}
          </Card>

          <p style={{ fontFamily: 'var(--r)', fontSize: 13.5, color: 'var(--text-mid)', fontStyle: 'italic', lineHeight: 1.7, marginTop: 22 }}>
            These tables cover <em>reported</em> dealmaking, not all dealmaking. Coverage of the Iberian mid-market is still
            building, so treat the Iberian tables as indicative rather than complete. If you know of a deal we have missed,
            or a figure we have got wrong, <a href="/contact" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>tell us</a>.
          </p>
        </div>
        <Footer />
      </div>
    </>
  );
}
