import { useState } from 'react';
import Link from 'next/link';

const LINKS = [
  { href: '/approach', label: 'Approach' },
  { href: '/services', label: 'Services' },
  { href: '/intelligence', label: 'News' },
  { href: '/about', label: 'About' },
];

const Brand = () => (
  <Link href="/" className="brand"><b>MERIDIAN</b><i>Capital Markets</i></Link>
);

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="hdr">
      <div className="wrap hdr-in">
        <Brand />
        <button className="burger" onClick={() => setOpen(!open)} aria-label="Menu">{open ? 'CLOSE' : 'MENU'}</button>
        <nav className={open ? 'nav open' : 'nav'}>
          {LINKS.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>)}
          <Link href="/contact" className="btn btn-solid" onClick={() => setOpen(false)}>Contact</Link>
        </nav>
      </div>
    </header>
  );
}

export function PageHero({ eyebrow, title, sub }) {
  return (
    <section className="hero page dark">
      <div className="wrap">
        <div className="eyebrow on-dark">{eyebrow}</div>
        <h1 className="display" style={{ marginTop: 22 }}>{title}</h1>
        {sub ? <p className="lead on-dark hero-sub">{sub}</p> : null}
      </div>
    </section>
  );
}

export function Arrow({ href, children }) {
  const inner = <>{children}<span>&rarr;</span></>;
  return href.startsWith('/')
    ? <Link href={href} className="arrow">{inner}</Link>
    : <a href={href} className="arrow">{inner}</a>;
}

export function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr-grid">
          <div>
            <Brand />
            <p className="disclaimer">
              Independent advisory in mergers &amp; acquisitions and debt advisory, serving companies,
              shareholders and financial sponsors across Iberia.
            </p>
          </div>
          <div>
            <h4>Firm</h4>
            <Link href="/approach">Approach</Link>
            <Link href="/services">Services</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div>
            <h4>Resources</h4>
            <Link href="/intelligence">Market News</Link>
            <a href="https://www.linkedin.com/in/arosado6" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a href="mailto:arosmuno@gmail.com">arosmuno@gmail.com</a>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
        <div className="ftr-btm">
          <span>&copy; {new Date().getFullYear()} Meridian Capital Markets</span>
          <span>Madrid &middot; Iberia</span>
        </div>
        <p className="disclaimer">
          Meridian Capital Markets provides transaction advisory services. Nothing on this website constitutes
          investment advice, an offer, or a solicitation to buy or sell any security. The Market News section
          is compiled from publicly available sources and is entirely separate from the advisory practice; it draws on no confidential or non-public client information.
        </p>
      </div>
    </footer>
  );
}

export default function Layout({ children }) {
  return (<><Header />{children}<Footer /></>);
}
