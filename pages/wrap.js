// pages/wrap.js -- "The Wrap": pieza semanal ESCRITA POR UNA PERSONA.
//
// La version anterior la generaba Gemini cada dia (lib/wrapGen.js) y la cacheaba en
// site_cache. Eso se acabo: un resumen editorial automatico no es contenido editorial,
// y era el tercer generador del sitio.
//
// Ahora se lee de la tabla `wraps` en Supabase. Para publicar: insertar una fila con
// slug, title, dek, body y published_at. Si published_at es NULL, es un borrador y no sale.
import Head from 'next/head';
import { supabaseAdmin } from '../lib/supabase';

const SITE = 'https://www.meridiancapmarkets.com';

function Footer() {
  return (
    <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '16px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.06em' }}>
        <a href="/" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Home</a>
        <a href="/wrap" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>The Wrap</a>
        <a href="/analysis" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Analysis</a>
        <a href="/rankings" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Rankings</a>
        <a href="/about" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>About</a>
        <a href="/learn" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Learn</a>
      </div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) { return ''; }
}

export async function getServerSideProps(ctx) {
  try { ctx.res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate'); } catch (e) {}

  let current = null;
  let archive = [];

  try {
    const { data } = await supabaseAdmin
      .from('wraps')
      .select('slug,title,dek,body,author,published_at')
      .not('published_at', 'is', null)
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(12);

    if (data && data.length) {
      current = data[0];
      archive = data.slice(1).map((w) => ({ slug: w.slug, title: w.title, published_at: w.published_at }));
    }
  } catch (e) {
    // sin wraps -> estado vacio honesto
  }

  return { props: { current, archive } };
}

export default function Wrap({ current, archive }) {
  const title = current ? `${current.title} -- The Wrap -- Meridian` : 'The Wrap -- Meridian';
  const desc = current?.dek || 'The Wrap: Meridian\'s weekly read on Iberian mid-market dealmaking and European project finance.';

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={SITE + '/wrap'} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <article style={{ maxWidth: 720, margin: '0 auto', padding: '44px 22px 60px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 8 }}>&#10022; The Wrap</div>

          {current ? (
            <>
              <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(32px,5.5vw,50px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.12, margin: '0 0 12px' }}>{current.title}</h1>

              {current.dek ? (
                <p style={{ fontFamily: 'var(--r)', fontSize: 20, color: 'var(--text-body)', lineHeight: 1.6, fontStyle: 'italic', margin: '0 0 18px' }}>{current.dek}</p>
              ) : null}

              {/* Byline: el autor con nombre es la senal de que detras hay una persona. */}
              <div style={{ fontFamily: 'var(--s)', fontSize: 12, color: 'var(--text-mid)', letterSpacing: '.04em', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '12px 0', margin: '0 0 30px' }}>
                By <strong style={{ color: 'var(--text-hi)' }}>{current.author}</strong>
                {current.published_at ? <span> &middot; {fmtDate(current.published_at)}</span> : null}
              </div>

              <div style={{ fontFamily: 'var(--r)', fontSize: 18, color: 'var(--text-body)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{current.body}</div>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(32px,5.5vw,50px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.12, margin: '0 0 12px' }}>The Wrap</h1>
              <div style={{ marginTop: 26, borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                <p style={{ fontFamily: 'var(--r)', fontSize: 17, color: 'var(--text-body)', lineHeight: 1.8, margin: '0 0 14px' }}>
                  The first Wrap has not been published yet.
                </p>
                <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-mid)', lineHeight: 1.8, margin: 0 }}>
                  The Wrap is a weekly read on Iberian mid-market dealmaking and European project finance --
                  written, not generated. Until the first one is ready, the{' '}
                  <a href="/" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>deal feed</a>{' '}
                  is live and sourced as usual.
                </p>
              </div>
            </>
          )}

          {archive && archive.length ? (
            <div style={{ marginTop: 46, borderTop: '1px solid var(--border)', paddingTop: 22 }}>
              <div style={{ fontFamily: 'var(--s)', fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-mid)', marginBottom: 14 }}>Previous wraps</div>
              {archive.map((w) => (
                <div key={w.slug} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-body)', lineHeight: 1.5 }}>{w.title}</div>
                  <div style={{ fontFamily: 'var(--s)', fontSize: 11, color: 'var(--text-lo)', marginTop: 3 }}>{fmtDate(w.published_at)}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ marginTop: 34 }}>
            <a href="/" style={{ display: 'inline-block', background: 'var(--gold)', color: 'var(--pill-active-text)', fontFamily: 'var(--s)', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', padding: '12px 22px', textDecoration: 'none' }}>SEE ALL DEALS -&gt;</a>
          </div>
        </article>
        <Footer />
      </div>
    </>
  );
}
