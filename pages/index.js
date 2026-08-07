// pages/index.js -- MERIDIAN: home de la firma de asesoria (M&A / Debt Advisory / Project Finance).
// El diario/deal-tracker que antes vivia aqui se ha movido a /news, intacto.
import Head from 'next/head';
import Link from 'next/link';
import { LangProvider, AdvisoryHeader, AdvisoryFooter, useLang } from '../components/AdvisoryShell';

const Kicker = (p) => (
  <div style={{ fontFamily: 'var(--s)', fontSize: 11, fontWeight: 800, letterSpacing: '.22em', color: 'var(--gold)', marginBottom: 12, textAlign: p.center ? 'center' : 'left' }}>
    {p.children}
  </div>
);

function Hero() {
  const { t } = useLang();
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px 64px', borderBottom: '1px solid var(--border)' }}>
      <Kicker center>&#10022; {t.hero.kicker} &#10022;</Kicker>
      <h1 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(38px,6vw,66px)', fontWeight: 800, color: 'var(--text-hi)', lineHeight: 1.08, margin: '0 auto 22px', maxWidth: 780 }}>
        {t.hero.title}
      </h1>
      <p style={{ fontFamily: 'var(--r)', fontSize: 18, color: 'var(--text-body)', lineHeight: 1.75, maxWidth: 620, margin: '0 auto 36px' }}>
        {t.hero.sub}
      </p>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="mailto:arosmuno@gmail.com" style={{ background: 'var(--gold)', color: '#fff', padding: '14px 28px', fontFamily: 'var(--s)', fontSize: 13, fontWeight: 800, letterSpacing: '.06em', textDecoration: 'none', textTransform: 'uppercase' }}>
          {t.hero.cta1}
        </a>
        <Link href="/news" style={{ border: '1px solid var(--border-hi)', color: 'var(--text-hi)', padding: '14px 28px', fontFamily: 'var(--s)', fontSize: 13, fontWeight: 800, letterSpacing: '.06em', textDecoration: 'none', textTransform: 'uppercase' }}>
          {t.hero.cta2}
        </Link>
      </div>
    </div>
  );
}

function Services() {
  const { t } = useLang();
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <Kicker center>{t.services.kicker}</Kicker>
        <h2 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 800, color: 'var(--text-hi)', margin: 0 }}>{t.services.title}</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 22 }}>
        {t.services.items.map((s) => (
          <div key={s.name} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '32px 26px' }}>
            <div style={{ fontFamily: 'var(--d)', fontSize: 26, fontWeight: 800, color: 'var(--text-hi)', marginBottom: 4 }}>{s.name}</div>
            <div style={{ fontFamily: 'var(--s)', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--gold)', textTransform: 'uppercase', marginBottom: 16 }}>{s.tag}</div>
            <p style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', lineHeight: 1.75, margin: 0 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackRecord() {
  const { t } = useLang();
  return (
    <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '64px 24px', display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)', gap: 48, alignItems: 'center' }}>
        <div>
          <Kicker>{t.track.kicker}</Kicker>
          <h2 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(26px,3.6vw,36px)', fontWeight: 800, color: 'var(--text-hi)', margin: '0 0 18px' }}>{t.track.title}</h2>
          <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-body)', lineHeight: 1.8, margin: 0 }}>{t.track.body}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {t.track.items.map((it) => (
            <div key={it.v} style={{ borderLeft: '3px solid var(--gold)', paddingLeft: 18 }}>
              <div style={{ fontFamily: 'var(--d)', fontSize: 30, fontWeight: 800, color: 'var(--text-hi)' }}>{it.k}</div>
              <div style={{ fontFamily: 'var(--s)', fontSize: 12, color: 'var(--text-mid)', letterSpacing: '.03em' }}>{it.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Founder() {
  const { t } = useLang();
  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '72px 24px', textAlign: 'center' }}>
      <Kicker center>{t.founder.kicker}</Kicker>
      <h2 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(26px,3.6vw,36px)', fontWeight: 800, color: 'var(--text-hi)', margin: '0 0 18px' }}>{t.founder.title}</h2>
      <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-body)', lineHeight: 1.85, margin: '0 0 22px' }}>{t.founder.body}</p>
      <Link href="/about" style={{ fontFamily: 'var(--s)', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', color: 'var(--gold)', textDecoration: 'none', textTransform: 'uppercase' }}>
        {t.founder.link} &#8250;
      </Link>
    </div>
  );
}

function TrackerTeaser() {
  const { t } = useLang();
  return (
    <div style={{ background: 'var(--bg-hover)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '56px 24px', textAlign: 'center' }}>
        <Kicker center>{t.tracker.kicker}</Kicker>
        <h2 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(22px,3.2vw,30px)', fontWeight: 800, color: 'var(--text-hi)', margin: '0 0 16px' }}>{t.tracker.title}</h2>
        <p style={{ fontFamily: 'var(--r)', fontSize: 15, color: 'var(--text-body)', lineHeight: 1.8, margin: '0 0 22px' }}>{t.tracker.body}</p>
        <Link href="/news" style={{ border: '1px solid var(--border-hi)', color: 'var(--text-hi)', padding: '12px 24px', fontFamily: 'var(--s)', fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textDecoration: 'none', textTransform: 'uppercase' }}>
          {t.tracker.cta}
        </Link>
      </div>
    </div>
  );
}

function ContactCta() {
  const { t } = useLang();
  return (
    <div style={{ textAlign: 'center', padding: '72px 24px' }}>
      <h2 style={{ fontFamily: 'var(--d)', fontSize: 'clamp(26px,3.6vw,36px)', fontWeight: 800, color: 'var(--text-hi)', margin: '0 0 12px' }}>{t.cta.title}</h2>
      <p style={{ fontFamily: 'var(--r)', fontSize: 16, color: 'var(--text-body)', margin: '0 0 22px' }}>{t.cta.body}</p>
      <a href="mailto:arosmuno@gmail.com" style={{ fontFamily: 'var(--d)', fontSize: 22, fontWeight: 700, color: 'var(--gold)', textDecoration: 'none' }}>{t.cta.button}</a>
    </div>
  );
}

function HomeInner() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <AdvisoryHeader />
      <Hero />
      <Services />
      <TrackRecord />
      <Founder />
      <TrackerTeaser />
      <ContactCta />
      <AdvisoryFooter />
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Head>
        <title>MERIDIAN — M&amp;A, Debt Advisory &amp; Project Finance</title>
        <meta name="description" content="Asesoramiento independiente en M&A, Debt Advisory y Project Finance para companias, fondos y accionistas en Iberia. Alberto Rosado Munoz." />
      </Head>
      <LangProvider>
        <HomeInner />
      </LangProvider>
    </>
  );
}
