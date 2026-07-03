// pages/about.js -- About Meridian (content page; helps AdSense legitimacy + SEO).
import Head from 'next/head';

function Shell({ title, desc, children }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>
        <article style={{ maxWidth: 760, margin: '0 auto', padding: '44px 22px 64px' }}>{children}</article>
        <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '16px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.06em' }}>
            <a href="/about" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>About</a>
            <a href="/contact" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Contact</a>
            <a href="/learn" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Learn</a>
            <a href="/privacidad" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Privacy</a>
          </div>
        </div>
      </div>
    </>
  );
}

const H2 = (props) => <h2 style={{ fontFamily: 'var(--s)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', margin: '30px 0 12px' }}>{props.children}</h2>;
const P = (props) => <p style={{ fontFamily: 'var(--r)', fontSize: 17, color: 'var(--text-body)', lineHeight: 1.85, margin: '0 0 18px' }}>{props.children}</p>;

export default function About() {
  return (
    <Shell title="About Meridian -- Capital Markets Intelligence" desc="Meridian is an independent capital-markets intelligence review covering M&A, LBOs, ECM, leveraged finance, project finance and restructuring across Europe and beyond.">
      <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--text-mid)', textTransform: 'uppercase', marginBottom: 10 }}>About</div>
      <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,56px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.1, margin: '0 0 20px' }}>The capital markets intelligence review</h1>

      <P>Meridian is an independent intelligence review for the capital markets. We track the deals that move money and shape industries -- mergers and acquisitions, leveraged buyouts, equity and debt capital markets, project finance and restructuring -- across Europe and, increasingly, around the world. Our aim is simple: to be the fastest, clearest and most useful read on what is actually happening in dealmaking.</P>

      <H2>What we cover</H2>
      <P>Every day, Meridian surfaces the transactions that matter: who is buying whom, at what value, on what terms, and why. We separate genuine deals from market noise, tag each by type, sector and geography, and record the advisers and financing behind them. Alongside the news, our editorial desk publishes a short "Meridian Analysis" on the most significant deals -- the strategic rationale, the financial and structural read, and what each one signals for the wider market.</P>

      <H2>How we work</H2>
      <P>Meridian is built on primary sources. We aggregate, in near real time, from regulators and exchanges, the major newswires, corporate press releases and the leading financial press, then rank items by authority and freshness so the most important and best-sourced stories rise to the top. Company, brand and person names are preserved; figures are checked; and everything is presented in clear, professional English. Where a transaction value is not verifiable, we say so rather than guess.</P>

      <H2>Who it is for</H2>
      <P>Meridian is written for people who work with, invest in, or are learning about the capital markets -- bankers, investors, advisers, founders, students and the simply curious. If you want to understand how deals are structured and what they mean, our companion <a href="/learn" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>Learn</a> library collects the best books, resources and podcasts to go deeper.</P>

      <H2>Independence</H2>
      <P>Meridian is independent and reader-focused. Our coverage is not for sale, and our analysis reflects our own reading of the facts. We welcome tips, corrections and feedback -- you can always reach us via our <a href="/contact" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>contact page</a>.</P>
    </Shell>
  );
}
