import Head from 'next/head';

const C = {
  bg: '#0d0d0f', card: '#141418', border: '#2e2e38',
  hi: '#f0ece4', body: '#c8c0b4', mid: '#8a8278', gold: '#d4a853',
};

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: C.hi, margin: '0 0 10px' }}>{title}</h2>
      <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 15, lineHeight: 1.8, color: C.body }}>{children}</div>
    </section>
  );
}

export default function Privacy() {
  const updated = '18 October 2026';
  return (
    <>
      <Head>
        <title>Privacy Policy — MERIDIAN</title>
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href="https://www.meridiancapmarkets.com/privacy" />
      </Head>
      <div style={{ background: '#08050a', minHeight: '100vh', padding: '0 0 60px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 22px' }}>
          <a href="/" style={{ fontFamily: "'Libre Franklin', sans-serif", fontSize: 12, color: C.gold, textDecoration: 'none', letterSpacing: '.08em' }}>← MERIDIAN</a>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 800, color: C.hi, margin: '18px 0 6px' }}>Privacy Policy</h1>
          <p style={{ fontFamily: "'Libre Franklin', sans-serif", fontSize: 12, color: C.mid, marginBottom: 32 }}>Last updated: {updated}</p>

          <Section title="1. Who we are">
            This website ("Meridian") is an independent capital-markets intelligence publication.
            For any question about privacy or data protection you can contact us at{' '}
            <a href="mailto:arosmuno@gmail.com" style={{ color: C.gold }}>arosmuno@gmail.com</a>.
          </Section>

          <Section title="2. What data we process">
            Meridian does not require registration. If you subscribe to The Meridian Weekly or join an
            Academy waitlist, we store your email address and the products you asked about, only to send
            you that newsletter or launch notice. Every email includes a one-click unsubscribe link, and
            you can ask us to delete your address at any time. Like any website, our hosting provider may record
            basic technical data (IP address, browser type, date and time) in the server logs for security
            and operational purposes.
          </Section>

          <Section title="3. Cookies">
            Meridian does not use advertising or tracking cookies. The site only stores your light/dark
            theme choice in your own browser.
          </Section>

          <Section title="4. Third parties">
            We use the following providers, which may process technical data under their own policies:{' '}
            <strong>Vercel</strong> (hosting), <strong>Supabase</strong> (database) and <strong>Resend</strong> (newsletter delivery).
          </Section>

          <Section title="5. Legal basis and your rights">
            The legal basis is your consent (for non-essential cookies) and our legitimate interest in the
            operation and security of the site. You have the right to access, rectify, erase, restrict or
            object to the processing of your data, as well as to data portability and to withdraw consent at
            any time. To exercise these rights, write to{' '}
            <a href="mailto:arosmuno@gmail.com" style={{ color: C.gold }}>arosmuno@gmail.com</a>. You may also
            lodge a complaint with your local data protection authority (for example, the AEPD in Spain or the
            ICO in the UK).
          </Section>

          <Section title="6. Changes to this policy">
            We may update this policy to reflect legal or service changes. We will publish the current version
            on this page together with its update date.
          </Section>

          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 36, paddingTop: 16 }}>
            <a href="/" style={{ fontFamily: "'Libre Franklin', sans-serif", fontSize: 12, color: C.mid, textDecoration: 'none' }}>← Back to Meridian</a>
          </div>
        </div>
      </div>
    </>
  );
}
