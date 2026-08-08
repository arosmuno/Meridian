import Head from 'next/head';
import Layout, { PageHero } from '../components/Layout';

export default function Contact() {
  return (
    <>
      <Head>
        <title>Contact &mdash; Meridian Capital Markets</title>
        <meta name="description" content="Contact Meridian Capital Markets to discuss an M&A or debt advisory situation." />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/contact" />
      </Head>
      <Layout>
        <PageHero
          eyebrow="Contact"
          title="Start with a conversation."
          sub="Initial discussions are confidential and carry no obligation on either side."
        />
        <section className="sec">
          <div className="wrap g2">
            <div>
              <h2 className="h3">Direct contact</h2>
              <p className="body" style={{ marginTop: 14, fontSize: 15 }}>
                The quickest route is email. A short note on the situation, the sector and rough size is
                enough to establish whether it makes sense to speak.
              </p>
              <div style={{ marginTop: 34 }}>
                <div className="contact-line">
                  <div className="lbl">Email</div>
                  <a href="mailto:arosmuno@gmail.com">arosmuno@gmail.com</a>
                </div>
                <div className="contact-line">
                  <div className="lbl">LinkedIn</div>
                  <a href="https://www.linkedin.com/in/arosado6" target="_blank" rel="noopener noreferrer">linkedin.com/in/arosado6</a>
                </div>
                <div className="contact-line">
                  <div className="lbl">Location</div>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 500, color: 'var(--ink)' }}>Madrid, Spain</span>
                </div>
              </div>
            </div>
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 40 }}>
              <h2 className="h3">What to include</h2>
              <ul className="ticks" style={{ marginTop: 22 }}>
                <li>The situation: sale, acquisition, financing or refinancing</li>
                <li>Sector and geography</li>
                <li>Approximate size or revenue scale</li>
                <li>Your timing, if there is any</li>
                <li>Whether other advisers are already involved</li>
              </ul>
              <h2 className="h3" style={{ marginTop: 44 }}>Market Intelligence</h2>
              <p className="body" style={{ marginTop: 14, fontSize: 15 }}>
                For corrections, omissions or tips relating to the news coverage, use the same
                address and mark the subject accordingly. Corrections are made promptly.
              </p>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
}
