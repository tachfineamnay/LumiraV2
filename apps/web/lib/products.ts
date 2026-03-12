// =============================================================================
// V2 — Single subscription product (29€/month)
// =============================================================================

export interface FeatureGroup {
    title: string;
    items: { label: string; detail: string }[];
}

export interface SubscriptionProduct {
    name: string;
    price: number;         // euros / mois
    description: string;
    features: string[];
    featureGroups: FeatureGroup[];
    ctaLabel: string;
    guaranteeText: string;
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
    featureGroups: [
        {
            title: 'Votre Lecture Personnalisée',
            items: [
                { label: 'Analyse complète en PDF', detail: '8 domaines de vie analysés par notre IA, puis révisés par un expert humain.' },
                { label: 'Narration audio immersive', detail: 'Écoutez votre lecture en voix méditative, générée pour chaque insight.' },
                { label: 'Mandala HD unique', detail: 'Une œuvre visuelle sacrée créée à partir de votre empreinte vibratoire.' },
            ],
        },
        {
            title: 'Votre Guidance au Quotidien',
            items: [
                { label: 'Chat illimité avec Lumira', detail: 'Posez vos questions à l\'Oracle à tout moment — elle se souvient de votre parcours.' },
                { label: 'Parcours spirituel 30 jours', detail: 'Un chemin personnalisé avec rituels, méditations et exercices quotidiens.' },
                { label: 'Journal des Rêves', detail: 'Notez vos rêves et recevez une interprétation symbolique instantanée.' },
            ],
        },
    ],
    ctaLabel: 'Commencer mon voyage — 29€/mois',
    guaranteeText: 'Satisfait ou remboursé sous 14 jours',
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
