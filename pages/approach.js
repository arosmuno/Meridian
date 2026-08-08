import Head from 'next/head';
import Link from 'next/link';
import Layout, { PageHero } from '../components/Layout';

const BLOCKS = [
  { t: 'You get seniority, not leverage', d: 'Large banks staff mid-market mandates with junior teams and senior faces who appear at the pitch and the signing. Meridian works the other way round: a small number of live mandates at any time, and the person who builds the model is the person who negotiates. There is no pyramid to feed.' },
  { t: 'Independence is structural, not a slogan', d: 'Meridian has no lending book, no balance sheet to deploy and no products to distribute. There is no financing relationship to protect and no internal committee weighing your transaction against a wider client relationship. The only economics that exist are the outcome of your process.' },
  { t: 'Preparation decides price', d: 'Value in a mid-market process is usually won or lost before the first meeting: in how the equity story is framed, how the numbers are evidenced, and how quickly diligence questions are answered. We spend disproportionate time here, because it is where the return on effort is highest.' },
  { t: 'Competitive tension, properly built', d: 'A process only prices well when counterparties believe there is a real alternative. That means a well-chosen list, a controlled timetable and information released in a deliberate sequence, not a wide and uncontrolled distribution that leaks and stalls.' },
  { t: 'We say what we think', d: 'Including when the answer is that the transaction should not happen, that the price is not there, or that the business is not ready. An adviser who only ever agrees with you is worth precisely their fee and nothing more.' },
];

export default function Approach() {
  return (
    <>
      <Head>
        <title>Approach &mdash; Meridian Capital Markets</title>
        <meta name="description" content="How Meridian works: senior attention, structural independence and disciplined process design in the Iberian mid-market." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/approach" />
      </Head>
      <Layout>
        <PageHero
          eyebrow="Approach"
          title="How we work, and why it is different."
          sub="Mid-market transactions fail for predictable reasons. Most of them are avoidable with preparation and discipline."
        />
        <section className="sec">
          <div className="wrap">
            {BLOCKS.map((b, i) => (
              <div key={b.t} style={{ borderTop: '1px solid var(--line)', padding: '40px 0', display: 'grid', gridTemplateColumns: '56px 1fr', gap: 28 }}>
                <div className="svc-i">{String(i + 1).padStart(2, '0')}</div>
                <div>
                  <h2 className="h3" style={{ fontSize: 26 }}>{b.t}</h2>
                  <p className="body" style={{ marginTop: 14 }}>{b.d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="sec alt">
          <div className="wrap g2">
            <div>
              <div className="eyebrow">Who we work with</div>
              <h2 className="h2" style={{ marginTop: 16 }}>Clients</h2>
              <ul className="ticks" style={{ marginTop: 26 }}>
                <li>Family-owned and founder-led businesses</li>
                <li>Private equity funds and their portfolio companies</li>
                <li>Family offices and private investors</li>
                <li>Corporate groups and their subsidiaries</li>
                <li>Management teams in buy-outs and buy-ins</li>
                <li>Infrastructure and energy sponsors</li>
              </ul>
            </div>
            <div>
              <div className="eyebrow">Where we focus</div>
              <h2 className="h2" style={{ marginTop: 16 }}>Sectors</h2>
              <ul className="ticks" style={{ marginTop: 26 }}>
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
          <div className="wrap-narrow">
            <h2 className="h2" style={{ color: '#fff' }}>Have a situation you want a view on?</h2>
            <div style={{ marginTop: 32 }}><Link href="/contact" className="btn btn-solid">Contact Meridian</Link></div>
          </div>
        </section>
      </Layout>
    </>
  );
}
