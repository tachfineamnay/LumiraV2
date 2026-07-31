import { LUMIRA_EARLY_OFFER } from '@packages/shared';

export const SITE_URL = 'https://oraclelumira.com';
export const SITE_NAME = 'Oracle Lumira';
export const SITE_LOCALE = 'fr_FR';
export const SITE_LANGUAGE = 'fr';
export const CONTACT_EMAIL = 'contact@oraclelumira.com';

/**
 * A content revision date, not a deployment timestamp. Update it only when the
 * corresponding public copy changes.
 */
export const PUBLIC_CONTENT_LAST_MODIFIED = new Date('2026-07-31T00:00:00.000Z');

export const OFFER = {
  ...LUMIRA_EARLY_OFFER,
  currencyCode: LUMIRA_EARLY_OFFER.currency,
  currencySymbol: '€',
  deliveryLabel: `${LUMIRA_EARLY_OFFER.deliveryWindowHours.min} à ${LUMIRA_EARLY_OFFER.deliveryWindowHours.max} heures après scellement du dossier`,
  paymentLabel: 'paiement unique',
} as const;

export const INDEXABLE_PUBLIC_ROUTES = [
  {
    path: '/',
    title: 'Lecture personnalisée révisée par un expert',
    description:
      'Une lecture personnalisée interprétative, préparée avec l’IA puis révisée par un expert. PDF et audio privés, accès Sanctuaire 3 mois. 17 €, paiement unique.',
  },
  {
    path: '/notre-approche',
    title: 'Notre approche',
    description:
      'Comprendre la démarche Lumira : dossier scellé, préparation par IA, révision humaine et limites claires d’une lecture interprétative.',
  },
  {
    path: '/faq',
    title: 'Questions fréquentes',
    description:
      'Réponses claires sur le prix, les livrables, le délai, la confidentialité et les limites de la lecture personnalisée Lumira.',
  },
] as const;

export type IndexablePublicPath = (typeof INDEXABLE_PUBLIC_ROUTES)[number]['path'];

export function absoluteUrl(path = '/') {
  return new URL(path, SITE_URL).toString();
}

export function routeLastModified(path: IndexablePublicPath) {
  const route = INDEXABLE_PUBLIC_ROUTES.find((entry) => entry.path === path);
  if (!route) throw new Error(`Unknown public route: ${path}`);
  return PUBLIC_CONTENT_LAST_MODIFIED;
}
