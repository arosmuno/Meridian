import Head from 'next/head';
import Link from 'next/link';
import Layout, { PageHero } from '../components/Layout';

const CREDS = [
  'BBVA — Corporate & Investment Banking',
  'BNP Paribas — Corporate & Investment Banking',
  'M&A and leveraged finance',
  'Iberian energy and TMT',
  'ISBIF / IEB — Corporate Finance, M&A, Private Equity',
  'ICADE — Advanced Accounting & Finance',
  'Anglia Ruskin University — BSc Business Economics',
  'Spanish and English',
];

const GOV = [
  { t: 'Confidentiality', d: 'Mandate information never leaves the engagement. Client names, figures and documents are not used in marketing, in the news brief, or in conversation with other clients, before or after a process closes.' },
  { t: 'Independence', d: 'Meridian has no lending book, no balance sheet and no products to distribute, and receives no fees from lenders, buyers or other advisers for making an introduction. The only economics in a mandate are the client’s.' },
  { t: 'Conflicts', d: 'Meridian acts for one side. Where a prospective mandate would put us opposite an existing or recent client, we say so before taking it, and decline.' },
  { t: 'Information handling', d: 'Data rooms are set up with per-user permissions, watermarking and a full download audit trail. Access is granted by stage and withdrawn when a party leaves the process.' },
  { t: 'The news brief', d: 'Market News is compiled automatically from public sources, each item linked to its original publication. It uses no confidential or non-public mandate information, it is not original reporting, and it is not investment advice.' },
  { t: 'Corrections', d: 'Automated pipelines make mistakes. If you find one, tell us and the item is corrected or removed. Corrections are the cheapest credibility available.' },
];

export default function About() {
  return (
    <>
      <Head>
        <title>About &mdash; Meridian Capital Markets</title>
        <meta name="description" content="Meridian Capital Markets is an independent corporate finance practice founded by Alberto Rosado Munoz, advising on M&A and debt in the Iberian mid-market." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/about" />
      </Head>
      <Layout>
        <PageHero
          eyebrow="About"
          title="An independent practice, deliberately small."
          sub="Meridian exists to bring institutional transaction discipline to mid-market situations that rarely receive it."
        />

        <section className="sec">
          <div className="wrap founder">
            <div>
              <div className="portrait">
                <span className="mono">AR</span>
                <img src="/founder.jpg" alt="Alberto Rosado Munoz" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
              <div className="chips">
                <span>Madrid</span>
                <span>M&amp;A</span>
                <span>Debt Advisory</span>
              </div>
            </div>
            <div>
              <div className="eyebrow">Founder</div>
              <h2 className="h2" style={{ marginTop: 14 }}>Alberto Rosado Mu&ntilde;oz</h2>
              <div className="role">Founder &amp; Managing Director</div>
              <p className="body" style={{ marginTop: 28 }}>
                Alberto founded Meridian to do mid-market work the way large institutions do large-cap work:
                properly prepared, tightly run, and with the senior person present from the first call to
                completion.
              </p>
              <p className="body">
                He spent five years in corporate and investment banking at BBVA and BNP Paribas, across client
                coverage, capital markets and transaction origination, working on M&amp;A and leveraged finance
                in the Iberian energy and TMT sectors. That work covered financial modelling, valuation using
                comparable companies and precedent transactions, and the coordination of due diligence across
                legal, financial and technical advisers.
              </p>
              <p className="body">
                He holds postgraduate qualifications in corporate finance, M&amp;A and private equity (ISBIF,
                IEB) and in advanced accounting and finance (ICADE), following a degree in Business Economics
                from Anglia Ruskin University in the United Kingdom. He works in Spanish and English.
              </p>
              <div className="chips" style={{ marginTop: 34 }}>
                {CREDS.map((c) => <span key={c}>{c}</span>)}
              </div>
              <div style={{ marginTop: 36, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <a href="https://www.linkedin.com/in/arosado6" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">LinkedIn profile</a>
                <Link href="/contact" className="btn btn-solid">Get in touch <span>&rarr;</span></Link>
              </div>
            </div>
          </div>
        </section>

        <section className="sec alt">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Governance</div>
              <h2 className="h2">How we handle information, conflicts and independence.</h2>
              <p className="lead">
                A one-person practice has to be more explicit about this than a large firm, not less. These are
                the rules we work to.
              </p>
            </div>
            <div className="g2">
              {GOV.map((g) => (
                <div key={g.t} className="numbered">
                  <h3 className="h3">{g.t}</h3>
                  <p className="body">{g.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
}
