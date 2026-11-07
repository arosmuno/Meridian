// components/SiteNav.js -- barra de secciones para las subpaginas.
// Misma estructura y estilo que la de la portada (pages/index.js): grupos
// feed | publicacion | herramientas | about, separados por una linea fina.
import { Fragment } from 'react';
import { useRouter } from 'next/router';

const GROUPS = [
  [['/', 'Deals'], ['/weekly', 'Weekly'], ['/analysis', 'Analysis'], ['/rankings', 'Rankings'], ['/careers', 'Careers']],
  [['/learn', 'Learn'], ['/academy', 'Academy'], ['/dataroom', 'Dataroom']],
  [['/about', 'About']],
];

export default function SiteNav() {
  const { pathname } = useRouter();
  const isOn = (href) => (href === '/' ? pathname === '/' || pathname.startsWith('/deal') || pathname.startsWith('/sector') : pathname === href || pathname.startsWith(href + '/') || (href === '/about' && pathname === '/alberto'));
  return (
    <nav className="section-tabs" style={{ display: 'flex', justifyContent: 'center', alignItems: 'stretch', borderBottom: '1px solid var(--border)', background: 'var(--bg)', padding: '0 12px' }}>
      {GROUPS.map((group, gi) => (
        <Fragment key={gi}>
          {gi > 0 ? <span className="nav-sep" aria-hidden="true" style={{ width: 1, background: 'var(--border)', margin: '13px 10px' }} /> : null}
          {group.map(([href, label]) => {
            const on = isOn(href);
            return (
              <a key={href} href={href} className="nav-item site-nav-link" aria-current={on ? 'page' : undefined}
                style={{ padding: '15px 22px 12px', borderBottom: '2px solid ' + (on ? 'var(--gold)' : 'transparent'), color: on ? 'var(--text-hi)' : 'var(--text-mid)', fontFamily: 'var(--s)', fontSize: 11.5, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                {label}
              </a>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
}
