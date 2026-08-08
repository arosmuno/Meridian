import Head from 'next/head';
import Link from 'next/link';
import Layout, { Arrow } from '../components/Layout';

const SERVICES = [
  { n: '01', t: 'Mergers & Acquisitions', d: 'Sell-side and buy-side execution, mergers, and financial sponsor entry: from positioning and valuation through to signing and closing.' },
  { n: '02', t: 'Debt Advisory', d: 'Corporate debt, acquisition finance, refinancings and structured capital. Lender outreach run as a competitive process, on your side of the table.' },
];

const PILLARS = [
  { t: 'Senior attention', d: 'A deliberately small number of live mandates. The person you meet is the person who builds the model and sits in the negotiation.' },
  { t: 'Genuinely independent', d: 'No lending book, no balance sheet, no products to place. The only interest is the outcome of your transaction.' },
  { t: 'Iberian focus', d: 'Close coverage of the Spanish and Portuguese mid-market, where local relationships and language decide who gets the call.' },
  { t: 'Process discipline', d: 'Institutional standards applied to mid-market situations: structured timetables, controlled information, credible tension.' },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>Meridian Capital Markets &mdash; M&amp;A and Debt Advisory</title>
        <meta name="description" content="Independent M&A and debt advisory for companies, shareholders and financial sponsors across Iberia." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/" />
      </Head>
      <Layout>

        <section className="hero">
          <div className="wrap">
            <div className="eyebrow">Independent Corporate Finance</div>
            <h1 className="display" style={{ marginTop: 26 }}>Advice that is only ever on your side of the table.</h1>
            <p className="lead">
              Meridian advises companies, shareholders and financial sponsors on mergers and acquisitions,
              and on debt advisory across the Iberian mid-market.
            </p>
            <div className="hero-cta">
              <Link href="/contact" className="btn btn-solid">Start a conversation <span>&rarr;</span></Link>
              <Link href="/services" className="btn btn-ghost">Our services</Link>
            </div>
          </div>
        </section>

        <section className="sec alt">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">What we do</div>
              <h2 className="h2">Three disciplines, executed properly.</h2>
            </div>
            <div className="g3">
              {SERVICES.map((s) => (
                <div key={s.n} className="numbered">
                  <span className="idx">{s.n}</span>
                  <h3 className="h3">{s.t}</h3>
                  <p className="body">{s.d}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 64 }}>
              <Arrow href="/services">Explore in detail</Arrow>
            </div>
          </div>
        </section>

        <section className="sec dark">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow on-dark">The firm</div>
              <h2 className="h2">A new practice, built on institutional training.</h2>
              <p className="lead on-dark">
                Meridian was founded by Alberto Rosado Mu&ntilde;oz, who trained in corporate and investment
                banking at BBVA and BNP Paribas, working on mergers, acquisitions and financing transactions
                in Iberia.
              </p>
              <p className="body" style={{ marginTop: 24 }}>
                The firm is newly established. Rather than present past employers&apos; transactions as a track
                record, we set out the founder&apos;s background in full and let you judge it.
              </p>
              <div style={{ marginTop: 40 }}>
                <Arrow href="/about">About the founder</Arrow>
              </div>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Our approach</div>
              <h2 className="h2">Why clients work with an independent adviser.</h2>
            </div>
            <div className="g2">
              {PILLARS.map((p) => (
                <div key={p.t} className="numbered">
                  <h3 className="h3">{p.t}</h3>
                  <p className="body">{p.d}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 64 }}>
              <Arrow href="/approach">Read our approach</Arrow>
            </div>
          </div>
        </section>

        <section className="sec alt">
          <div className="wrap g2 offset">
            <div>
              <div className="eyebrow">Market Intelligence</div>
              <h2 className="h2" style={{ marginTop: 18 }}>We follow the European deal market, in public.</h2>
              <p className="body" style={{ marginTop: 26 }}>
                Meridian publishes daily news coverage of European M&amp;A and financing activity, compiled from
                regulators, newswires and the financial press. It is how we stay close to structures,
                pricing and who is active, and it is open to read.
              </p>
              <div style={{ marginTop: 36 }}>
                <Link href="/intelligence" className="btn btn-solid">Read the latest news <span>&rarr;</span></Link>
              </div>
            </div>
            <div className="stat">
              <div className="stat-num">Daily</div>
              <div className="stat-lbl">Compiled from primary sources</div>
              <ul className="ticks" style={{ marginTop: 40 }}>
                <li>Every item linked to its original publication</li>
                <li>Structured by transaction type and sector</li>
                <li>Editorially separate from the advisory practice</li>
                <li>No confidential or client information, ever</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="sec dark" style={{ textAlign: 'center' }}>
          <div className="wrap">
            <div className="eyebrow on-dark">Get in touch</div>
            <h2 className="h2" style={{ marginTop: 20 }}>Considering a transaction?</h2>
            <p className="lead on-dark" style={{ margin: '24px auto 0', maxWidth: '54ch' }}>
              Most good processes start with an informal conversation, long before a mandate exists.
              Those conversations are confidential and carry no obligation.
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
