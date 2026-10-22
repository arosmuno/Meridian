// pages/sitemap.xml.js -- sitemap para buscadores: paginas fijas, sectores y fichas de operaciones.
// No existia desde la vuelta a Market News, asi que Google solo encontraba la portada.
import { supabaseAdmin } from '../lib/supabase';

const SITE = 'https://www.meridiancapmarkets.com';
const STATIC = ['', '/weekly', '/rankings', '/analysis', '/careers', '/learn', '/academy', '/methodology', '/about', '/contact', '/privacy'];
const SECTORS = ['healthcare', 'tmt', 'infrastructure', 'energy-renewables', 'financial-services', 'consumer', 'industrials', 'real-estate'];
const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function getServerSideProps({ res }) {
  const today = new Date().toISOString().slice(0, 10);
  let deals = [];
  try {
    const { data } = await supabaseAdmin
      .from('deals').select('id, headline, created_at')
      .eq('category', 'deal').is('dup_of', null)
      .order('created_at', { ascending: false }).limit(2000);
    deals = data || [];
  } catch (e) {}

  const urls = [
    ...STATIC.map((p) => `<url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod><changefreq>${p === '' ? 'hourly' : 'weekly'}</changefreq></url>`),
    ...SECTORS.map((s) => `<url><loc>${SITE}/sector/${s}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`),
    ...deals.map((d) => `<url><loc>${esc(SITE + '/deal/' + slugify(d.headline) + '-' + d.id)}</loc><lastmod>${String(d.created_at).slice(0, 10)}</lastmod></url>`),
  ];
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`);
  res.end();
  return { props: {} };
}

export default function Sitemap() { return null; }
