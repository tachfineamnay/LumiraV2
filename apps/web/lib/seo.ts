import type { Metadata } from 'next';
import { absoluteUrl, SITE_LOCALE, SITE_NAME, SITE_URL } from './site';

export const DEFAULT_ROBOTS = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-image-preview': 'large' as const,
    'max-snippet': -1,
    'max-video-preview': -1,
  },
};

export const PRIVATE_ROBOTS = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

export function pageMetadata({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}): Metadata {
  const canonical = absoluteUrl(path);

  return {
    title,
    description,
    alternates: { canonical },
    robots: DEFAULT_ROBOTS,
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      locale: SITE_LOCALE,
    },
    twitter: {
      card: 'summary',
      title: `${title} | ${SITE_NAME}`,
      description,
    },
  };
}

export function noindexPageMetadata({
  title,
  description,
}: {
  title: string;
  description: string;
}): Metadata {
  return {
    title,
    description,
    robots: PRIVATE_ROBOTS,
  };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Oracle Lumira | Lecture personnalisée révisée par un expert',
    template: '%s | Oracle Lumira',
  },
  description:
    'Une lecture personnalisée interprétative, préparée avec l’IA puis révisée par un expert. PDF et audio privés, accès Sanctuaire 3 mois.',
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
  },
  twitter: { card: 'summary' },
};
