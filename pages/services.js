import Head from 'next/head';
import Link from 'next/link';
import Layout, { PageHero } from '../components/Layout';

const SERVICES = [
  {
    id: 'ma', n: '01', t: 'Mergers & Acquisitions',
    lead: 'Advising shareholders, corporates and sponsors through the full transaction lifecycle: from the decision to explore, to money in the account.',
    left: { h: 'Sell-side', items: ['Preparation of the equity story and information package', 'Valuation and defensible price expectations', 'Buyer mapping across strategics and sponsors, domestic and international', 'Controlled outreach and management of competitive tension', 'Negotiation of offers, SPA support and closing coordination'] },
    right: { h: 'Buy-side', items: ['Acquisition strategy and target identification', 'Approach and relationship management with owners', 'Valuation, synergy assessment and offer structuring', 'Diligence coordination across advisers', 'Negotiation through to signing and completion'] },
  },
  {
    id: 'debt', n: '02', t: 'Debt Advisory',
    lead: 'Raising and restructuring debt as a competitive process run for the borrower, not a bilateral negotiation with the bank that happens to know you best.',
    left: { h: 'Situations', items: ['Corporate debt raising and growth financing', 'Acquisition finance and leveraged structures', 'Refinancings and maturity extensions', 'Capital structure review and optimisation', 'Structured and hybrid capital solutions'] },
    right: { h: 'What we do', items: ['Debt capacity analysis and structure design', 'Preparation of the lender information package', 'Outreach across banks, debt funds and direct lenders', 'Term sheet comparison on a like-for-like basis', 'Negotiation of pricing, covenants and documentation'] },
  },
];

export default function Services() {
  return (
    <>
      <Head>
        <title>Services &mdash; M&amp;A and Debt Advisory | Meridian</title>
        <meta name="description" content="M&A and debt advisory services for companies, shareholders and sponsors across Iberia." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/services" />
      </Head>
      <Layout>
        <PageHero
          eyebrow="Services"
          title="Two disciplines, executed properly."
          sub="Advisory for companies, shareholders and sponsors in the Iberian mid-market, with a focus on energy, TMT and infrastructure."
        />

        {SERVICES.map((s, i) => (
          <section key={s.id} className={i % 2 === 1 ? 'sec alt' : 'sec'}>
            <div className="wrap">
              <div className="sec-head" style={{ marginBottom: 44 }}>
                <div className="svc-i">{s.n}</div>
                <h2 className="h2" style={{ marginTop: 12 }}>{s.t}</h2>
                <hr className="rule" />
                <p className="body" style={{ fontSize: 17 }}>{s.lead}</p>
              </div>
              <div className="g2">
                {[s.left, s.right].map((col) => (
                  <div key={col.h} style={{ borderTop: '1px solid var(--line)', paddingTop: 26 }}>
                    <h3 className="eyebrow" style={{ marginBottom: 20 }}>{col.h}</h3>
                    <ul className="ticks">{col.items.map((it) => <li key={it}>{it}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}

        <section className="sec dark" style={{ textAlign: 'center' }}>
          <div className="wrap-narrow">
            <div className="eyebrow on-dark">Next step</div>
            <h2 className="h2" style={{ marginTop: 18, color: '#fff' }}>Tell us about the situation.</h2>
            <p className="lead on-dark" style={{ marginTop: 18, fontSize: 16 }}>
              An initial conversation costs nothing and commits you to nothing. It is usually enough to establish
              whether a process makes sense, and what it would realistically look like.
            </p>
            <div style={{ marginTop: 36 }}><Link href="/contact" className="btn btn-solid">Contact Meridian</Link></div>
          </div>
        </section>
      </Layout>
    </>
  );
}
