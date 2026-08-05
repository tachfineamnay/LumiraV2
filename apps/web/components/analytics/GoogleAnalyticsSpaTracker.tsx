'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConsent } from './ConsentProvider';
import { GA_TRACKING_ID } from './GoogleAnalytics';

const EXCLUDED_PREFIXES = ['/desk', '/expert', '/admin', '/sanctuaire'];

const SENSITIVE_QUERY_PARAMS = [
  'payment_intent',
  'payment_intent_client_secret',
  'token',
  'jwt',
  'email',
];

export function cleanUrlForAnalytics(pathname: string, searchParams: URLSearchParams): string {
  const cleanParams = new URLSearchParams();

  searchParams.forEach((value, key) => {
    if (!SENSITIVE_QUERY_PARAMS.includes(key.toLowerCase())) {
      cleanParams.append(key, value);
    }
  });

  const queryString = cleanParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function GoogleAnalyticsSpaTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { consent } = useConsent();
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !GA_TRACKING_ID ||
      consent !== 'granted' ||
      typeof window === 'undefined' ||
      typeof window.gtag !== 'function'
    ) {
      return;
    }

    // Exclure les zones privées
    if (EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return;
    }

    const cleanPath = cleanUrlForAnalytics(pathname, searchParams);

    // Éviter les envois de page_view en double sur un même composant/rerender
    if (lastTrackedPathRef.current === cleanPath) {
      return;
    }
    lastTrackedPathRef.current = cleanPath;

    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: `${window.location.origin}${cleanPath}`,
      page_path: cleanPath,
    });
  }, [pathname, searchParams, consent]);

  return null;
}
