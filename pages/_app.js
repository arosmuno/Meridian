import Head from 'next/head';
import '../styles/globals.css';
import CookieConsent from '../components/CookieConsent';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>MERIDIAN — Capital Markets Intelligence</title>
        <meta name="description" content="The niche intelligence review for M&A, LBO, leveraged finance, project finance, and restructuring deals." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0a0808" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Google AdSense (solo cuando hay ID configurado y, en producción real, tras consentimiento) */}
        {process.env.NEXT_PUBLIC_ADSENSE_ID && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_ID}`}
            crossOrigin="anonymous"
          />
        )}
      </Head>
      <Component {...pageProps} />
      <CookieConsent />
    </>
  );
}
