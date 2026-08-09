import Head from 'next/head';
import Link from 'next/link';
import Layout, { PageHero } from '../components/Layout';

// Every mandate Meridian has acted on is subject to confidentiality. Transactions
// are therefore described generically: sector, transaction type, counterparty type,
// year and our role. No client is named and no value is disclosed.
const DEALS = [
  {
    y: '2025',
    t: 'Sale of a software company',
    c: 'Technology',
    r: 'Sell-side adviser',
    d: 'Advised the shareholders on the sale of the company, from preparation and positioning through to closing.',
  },
  {
    y: '2025',
    t: 'Sale of an infrastructure business to a private equity fund',
    c: 'Infrastructure',
    r: 'Sell-side adviser',
    d: 'Advised the shareholders on the disposal of the business to a financial sponsor.',
  },
];

export default function Transactions() {
  return (
    <>
      <Head>
        <title>Transactions &mdash; Meridian Capital Markets</title>
        <meta name="description" content="Selected transactions advised by Meridian Capital Markets. All mandates are confidential and are described without naming the parties." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/transactions" />
      </Head>
      <Layout>
        <PageHero
          eyebrow="Transactions"
          title="Selected mandates."
          sub="Every engagement is confidential. Transactions are described by sector, type and year, without naming the parties or disclosing value."
        />

        <section className="sec tight">
          <div className="wrap">
            <div className="tombs">
              {DEALS.map((d) => (
                <article key={d.t}>
                  <div className="tomb-y">{d.y}</div>
                  <h2 className="h3">{d.t}</h2>
                  <p>{d.d}</p>
                  <div className="tomb-meta">
                    <span>{d.c}</span>
                    <span>{d.r}</span>
                  </div>
                </article>
              ))}
            </div>

            <p className="small" style={{ marginTop: 48, maxWidth: '72ch' }}>
              Further transaction experience across technology, media and telecommunications and the
              pharmaceutical sector during 2024 and 2025. Details are withheld under the confidentiality
              undertakings given to the parties involved.
            </p>
          </div>
        </section>

        <section className="sec dark" style={{ textAlign: 'center' }}>
          <div className="wrap">
            <h2 className="h2">Considering a similar process?</h2>
            <div style={{ marginTop: 36 }}>
              <Link href="/contact" className="btn btn-solid">Contact Meridian <span>&rarr;</span></Link>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
}
