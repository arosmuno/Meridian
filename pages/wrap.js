// pages/wrap.js -- "The Wrap": an auto-generated daily editorial summary of the day's dealmaking.
// Gemini is called AT MOST ONCE PER DAY: a persistent cache in Supabase (site_cache table)
// survives cold starts, so page loads never regenerate. Only the first request of a new day
// (on a cold instance with no DB entry) triggers generation; everyone else reads the cache.
import Head from 'next/head';
import { getOrGenerateWrap } from '../lib/wrapGen';

const SITE = 'https://www.meridiancapmarkets.com';

function Footer() {
  return (
    <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '16px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.06em' }}>
        <a href="/" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Home</a>
        <a href="/wrap" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>The Wrap</a>
        <a href="/analysis" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Analysis</a>
        <a href="/rankings" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Rankings</a>
        <a href="/learn" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Learn</a>
      </div>
    </div>
  );
}

export async function getServerSideProps(ctx) {
  // Sin cache de CDN/navegador: siempre servimos lo mas fresco (el contenido ya viene
  // cacheado en Supabase, asi que leerlo por peticion es rapido y nunca queda obsoleto).
  try { ctx.res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate'); } catch (e) {}
  // El CRON pre-genera el wrap de hoy; aqui solo lo leemos (y lo generamos si faltara).
  const { wrap, label, count } = await getOrGenerateWrap(false);
  return { props: { wrap, dateLabel: label, count } };
}

export default function Wrap({ wrap, dateLabel, count }) {
  return (
    <>
      <Head>
        <title>The Wrap -- today in deals -- Meridian</title>
        <meta name="description" content="The Wrap: Meridian's daily editorial summary of the biggest M&A, financing and capital-markets deals, the dominant themes, and what to watch next." />
        <link rel="canonical" href={SITE + '/wrap'} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <article style={{ maxWidth: 720, margin: '0 auto', padding: '44px 22px 60px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>&#10022; The Wrap</div>
          <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,54px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.1, margin: '0 0 6px' }}>Today in deals</h1>
          <p style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--text-mid)', fontStyle: 'italic', margin: '0 0 26px' }}>{dateLabel}{count ? ' · ' + count + ' deals tracked' : ''}</p>

          {wrap ? (
            <div style={{ fontFamily: 'var(--r)', fontSize: 18, color: 'var(--text-body)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{wrap}</div>
          ) : (
            <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-mid)' }}>Today's wrap is being written. In the meantime, <a href="/" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>see all the latest deals &rarr;</a></p>
          )}

          <div style={{ marginTop: 34 }}>
            <a href="/" style={{ display: 'inline-block', background: 'var(--gold)', color: 'var(--pill-active-text)', fontFamily: 'var(--s)', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', padding: '12px 22px', textDecoration: 'none' }}>SEE ALL DEALS -&gt;</a>
          </div>
        </article>
        <Footer />
      </div>
    </>
  );
}
