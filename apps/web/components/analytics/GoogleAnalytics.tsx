'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { useConsent } from './ConsentProvider';
import { GoogleAnalyticsSpaTracker } from './GoogleAnalyticsSpaTracker';

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;

/**
 * Loads Google Analytics (gtag.js) with default denied consent.
 * Updates consent state dynamically based on user selection in RGPD consent banner.
 */
export function GoogleAnalytics() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!GA_TRACKING_ID || typeof window === 'undefined' || typeof window.gtag !== 'function') {
      return;
    }

    if (consent === 'granted') {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    } else if (consent === 'denied') {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
    }
  }, [consent]);

  if (!GA_TRACKING_ID) return null;

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

          gtag('consent', 'default', {
            'analytics_storage': 'denied',
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied',
            'wait_for_update': 500
          });

          gtag('config', '${GA_TRACKING_ID}', {
            send_page_view: false
          });
        `}
      </Script>
      <GoogleAnalyticsSpaTracker />
    </>
  );
}
