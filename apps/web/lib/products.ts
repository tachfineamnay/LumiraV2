// =============================================================================
// V2 — Single subscription product (29€/month)
// =============================================================================

export interface SubscriptionProduct {
    name: string;
    price: number;         // euros / mois
    description: string;
    features: string[];
    ctaLabel: string;
}

/**
 * The one and only subscription offer.
 */
export const SUBSCRIPTION: SubscriptionProduct = {
    name: 'Cercle des Initiés',
    price: 29,
    description: 'Accès complet à l\'univers Oracle Lumira',
    features: [
        'Lecture PDF personnalisée par un expert',
        'Chat illimité avec Lumira',
        'Journal des Rêves & interprétation',
        'Guidance spirituelle 30 jours',
        'Mandala HD personnalisé',
        'Rituels sacrés & méditations',
    ],
    ctaLabel: 'Commencer mon voyage — 29€/mois',
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
        duration: 'Mensuel',
        access: ['pdf', 'audio', 'mandala', 'rituels', 'chat', 'dreams'],
        badge: '✨ TOUT INCLUS',
        popular: true,
        ctaLabel: SUBSCRIPTION.ctaLabel,
    },
];

/** @deprecated Use SUBSCRIPTION instead */
export function getProductById(): Product {
    return PRODUCTS[0];
}
