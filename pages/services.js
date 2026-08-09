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

const FAQ = [
  { q: 'How are you paid?',
    a: 'A retainer calculated as a percentage of the success fee, and a success fee calculated as a percentage of the transaction value. The retainer covers the preparation work that happens before anything is marketed; the bulk of the economics only arrives if the transaction closes. The rates depend on the size and complexity of the mandate and are agreed in writing before any work starts.' },
  { q: 'How long does a sale process take?',
    a: 'Ten to twenty weeks from mandate to completion for a prepared mid-market business. That range depends on the business being ready before anything is marketed, which is why preparation is a distinct stage rather than something done in parallel with the process.' },
  { q: 'Is my company big enough?',
    a: 'If a credible buyer or lender would take the situation seriously, it is worth a conversation. Tell us the revenue, the EBITDA and the situation and you will get a straight answer, including if that answer is that a process does not make sense yet.' },
  { q: 'What do you know about my sector?',
    a: 'Energy, technology, media and telecommunications and infrastructure are where the direct experience sits. Outside those, every mandate starts with a sector, competitor and buyer-universe analysis before anything else happens, and we will say so plainly rather than claim expertise we do not have.' },
  { q: 'Will I be dealing with you or with an analyst?',
    a: 'With the founder. Capacity is deliberately limited to a small number of live mandates precisely so that the person you meet is the person who builds the model and sits in the negotiation.' },
  { q: 'What happens to my information?',
    a: 'Nothing leaves the engagement. Data rooms run with per-user permissions, watermarking and a download audit trail, and access is withdrawn when a party leaves the process. Client names and figures never appear in our marketing or in the news brief.' },
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

        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Common questions</div>
              <h2 className="h2">The things clients ask before the first meeting.</h2>
            </div>
            <div className="faq">
              {FAQ.map((f) => (
                <div key={f.q}>
                  <h3 className="h3">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
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
