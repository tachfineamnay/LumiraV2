'use client';

import Script from 'next/script';
import { useConsent } from './ConsentProvider';

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-NTCVR1YYN8';

/**
 * Loads Google Analytics (gtag.js).
 * afterInteractive strategy loads the script after the page becomes interactive.
 * Rendered only after the user has granted analytics consent (RGPD).
 */
export function GoogleAnalytics() {
  const { consent } = useConsent();

  if (!GA_TRACKING_ID || consent !== 'granted') return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', '${GA_TRACKING_ID}');
        `}
      </Script>
    </>
  );
}
