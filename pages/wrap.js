// pages/wrap.js -- "The Wrap": an auto-generated daily editorial summary of the day's dealmaking.
// Gemini is called AT MOST ONCE PER DAY: a persistent cache in Supabase (site_cache table)
// survives cold starts, so page loads never regenerate. Only the first request of a new day
// (on a cold instance with no DB entry) triggers generation; everyone else reads the cache.
import Head from 'next/head';
import { supabaseAdmin } from '../lib/supabase';
import { llmComplete } from '../lib/llm';

const SITE = 'https://www.meridiancapmarkets.com';
let CACHE = { day: '', text: '', label: '', count: 0 };

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

async function generateWrap(dateLabel) {
  const r = await fetch(SITE + '/api/deals?limit=40');
  const j = await r.json();
  const seen = new Set();
  const deals = (j.deals || []).filter((d) => d.category === 'deal' && d.headline && !seen.has(d.headline) && (seen.add(d.headline) || true)).slice(0, 15);
  const count = deals.length;
  if (!deals.length) return { wrap: '', count };
  const list = deals.map((d) => '- ' + d.headline + (Number(d.value) ? ' (' + d.value + ' ' + (d.currency || '') + ')' : '') + ' [' + (d.type || '') + ', ' + (d.sector || '') + ']').join('\n');
  const prompt = 'You are the editor of MERIDIAN, a capital-markets newspaper. Write a tight, professional "Deal Wrap" for ' + dateLabel + ' in English: 2 to 3 short paragraphs of flowing prose, no headers, no bullet points. Cover the biggest deals of the day, the dominant sectors or themes, and end with one forward-looking line. Be precise; do not invent figures.\n\nToday\'s deals:\n' + list + '\n\nStart directly with the wrap:';
  let wrap = '';
  try { wrap = await llmComplete({ prompt, maxTokens: 900, temperature: 0.6 }); } catch (e) { wrap = ''; }
  return { wrap, count };
}

export async function getServerSideProps() {
  const today = new Date().toISOString().slice(0, 10);
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cacheKey = 'wrap:' + today;

  // 1) Fast path: same serverless instance already has today's wrap in memory.
  if (CACHE.day === today && CACHE.text) {
    return { props: { wrap: CACHE.text, dateLabel: CACHE.label, count: CACHE.count } };
  }

  // 2) Persistent cache in Supabase (survives cold starts) -> no Gemini call.
  try {
    const { data } = await supabaseAdmin.from('site_cache').select('value').eq('key', cacheKey).maybeSingle();
    if (data && data.value) {
      const parsed = JSON.parse(data.value);
      CACHE = { day: today, text: parsed.text, label: parsed.label || dateLabel, count: parsed.count || 0 };
      return { props: { wrap: parsed.text, dateLabel: CACHE.label, count: CACHE.count } };
    }
  } catch (e) { /* table missing or read error -> fall through to generate */ }

  // 3) Generate once, then persist so no other request regenerates today.
  let wrap = '', count = 0;
  try {
    const out = await generateWrap(dateLabel);
    wrap = out.wrap; count = out.count;
  } catch (e) { /* leave placeholder; next request retries */ }

  if (wrap) {
    CACHE = { day: today, text: wrap, label: dateLabel, count };
    try {
      await supabaseAdmin.from('site_cache').upsert({ key: cacheKey, value: JSON.stringify({ text: wrap, label: dateLabel, count }), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    } catch (e) { /* non-blocking */ }
  }

  return { props: { wrap, dateLabel, count } };
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
