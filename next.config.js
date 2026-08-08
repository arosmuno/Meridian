/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
  async headers() { return [{ source: '/:path*', headers: securityHeaders }]; },
  async redirects() {
    return [
      { source: '/privacidad', destination: '/privacy', permanent: true },
      { source: '/advisory', destination: '/services', permanent: true },
      { source: '/learn', destination: '/intelligence', permanent: true },
      { source: '/news', destination: '/intelligence', permanent: true },
      { source: '/wrap', destination: '/intelligence', permanent: true },
      { source: '/analysis', destination: '/intelligence', permanent: true },
      { source: '/rankings', destination: '/intelligence', permanent: true },
      { source: '/careers', destination: '/intelligence', permanent: true },
      { source: '/methodology', destination: '/intelligence', permanent: true },
      { source: '/dataroom', destination: '/', permanent: false },
      { source: '/deal/:slug*', destination: '/intelligence', permanent: true },
      { source: '/sector/:slug*', destination: '/intelligence', permanent: true }
    ];
  },
};
module.exports = nextConfig;
