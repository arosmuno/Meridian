// pages/about.js -- About Meridian. Proyecto independiente, sin afiliacion.
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
            <a href="/methodology" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Methodology</a>
            <a href="/contact" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Contact</a>
            <a href="/learn" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Learn</a>
            <a href="/privacy" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Privacy</a>
          </div>
        </div>
      </div>
    </>
  );
}

const H2 = (p) => <h2 style={{ fontFamily: 'var(--s)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', margin: '32px 0 12px' }}>{p.children}</h2>;
const P = (p) => <p style={{ fontFamily: 'var(--r)', fontSize: 17, color: 'var(--text-body)', lineHeight: 1.85, margin: '0 0 18px' }}>{p.children}</p>;

export default function About() {
  return (
    <Shell
      title="About Meridian -- Iberian mid-market & European project finance"
      desc="Meridian is an independent, curated deal tracker for the Iberian mid-market and European project finance. Every deal links to its source.">
      <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--text-mid)', textTransform: 'uppercase', marginBottom: 10 }}>About</div>
      <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(32px,5.5vw,52px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.12, margin: '0 0 20px' }}>An independent deal tracker</h1>

      <P>Meridian tracks dealmaking across Europe, with a deliberate focus on two things that are badly served elsewhere: <strong>the Iberian mid-market</strong> and <strong>European project finance</strong>. Spanish and Portuguese deals between roughly &euro;50m and &euro;500m barely register in the English-language financial press. Project finance is technical, slow-moving and rarely explained well. Both are worth following. Almost nobody makes it easy to.</P>

      <P>It is a tracker, not a newsroom. Meridian does not break stories and does not claim to. What it does is find deals as they are reported, structure them so they can be compared, and send you to the source.</P>

      <H2>How it works, plainly</H2>
      <P>Meridian is an automated pipeline, and we would rather say so than pretend there is a newsroom behind it. Headlines are ingested in near real time from regulators, exchanges, newswires and the financial press -- including Spanish outlets the anglophone press does not read. A language model translates them into English and sorts them into fields. It structures. It does not report, it does not add facts, and it does not write commentary.</P>
      <P><strong>Every deal is tied to a source article, and every deal links to it.</strong> If a record cannot be traced back to something published, it does not go up. If a transaction value is not stated in the source, it is recorded as unknown rather than estimated. The full rules -- what counts, what is thrown out, how currencies are converted -- are set out on the <a href="/methodology" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>methodology page</a>.</P>

      <H2>Who is behind it</H2>
      <P>Meridian is a one-person, independent project, built and maintained in Madrid. It is not affiliated with, endorsed by or connected to any bank, advisory firm, fund or employer, and nothing on this site should be read as representing the views of any institution.</P>
      <P>Meridian carries no analysis, no opinion and no recommendations. It reports what public sources report, and links to them. Nothing here is investment advice, and nothing here draws on any information that is not already public.</P>

      <H2>Corrections</H2>
      <P>Automated pipelines make mistakes: a mis-tagged sector, a value read from the wrong line, a rumour recorded as signed. If you spot one, tell us and it will be corrected or removed. Reach us through the <a href="/contact" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>contact page</a>. Corrections are the cheapest credibility there is.</P>

      <H2>Independence</H2>
      <P>Coverage is not for sale. No party pays to appear here, and no party pays to be left out. The site carries advertising to cover its costs; advertisers have no influence over what is tracked or how it is presented.</P>

      <H2>Learning</H2>
      <P>Alongside the deal feed, the <a href="/learn" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 700 }}>Learn</a> library collects the books, courses and resources worth using if you want to understand how these deals are actually structured -- curated, free where possible, and with no paid-course noise.</P>
    </Shell>
  );
}
