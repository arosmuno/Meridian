import Head from 'next/head';
import Link from 'next/link';
import Layout, { PageHero } from '../components/Layout';

export default function About() {
  return (
    <>
      <Head>
        <title>About &mdash; Meridian Capital Markets</title>
        <meta name="description" content="Meridian Capital Markets is an independent corporate finance practice founded by Alberto Rosado Munoz." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/about" />
      </Head>
      <Layout>
        <PageHero
          eyebrow="About"
          title="An independent practice, deliberately small."
          sub="Meridian was founded to bring institutional transaction discipline to mid-market situations that rarely receive it."
        />

        <section className="sec">
          <div className="wrap g2">
            <div>
              <div className="eyebrow">Founder</div>
              <h2 className="h2" style={{ marginTop: 14 }}>Alberto Rosado Mu&ntilde;oz</h2>
              <hr className="rule" />
              <p className="body">
                Alberto is a corporate and investment banking professional with five years of experience at
                BBVA and BNP Paribas, across client coverage, capital markets and transaction origination.
              </p>
              <p className="body">
                He has worked on M&amp;A, leveraged finance and project finance transactions in the Iberian
                energy and TMT sectors, in situations ranging from &euro;30m to &euro;1bn. His work has covered
                financial modelling (DCF, LBO and project finance), valuation analysis using comparable companies
                and precedent transactions, and the coordination of due diligence processes across legal,
                financial and technical advisers.
              </p>
              <p className="body">
                He holds postgraduate qualifications in corporate finance, M&amp;A and private equity (ISBIF, IEB)
                and in advanced accounting and finance (ICADE), following a degree in Business Economics from
                Anglia Ruskin University in the United Kingdom. He works in Spanish and English.
              </p>
              <div style={{ marginTop: 30, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <a href="https://www.linkedin.com/in/arosado6" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">LinkedIn profile</a>
                <Link href="/contact" className="btn btn-solid">Get in touch</Link>
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 40 }}>
              <div className="eyebrow">Experience at a glance</div>
              <ul className="ticks" style={{ marginTop: 24 }}>
                <li>BBVA &mdash; Corporate &amp; Investment Banking</li>
                <li>BNP Paribas &mdash; Corporate &amp; Investment Banking</li>
                <li>M&amp;A, leveraged finance and project finance</li>
                <li>Iberian energy, TMT and infrastructure</li>
                <li>Transactions from &euro;30m to &euro;1bn</li>
                <li>ISBIF / IEB &mdash; Corporate Finance, M&amp;A, Private Equity</li>
                <li>ICADE &mdash; Advanced Accounting &amp; Finance</li>
                <li>Anglia Ruskin University &mdash; BSc Business Economics</li>
              </ul>
              <p className="small" style={{ marginTop: 26 }}>
                Experience described above was gained in roles at the institutions named. It does not represent
                transactions executed by Meridian Capital Markets.
              </p>
            </div>
          </div>
        </section>

        <section className="sec alt">
          <div className="wrap">
            <div style={{ maxWidth: 760 }}>
              <div className="eyebrow">Governance</div>
              <h2 className="h2" style={{ marginTop: 14 }}>Advisory and Market Intelligence are kept apart.</h2>
              <hr className="rule" />
              <p className="body">
                Meridian publishes a Market Intelligence record of European transaction activity. It is compiled
                automatically and exclusively from publicly available sources &mdash; regulators, exchanges, newswires
                and the financial press &mdash; and every entry links to the original publication.
              </p>
              <p className="body">
                It uses no confidential or non-public information from any current or past mandate. It is not
                investment research and it is not investment advice. Coverage of a company, sector or transaction
                implies no advisory relationship with any party mentioned. Where we identify an error, we correct
                or remove the entry.
              </p>
              <div style={{ marginTop: 30 }}>
                <Link href="/intelligence" className="btn btn-ghost">See Market Intelligence</Link>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
}
