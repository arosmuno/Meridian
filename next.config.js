/** @type {import('next').NextConfig} */

// Cabeceras de seguridad aplicadas a todas las rutas.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // El visor de PDF carga pdf.js (y su worker) desde cdnjs.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com",
      "worker-src 'self' blob: https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdnjs.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
    ];
  },
  async rewrites() {
    return [
      // Pretty per-deal share URLs: /deal/<slug>-<id> served by /deal?slug=...
      { source: '/deal/:slug', destination: '/deal?slug=:slug' },
      { source: '/sector/:slug', destination: '/sector?slug=:slug' },
    ];
  },
  async redirects() {
    return [
      // La pagina de privacidad ahora vive en /privacy (ingles). El antiguo
      // /privacidad redirige de forma permanente para no romper enlaces.
      { source: '/privacidad', destination: '/privacy', permanent: true },
    ];
  },
};

module.exports = nextConfig;
