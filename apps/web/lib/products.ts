import { Star, Sparkles, Crown, Music, Eye, Heart, Infinity, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface Product {
    id: 'initie' | 'mystique' | 'profond' | 'integrale';
    name: string;
    description: string;
    price: number; // en euros (0 = gratuit)
    features: string[];
    duration: string;
    access: string[];
    badge?: string;
    secondaryBadge?: string;
    comingSoon?: boolean;
    popular?: boolean;
    free?: boolean;
    ctaLabel: string;
    icons: [LucideIcon, LucideIcon];
}

export const PRODUCTS: Product[] = [
    {
        id: 'initie',
        name: 'Initié',
        description: 'Accès Master - Offre Unique',
        price: 9,
        features: [
            'Accès complet au Sanctuaire',
            'Lectures audio & PDF',
            'Mandala HD personnalisé',
            'Rituels sacrés',
            'Analyses karmiques & missions',
        ],
        duration: 'Accès à vie',
        access: ['pdf', 'audio', 'mandala', 'rituels'],
        badge: '✨ OFFRE UNIQUE',
        secondaryBadge: 'Tout inclus',
        popular: true,
        free: false,
        ctaLabel: "Commencer l'Initiation",
        icons: [Crown, Sparkles],
    },
    {
        id: 'mystique',
        name: 'Mystique',
        description: 'Expérience audio (Obsolète)',
        price: 47,
        features: [
            'Lecture audio complète',
            'Guidance approfondie',
            'Support prioritaire',
        ],
        duration: 'Indisponible',
        access: ['pdf', 'audio'],
        badge: 'Indisponible',
        comingSoon: true,
        popular: false,
        ctaLabel: 'Indisponible',
        icons: [Music, Crown],
    },
    {
        id: 'profond',
        name: 'Profond',
        description: 'Expérience complète (Obsolète)',
        price: 67,
        features: [
            'Mandala personnalisé HD',
            'Support visuel pour méditation',
            "Guide d'activation",
        ],
        duration: 'Indisponible',
        access: ['pdf', 'audio', 'mandala'],
        badge: 'Indisponible',
        comingSoon: true,
        ctaLabel: 'Indisponible',
        icons: [Eye, Heart],
    },
    {
        id: 'integrale',
        name: 'Intégrale',
        description: 'Immersion totale (Obsolète)',
        price: 97,
        features: [
            'Rituels personnalisés',
            'Suivi personnalisé 30 jours',
            'Accès aux cycles lunaires',
        ],
        duration: 'Indisponible',
        access: ['pdf', 'audio', 'mandala', 'rituels'],
        badge: 'Indisponible',
        comingSoon: true,
        ctaLabel: 'Indisponible',
        icons: [Infinity, Zap],
    },
];

export function getProductById(id: Product['id']): Product | undefined {
    return PRODUCTS.find((p) => p.id === id);
}
