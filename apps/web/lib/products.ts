import { LUMIRA_EARLY_OFFER } from '@packages/shared';

// =============================================================================
// V1 — Early-adopter offer (source: LUMIRA_EARLY_OFFER)
// =============================================================================

export interface FeatureGroup {
  title: string;
  items: { label: string; detail: string }[];
}

export interface SubscriptionProduct {
  code: string;
  name: string;
  price: number; // euros (paiement unique)
  amountCents: number;
  accessDurationMonths: number;
  description: string;
  features: string[];
  featureGroups: FeatureGroup[];
  ctaLabel: string;
  guaranteeText: string;
  deliveryLabel: string;
  accessLabel: string;
}

/**
 * The one and only public offer — mirrors server catalog.
 */
export const SUBSCRIPTION: SubscriptionProduct = {
  code: LUMIRA_EARLY_OFFER.code,
  name: LUMIRA_EARLY_OFFER.publicName,
  price: LUMIRA_EARLY_OFFER.priceEuros,
  amountCents: LUMIRA_EARLY_OFFER.amountCents,
  accessDurationMonths: LUMIRA_EARLY_OFFER.accessDurationMonths,
  description: `Lecture personnalisée et accès Sanctuaire ${LUMIRA_EARLY_OFFER.accessDurationMonths} mois (early)`,
  features: [
    'Dossier client sécurisé',
    'Lecture personnalisée',
    'Révision par un expert humain',
    'PDF privé',
    'Narration audio privée',
    `Accès au Sanctuaire pendant ${LUMIRA_EARLY_OFFER.accessDurationMonths} mois`,
  ],
  featureGroups: [
    {
      title: 'Votre lecture personnalisée',
      items: [
        {
          label: 'Dossier client sécurisé',
          detail:
            'Vos informations et médias restent privés, liés à votre compte, et ne sont jamais exposés par identifiant seul.',
        },
        {
          label: 'Lecture personnalisée',
          detail:
            'Une lecture interprétative construite à partir de votre dossier, puis préparée pour validation humaine.',
        },
        {
          label: 'Révision par un expert',
          detail:
            'Un expert humain relit et valide le contenu avant livraison — aucune promesse médicale ou prédictive.',
        },
      ],
    },
    {
      title: 'Vos livrables privés',
      items: [
        {
          label: 'PDF privé',
          detail: 'Votre lecture écrite, accessible uniquement dans votre espace sécurisé.',
        },
        {
          label: 'Narration audio privée',
          detail: 'Une version audio de votre lecture, réservée à votre Sanctuaire.',
        },
        {
          label: `Accès Sanctuaire ${LUMIRA_EARLY_OFFER.accessDurationMonths} mois`,
          detail:
            'Offre early : paiement unique, accès au Sanctuaire pendant 3 mois — sans abonnement mensuel ni renouvellement automatique.',
        },
      ],
    },
  ],
  ctaLabel: `Commencer mon voyage — ${LUMIRA_EARLY_OFFER.priceEuros}€`,
  guaranteeText: 'Satisfait ou remboursé sous 14 jours',
  deliveryLabel: `Livraison sous ${LUMIRA_EARLY_OFFER.deliveryWindowHours.min} à ${LUMIRA_EARLY_OFFER.deliveryWindowHours.max}h après scellement du dossier`,
  accessLabel: `Accès ${LUMIRA_EARLY_OFFER.accessDurationMonths} mois · Offre early`,
};

// =============================================================================
// Legacy compat — kept so old imports don't break at build time
// =============================================================================

/** @deprecated Use SUBSCRIPTION instead */
export interface Product {
  id: 'initie';
  name: string;
  description: string;
  price: number;
  features: string[];
  duration: string;
  access: string[];
  badge?: string;
  popular?: boolean;
  ctaLabel: string;
}

/** @deprecated Use SUBSCRIPTION instead */
export const PRODUCTS: Product[] = [
  {
    id: 'initie',
    name: SUBSCRIPTION.name,
    description: SUBSCRIPTION.description,
    price: SUBSCRIPTION.price,
    features: SUBSCRIPTION.features,
    duration: SUBSCRIPTION.accessLabel,
    access: ['pdf', 'audio', 'sanctuaire'],
    badge: 'Early · 3 mois',
    popular: true,
    ctaLabel: SUBSCRIPTION.ctaLabel,
  },
];

/** @deprecated Use SUBSCRIPTION instead */
export function getProductById(): Product {
  return PRODUCTS[0];
}
