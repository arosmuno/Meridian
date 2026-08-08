import Head from 'next/head';
import Layout, { PageHero } from '../components/Layout';

const S = ({ title, children }) => (
  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 26, marginTop: 34 }}>
    <h2 className="h3">{title}</h2>
    <div className="body" style={{ marginTop: 12, fontSize: 15 }}>{children}</div>
  </div>
);

export default function Privacy() {
  return (
    <>
      <Head>
        <title>Privacy Policy &mdash; Meridian Capital Markets</title>
        <link rel="canonical" href="https://www.meridiancapmarkets.com/privacy" />
      </Head>
      <Layout>
        <PageHero eyebrow="Legal" title="Privacy Policy" sub="Last updated: 8 August 2026" />
        <section className="sec">
          <div className="wrap">
            <div style={{ maxWidth: 760 }}>
              <S title="1. Who we are">
                Meridian Capital Markets is an independent corporate finance advisory practice.
                For any question about privacy or data protection, contact{' '}
                <a href="mailto:arosmuno@gmail.com" style={{ color: 'var(--accent)' }}>arosmuno@gmail.com</a>.
              </S>
              <S title="2. What we process">
                This website has no user accounts and no forms. We do not directly collect identifying personal
                data through it. As with any website, our hosting provider records basic technical data &mdash; IP
                address, browser type, date and time &mdash; in server logs for security and operational purposes.
                If you email us, we process the contents of your message in order to respond.
              </S>
              <S title="3. Cookies">
                We use only cookies that are strictly necessary for the site to function. We do not run
                advertising cookies and we do not use third-party behavioural tracking.
              </S>
              <S title="4. Third parties">
                We use <strong>Vercel</strong> for hosting and <strong>Supabase</strong> for the content database
                behind Market Intelligence. Each processes technical data under its own policy.
              </S>
              <S title="5. Legal basis and your rights">
                The legal bases are your consent, where given, and our legitimate interest in operating and
                securing this website and responding to enquiries. You have the right to access, rectify, erase,
                restrict or object to processing, to data portability, and to withdraw consent at any time.
                Write to <a href="mailto:arosmuno@gmail.com" style={{ color: 'var(--accent)' }}>arosmuno@gmail.com</a>.
                You may also complain to your local supervisory authority &mdash; in Spain, the AEPD.
              </S>
              <S title="6. Changes">
                We may update this policy to reflect legal or operational changes. The current version is always
                published on this page with its date.
              </S>
            </div>
          </div>
        </section>
      </Layout>
    </>
  );
}
