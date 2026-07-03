// pages/contact.js -- Contact Meridian (content page; AdSense legitimacy + reader trust).
import Head from 'next/head';

export default function Contact() {
  return (
    <>
      <Head>
        <title>Contact Meridian</title>
        <meta name="description" content="Get in touch with Meridian -- tips, corrections, feedback and enquiries. Reach us by email or on X." />
      </Head>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', padding: '12px 24px', textAlign: 'center' }}>
          <a href="/" style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', letterSpacing: '.04em', textDecoration: 'none' }}>MERIDIAN</a>
        </div>

        <article style={{ maxWidth: 640, margin: '0 auto', padding: '44px 22px 64px' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 10, letterSpacing: '.2em', color: 'var(--text-mid)', textTransform: 'uppercase', marginBottom: 10 }}>Contact</div>
          <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(34px,6vw,52px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.1, margin: '0 0 20px' }}>Get in touch</h1>

          <p style={{ fontFamily: 'var(--r)', fontSize: 17, color: 'var(--text-body)', lineHeight: 1.85, margin: '0 0 28px' }}>
            We welcome deal tips, corrections, feedback and partnership enquiries. Whether you have spotted an error, want to flag a transaction, or simply want to talk about the markets, we would be glad to hear from you.
          </p>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 22 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>Email</div>
              <a href="mailto:arosmuno@gmail.com" style={{ fontFamily: 'var(--d)', fontSize: 22, fontWeight: 700, color: 'var(--gold)', textDecoration: 'none' }}>arosmuno@gmail.com</a>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--s)', fontSize: 10, color: 'var(--text-mid)', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6 }}>On X</div>
              <a href="https://x.com/meridiancapmark" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--d)', fontSize: 22, fontWeight: 700, color: 'var(--gold)', textDecoration: 'none' }}>@meridiancapmark</a>
            </div>
          </div>
        </article>

        <div style={{ borderTop: '3px double var(--border)', background: 'var(--bg-card)', padding: '16px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--s)', fontSize: 9, color: 'var(--text-lo)', letterSpacing: '.06em' }}>
            <a href="/about" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>About</a>
            <a href="/contact" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Contact</a>
            <a href="/learn" style={{ color: 'var(--text-mid)', textDecoration: 'none', marginRight: 16 }}>Learn</a>
            <a href="/privacidad" style={{ color: 'var(--text-mid)', textDecoration: 'none' }}>Privacy</a>
          </div>
        </div>
      </div>
    </>
  );
}
