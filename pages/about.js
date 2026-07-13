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
            <a href="/privacy" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Privacy</a>
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
    <Shell title="About Meridian -- Capital Markets Deal Tracker" desc="Meridian is a curated deal tracker for M&A, LBOs, ECM, leveraged finance, project finance and restructuring. Every entry links to its original source.">
      <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--text-mid)', textTransform: 'uppercase', marginBottom: 10 }}>About</div>
      <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,56px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.1, margin: '0 0 20px' }}>A curated deal tracker for the capital markets</h1>

      <P>Meridian tracks the transactions that move money and shape industries -- mergers and acquisitions, leveraged buyouts, equity and debt capital markets, project finance and restructuring -- across Europe and beyond. It is a tracker, not a newsroom: we do not report original stories. What we do is find the deals as they are reported, structure them so they can be compared, and point you to the source.</P>

      <H2>What we cover</H2>
      <P>Meridian surfaces the transactions that matter: who is buying whom, at what value, on what terms. Each deal is tagged by type (M&amp;A, LBO, LevFin, ECM, project finance, restructuring, debt advisory), by sector, by geography and by status. That taxonomy is the point of the site: it lets you see the shape of a market that is otherwise scattered across a hundred outlets and paywalls.</P>

      <H2>How we work -- and what we do not do</H2>
      <P>Meridian is an automated pipeline, and we would rather say so plainly than pretend otherwise. We ingest headlines in near real time from regulators and exchanges, newswires, corporate press releases and the financial press. A language model is then used for one job only: to translate those headlines into English and structure them into fields. It selects and reformats. It does not report, and it does not write commentary.</P>
      <P><strong>Every deal on Meridian is tied to a source article, and every deal links to it.</strong> If an item cannot be traced back to a published source, it is not published here. If a transaction value is not stated in the source, we record it as unknown rather than estimate. We do not have an editorial desk, and until we do, Meridian carries no analysis or opinion.</P>

      <H2>Corrections</H2>
      <P>Automated pipelines make mistakes: a mis-tagged sector, a value read from the wrong line, a deal that turns out to be a rumour. If you spot something wrong, tell us and we will fix or remove it. Reach us via the <a href="/contact" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>contact page</a>.</P>

      <H2>Who it is for</H2>
      <P>Meridian is built for people who work with, invest in, or are learning about the capital markets -- bankers, investors, advisers, founders and students. If you want to understand how deals are structured, our <a href="/learn" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>Learn</a> library collects books, primers and resources to go deeper.</P>

      <H2>Independence</H2>
      <P>Meridian is independent and reader-focused. Coverage is not for sale. No party pays to appear, or to be left out.</P>
    </Shell>
  );
}
