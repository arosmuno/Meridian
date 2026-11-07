// lib/social.js -- perfiles de Meridian en redes. Una URL vacia = no se muestra en la web.
export const SOCIAL = [
  { key: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/meridiancapmarkets/' },
  { key: 'x', label: 'X', url: '' },          // https://x.com/MeridianCapMkts
  { key: 'instagram', label: 'Instagram', url: '' }, // https://www.instagram.com/meridiancapmarkets/
];
export const SOCIAL_LIVE = SOCIAL.filter((s) => s.url);
