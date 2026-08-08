import { supabase } from '../../lib/supabase';

const SITE = 'https://www.meridiancapmarkets.com';
const STATIC = ['', '/approach', '/services', '/intelligence', '/about', '/contact', '/privacy'];

export default async function handler(req, res) {
  let last = new Date().toISOString().split('T')[0];
  try {
    const { data } = await supabase.from('deals').select('fetched_at').order('fetched_at', { ascending: false }).limit(1);
    if (data && data[0] && data[0].fetched_at) last = new Date(data[0].fetched_at).toISOString().split('T')[0];
  } catch (e) {}
  const urls = STATIC.map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${last}</lastmod><changefreq>${p === '/intelligence' ? 'daily' : 'monthly'}</changefreq></url>`).join('\n');
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
}
