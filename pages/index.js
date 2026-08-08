import Head from 'next/head';
import Link from 'next/link';
import Layout from '../components/Layout';

const SERVICES = [
  { n: '01', t: 'Mergers & Acquisitions', d: 'Sell-side and buy-side execution, mergers, and financial sponsor entry: from positioning and valuation through to signing and closing.' },
  { n: '02', t: 'Debt Advisory', d: 'Corporate debt, acquisition finance, refinancings and structured capital. Lender outreach run as a competitive process, on your side of the table.' },
  { n: '03', t: 'Project Finance', d: 'Financing structuring for infrastructure and energy assets, with bankable models built to withstand lender and investor diligence.' },
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
        <title>Meridian Capital Markets &mdash; M&amp;A, Debt Advisory &amp; Project Finance</title>
        <meta name="description" content="Independent M&A, debt advisory and project finance for companies, shareholders and financial sponsors across Iberia." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/" />
      </Head>
      <Layout>
        <section className="hero">
          <div className="wrap">
            <div className="eyebrow on-dark">Independent Corporate Finance</div>
            <h1 className="display" style={{ marginTop: 22 }}>Advice that is only ever on your side of the table.</h1>
            <p className="lead on-dark hero-sub">
              Meridian advises companies, shareholders and financial sponsors on mergers and acquisitions,
              debt advisory and project finance across the Iberian mid-market.
            </p>
            <div style={{ marginTop: 42, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link href="/contact" className="btn btn-solid">Start a conversation</Link>
              <Link href="/services" className="btn btn-ghost on-dark">Our services</Link>
            </div>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">What we do</div>
              <h2 className="h2" style={{ marginTop: 16 }}>Three disciplines, executed properly.</h2>
            </div>
            <div className="g3">
              {SERVICES.map((s) => (
                <div key={s.n}>
                  <div className="svc-i">{s.n}</div>
                  <h3 className="h3" style={{ marginTop: 14 }}>{s.t}</h3>
                  <hr className="rule" style={{ margin: '20px 0' }} />
                  <p className="body" style={{ fontSize: 15 }}>{s.d}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 48 }}>
              <Link href="/services" className="btn btn-ghost">Explore in detail</Link>
            </div>
          </div>
        </section>

        <section className="sec dark">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow on-dark">Background</div>
              <h2 className="h2" style={{ marginTop: 16, color: '#fff' }}>Built on institutional experience.</h2>
              <p className="lead on-dark" style={{ marginTop: 20, fontSize: 16 }}>
                Meridian is founded on five years in corporate and investment banking at BBVA and BNP Paribas,
                across M&amp;A, leveraged finance and project finance in the Iberian energy and TMT sectors.
              </p>
            </div>
            <div className="g4">
              {[
                { k: '5', v: 'Years in investment banking' },
                { k: '30m to 1bn', v: 'Transaction size range (EUR)' },
                { k: '2', v: 'Global banks: BBVA, BNP Paribas' },
                { k: 'Iberia', v: 'Energy, TMT, Infrastructure' },
              ].map((m) => (
                <div key={m.v}>
                  <div className="num">{m.k}</div>
                  <div className="num-lbl">{m.v}</div>
                </div>
              ))}
            </div>
            <p className="disclaimer" style={{ marginTop: 40 }}>
              Figures describe the founder&apos;s prior transaction experience gained while employed at those
              institutions. They are not transactions executed by Meridian.
            </p>
          </div>
        </section>

        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <div className="eyebrow">Our approach</div>
              <h2 className="h2" style={{ marginTop: 16 }}>Why clients work with an independent adviser.</h2>
            </div>
            <div className="g2">
              {PILLARS.map((p) => (
                <div key={p.t} style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
                  <h3 className="h3">{p.t}</h3>
                  <p className="body" style={{ marginTop: 12, fontSize: 15 }}>{p.d}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 52 }}>
              <Link href="/approach" className="btn btn-ghost">Read our approach</Link>
            </div>
          </div>
        </section>

        <section className="sec alt">
          <div className="wrap g2" style={{ alignItems: 'center' }}>
            <div>
              <div className="eyebrow">Market Intelligence</div>
              <h2 className="h2" style={{ marginTop: 16 }}>We track the European deal market, in public.</h2>
              <hr className="rule" />
              <p className="body">
                Meridian maintains an independent record of European M&amp;A, buyout, leveraged finance and
                project finance activity, compiled continuously from regulators, newswires and the financial press.
                It is how we stay close to structures, pricing and who is active, and it is open to read.
              </p>
              <div style={{ marginTop: 30 }}>
                <Link href="/intelligence" className="btn btn-solid">View the deal record</Link>
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 40 }}>
              <ul className="ticks">
                <li>European and Iberian transactions, updated continuously</li>
                <li>Every entry linked to its original published source</li>
                <li>Structured by type, sector, geography and value</li>
                <li>Editorially separate from the advisory practice</li>
                <li>No confidential or client information, ever</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="sec dark" style={{ textAlign: 'center' }}>
          <div className="wrap-narrow">
            <div className="eyebrow on-dark">Get in touch</div>
            <h2 className="h2" style={{ marginTop: 18, color: '#fff' }}>Considering a transaction?</h2>
            <p className="lead on-dark" style={{ marginTop: 18, fontSize: 16 }}>
              Most good processes start with an informal conversation, long before a mandate exists.
              Those conversations are confidential and carry no obligation.
            </p>
            <div style={{ marginTop: 36 }}>
              <Link href="/contact" className="btn btn-solid">Contact Meridian</Link>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
}
