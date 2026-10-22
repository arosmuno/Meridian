// pages/weekly.js -- edicion web de "The Meridian Weekly".
// /weekly            -> ultimos 7 dias
// /weekly?w=2026-10-12 -> semana que empieza ese lunes (archivo)
// Mismos datos que el email (lib/weekly.js). Sirve aunque todavia no se envie por correo.
import Head from 'next/head';
import NewsletterSignup from '../components/NewsletterSignup';
import { loadWeek, weekStart } from '../lib/weekly';

const SITE = 'https://www.meridiancapmarkets.com';
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const eur = (v) => { const n = Math.round(Number(v || 0)); if (!n) return ''; return n >= 1000 ? '€' + (n / 1000).toFixed(1) + 'bn' : '€' + n + 'm'; };
const fmt = (iso, opts) => new Date(iso).toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });

export async function getServerSideProps({ query, res }) {
  try { res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600'); } catch (e) {}
  let from, to;
  const w = String(query.w || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) {
    from = weekStart(new Date(w + 'T00:00:00Z'));
    to = new Date(from.getTime() + 7 * 864e5);
  }
  let issue = null;
  try { issue = await loadWeek({ from, to }); } catch (e) {}

  // Archivo: las cuatro semanas completas anteriores.
  const thisMonday = weekStart(new Date());
  const archive = [1, 2, 3, 4].map((k) => new Date(thisMonday.getTime() - k * 7 * 864e5).toISOString().slice(0, 10));
  return { props: { issue: issue ? JSON.parse(JSON.stringify(issue)) : null, archive, w: w || null } };
}

function DealItem({ d }) {
  const meta = [d.type, d.sector, eur(d.value_eur)].filter(Boolean).join(' · ');
  return (
    <a href={'/deal/' + slugify(d.headline) + '-' + d.id} style={{ display: 'block', textDecoration: 'none', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'var(--s)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--gold)', textTransform: 'uppercase' }}>{meta}</div>
      <div style={{ fontFamily: 'var(--d)', fontSize: 19, fontWeight: 700, color: 'var(--text-hi)', lineHeight: 1.3, margin: '4px 0 6px' }}>{d.headline}</div>
      {d.summary ? <div style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', lineHeight: 1.65 }}>{d.summary.length > 280 ? d.summary.slice(0, 277) + '…' : d.summary}</div> : null}
      {d.source ? <div style={{ fontFamily: 'var(--s)', fontSize: 11, color: 'var(--text-lo)', marginTop: 5 }}>Source: {d.source}</div> : null}
    </a>
  );
}

const Section = ({ title, children }) => (
  <section style={{ marginTop: 30 }}>
    <div style={{ fontFamily: 'var(--s)', fontSize: 11, fontWeight: 800, letterSpacing: '.16em', color: 'var(--text-mid)', textTransform: 'uppercase', borderBottom: '2px solid var(--text-hi)', paddingBottom: 6 }}>{title}</div>
    {children}
  </section>
);

export default function Weekly({ issue, archive, w }) {
  const title = issue && w
    ? `Meridian Weekly -- week of ${fmt(issue.from, { day: 'numeric', month: 'long', year: 'numeric' })}`
    : 'Meridian Weekly -- this week in M&A, LevFin and infrastructure';
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="The week's largest M&A, leveraged finance and infrastructure deals, with an Iberia section. Sourced, no noise." />
        <link rel="canonical" href={SITE + '/weekly' + (w ? '?w=' + w : '')} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '36px 20px 56px' }}>
          <div style={{ textAlign: 'center', borderBottom: '3px double var(--border)', paddingBottom: 18 }}>
            <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.3em', color: 'var(--text-mid)' }}>THE CAPITAL MARKETS INTELLIGENCE REVIEW</div>
            <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,48px)', fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.03em', margin: '6px 0 4px' }}>MERIDIAN WEEKLY</h1>
            {issue ? (
              <div style={{ fontFamily: 'var(--r)', fontSize: 14, fontStyle: 'italic', color: 'var(--text-mid)' }}>
                {fmt(issue.from, { day: 'numeric', month: 'short' })} – {fmt(new Date(new Date(issue.to).getTime() - 864e5).toISOString(), { day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}{issue.count} transactions{issue.volume ? ' · ' + eur(issue.volume) + ' disclosed value' : ''}
              </div>
            ) : null}
          </div>

          {!issue || !issue.count ? (
            <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-body)', marginTop: 26 }}>No eligible transactions in this period yet.</p>
          ) : (
            <>
              {issue.byType.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                  {issue.byType.map(([t, n]) => (
                    <span key={t} style={{ fontFamily: 'var(--s)', fontSize: 11, color: 'var(--text-mid)', border: '1px solid var(--border)', padding: '3px 9px' }}>{t} · {n}</span>
                  ))}
                </div>
              ) : null}
              <Section title="The week's largest deals">{issue.top.map((d) => <DealItem key={d.id} d={d} />)}</Section>
              {issue.iberia.length ? <Section title="Iberia">{issue.iberia.map((d) => <DealItem key={d.id} d={d} />)}</Section> : null}
            </>
          )}

          <section style={{ marginTop: 40, background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '22px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--d)', fontSize: 22, fontWeight: 800, color: 'var(--text-hi)', marginBottom: 6 }}>Get it every Monday</div>
            <p style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-body)', margin: '0 auto 14px', maxWidth: 480, lineHeight: 1.6 }}>Five minutes, sourced, with an Iberia section. Free.</p>
            <NewsletterSignup source="weekly-page" />
          </section>

          <div style={{ marginTop: 30, fontFamily: 'var(--s)', fontSize: 12, color: 'var(--text-mid)', textAlign: 'center', lineHeight: 2 }}>
            Previous weeks:{' '}
            {archive.map((d, i) => (
              <a key={d} href={'/weekly?w=' + d} style={{ color: d === w ? 'var(--text-hi)' : 'var(--gold)', textDecoration: 'none', fontWeight: 700, marginLeft: i ? 12 : 4 }}>{fmt(d + 'T00:00:00Z', { day: 'numeric', month: 'short' })}</a>
            ))}
            {w ? <a href="/weekly" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700, marginLeft: 12 }}>Latest</a> : null}
          </div>
        </div>
      </div>
    </>
  );
}
