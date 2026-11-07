import Head from 'next/head';
import { useRouter } from 'next/router';
import { Analytics } from '@vercel/analytics/next';
import '../styles/globals.css';

const SITE = 'https://www.meridiancapmarkets.com';
const DEFAULT_TITLE = 'MERIDIAN — M&A & Capital Markets Intelligence';
const DEFAULT_DESC = 'Deals, financing and capital markets across Europe and Iberia: M&A, leveraged finance, project finance and debt advisory, with a link to every source.';

export default function App({ Component, pageProps }) {
  const { asPath } = useRouter();
  const url = SITE + (asPath || '/').split(/[?#]/)[0];
  return (
    <>
      <Head>
        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESC} key="description" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#faf8f3" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Vista previa al compartir. Las paginas que tengan la suya la sustituyen usando el mismo key. */}
        <meta property="og:site_name" content="Meridian" key="og:site_name" />
        <meta property="og:type" content="website" key="og:type" />
        <meta property="og:title" content={DEFAULT_TITLE} key="og:title" />
        <meta property="og:description" content={DEFAULT_DESC} key="og:description" />
        <meta property="og:url" content={url} key="og:url" />
        <meta property="og:image" content={SITE + '/api/og'} key="og:image" />
        <meta property="og:image:width" content="1200" key="og:image:width" />
        <meta property="og:image:height" content="630" key="og:image:height" />
        <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
        <meta name="twitter:title" content={DEFAULT_TITLE} key="twitter:title" />
        <meta name="twitter:description" content={DEFAULT_DESC} key="twitter:description" />
        <meta name="twitter:image" content={SITE + '/api/og'} key="twitter:image" />
      </Head>
      <Component {...pageProps} />
      <Analytics />
    </>
  );
}
