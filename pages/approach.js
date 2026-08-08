import Head from 'next/head';
import Link from 'next/link';
import Layout, { PageHero } from '../components/Layout';

const STEPS = [
  { n: '01', t: 'Assess', d: 'Before anything is marketed we establish what the business is actually worth to a buyer or a lender, where the value sits, and what would have to be true for a process to succeed. If the answer is that now is the wrong moment, you hear it here.' },
  { n: '02', t: 'Prepare', d: 'The equity story, the numbers behind it and the data room are built in parallel. Most value is lost in diligence, not in negotiation, so weaknesses are found and addressed by us before a counterparty finds them.' },
  { n: '03', t: 'Position', d: 'A deliberately short, well-researched counterparty list beats a broad mailing every time. We map who is genuinely acquisitive, who has capital deployed, and who has a strategic reason to pay more than the next bidder.' },
  { n: '04', t: 'Run', d: 'A controlled timetable with information released in sequence. Counterparties move when they believe there is a credible alternative, and that belief is manufactured by process discipline, not by pressure tactics.' },
  { n: '05', t: 'Negotiate', d: 'Price is one term among many. Structure, earn-outs, warranties, conditions and the definition of net debt routinely move more value than the headline number, and they are negotiated line by line.' },
  { n: '06', t: 'Close', d: 'Between signing and completion is where deals quietly die. Conditions, funding, approvals and disclosure are tracked to a closing checklist until the money is in the account.' },
];

const PRINCIPLES = [
  { t: 'Seniority, not leverage', d: 'Large banks staff mid-market mandates with junior teams and senior faces who appear at the pitch and the signing. Here the person who builds the model is the person who negotiates. There is no pyramid to feed.' },
  { t: 'Independence by structure', d: 'No lending book, no balance sheet, no products to distribute. There is no financing relationship to protect and no committee weighing your transaction against a wider client relationship.' },
  { t: 'A small number of mandates', d: 'Capacity is deliberately limited. Taking on more would mean the attention you were sold is not the attention you receive, which is precisely the complaint clients have about larger firms.' },
  { t: 'Candour', d: 'Including when the answer is that the transaction should not happen, that the price is not there, or that the business is not ready. An adviser who only ever agrees with you is worth their fee and nothing more.' },
];

export default function Approach() {
  return (
    <>
      <Head>
        <title>Approach &mdash; How Meridian runs a process</title>
        <meta name="description" content="How Meridian runs a transaction: assess, prepare, position, run, negotiate, close. Senior attention and structural independence in the Iberian mid-market." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/approach" />
      </Head>
      <Layout>
        <PageHero
          eyebrow="Approach"
          title="A process is either designed or it is improvised."
          sub="Mid-market transactions fail for predictable reasons. Most of them are avoidable with preparation and a timetable someone is actually holding."
        />

        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">How a mandate runs</div>
              <h2 className="h2">Six stages, in order.</h2>
            </div>
            <div className="steps">
              {STEPS.map((s) => (
                <div key={s.n}>
                  <div className="no">{s.n}</div>
                  <h3 className="h3">{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec alt">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">What we hold to</div>
              <h2 className="h2">Four principles that shape the work.</h2>
            </div>
            <div className="g2">
              {PRINCIPLES.map((p) => (
                <div key={p.t} className="numbered">
                  <h3 className="h3">{p.t}</h3>
                  <p className="body">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec dark" style={{ textAlign: 'center' }}>
          <div className="wrap">
            <h2 className="h2">Have a situation you want a view on?</h2>
            <div style={{ marginTop: 36 }}>
              <Link href="/contact" className="btn btn-solid">Contact Meridian <span>&rarr;</span></Link>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
}
