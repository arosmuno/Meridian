import Head from 'next/head';
import Link from 'next/link';
import Layout, { PageHero } from '../components/Layout';

const CAPS = [
  { n: '01', t: 'Mergers & Acquisitions', tag: 'Sell-side · Buy-side',
    d: 'Full-process advisory for shareholders, corporates and sponsors: positioning, valuation, counterparty mapping, controlled outreach and negotiation through to closing.' },
  { n: '02', t: 'Debt Advisory', tag: 'Raising · Refinancing',
    d: 'Corporate debt, acquisition and leveraged financing, refinancings and structured capital, run as a competitive process across banks, debt funds and direct lenders.' },
  { n: '03', t: 'Financial Due Diligence', tag: 'Buy-side · Vendor',
    d: 'Quality of earnings, normalised EBITDA, working capital and net debt analysis, with the findings translated into price and structure rather than left in an appendix.' },
  { n: '04', t: 'Valuation & Modelling', tag: 'DCF · LBO · Comparables',
    d: 'Independent valuation and fully auditable operating models built to survive lender, investor and auditor scrutiny, and to be defended in a negotiation.' },
  { n: '05', t: 'Virtual Data Room', tag: 'Set-up · Management',
    d: 'Data room design, document architecture and Q&A management, with disclosure controlled and sequenced so information supports the process instead of leaking it.' },
  { n: '06', t: 'Shareholder Advisory', tag: 'Strategy · Readiness',
    d: 'Pre-process preparation, exit readiness reviews, shareholder alignment and strategic options work, well before there is a transaction to run.' },
];

export default function Services() {
  return (
    <>
      <Head>
        <title>Services &mdash; M&amp;A, Debt Advisory and Transaction Support | Meridian</title>
        <meta name="description" content="M&A, debt advisory, financial due diligence, valuation, data room management and shareholder advisory for the Iberian mid-market." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/services" />
      </Head>
      <Layout>
        <PageHero
          eyebrow="Services"
          title="Everything a transaction needs, in one place."
          sub="Two advisory mandates and the execution work that sits underneath them, delivered by the same senior person from first call to closing."
        />

        <section className="sec tight">
          <div className="wrap">
            <div className="caps">
              {CAPS.map((c) => (
                <article key={c.n}>
                  <span className="idx">{c.n}</span>
                  <h3 className="h3">{c.t}</h3>
                  <p>{c.d}</p>
                  <div className="tag">{c.tag}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="sec alt">
          <div className="wrap g2">
            <div>
              <div className="eyebrow">Who we act for</div>
              <h2 className="h2" style={{ marginTop: 16 }}>Clients</h2>
              <ul className="ticks" style={{ marginTop: 28 }}>
                <li>Family-owned and founder-led businesses</li>
                <li>Private equity funds and their portfolio companies</li>
                <li>Family offices and private investors</li>
                <li>Corporate groups and their subsidiaries</li>
                <li>Management teams in buy-outs and buy-ins</li>
              </ul>
            </div>
            <div>
              <div className="eyebrow">Where we focus</div>
              <h2 className="h2" style={{ marginTop: 16 }}>Sectors</h2>
              <ul className="ticks" style={{ marginTop: 28 }}>
                <li>Energy and renewables</li>
                <li>Technology, media and telecommunications</li>
                <li>Infrastructure and concessions</li>
                <li>Industrials and business services</li>
                <li>Selected situations outside these sectors, on merit</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="sec dark" style={{ textAlign: 'center' }}>
          <div className="wrap">
            <div className="eyebrow on-dark">Next step</div>
            <h2 className="h2" style={{ marginTop: 20 }}>Tell us about the situation.</h2>
            <p className="lead on-dark" style={{ margin: '24px auto 0', maxWidth: '54ch' }}>
              An initial conversation costs nothing and commits you to nothing. It is usually enough to
              establish whether a process makes sense, and what it would realistically look like.
            </p>
            <div style={{ marginTop: 44 }}>
              <Link href="/contact" className="btn btn-solid">Contact Meridian <span>&rarr;</span></Link>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
}
