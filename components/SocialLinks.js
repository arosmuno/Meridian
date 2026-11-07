// components/SocialLinks.js -- enlaces a las redes de Meridian para los pies de pagina.
import { SOCIAL_LIVE } from '../lib/social';

export default function SocialLinks({ style, first }) {
  return SOCIAL_LIVE.map((s, i) => (
    <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer"
      style={{ color: 'var(--text-mid)', textDecoration: 'none', marginLeft: i === 0 && !first ? 0 : 16, ...style }}>
      {s.label}
    </a>
  ));
}
