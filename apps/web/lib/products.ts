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
        description: 'Découvrez votre lecture spirituelle personnalisée',
        price: 0,
        features: [
            'Lecture spirituelle PDF personnalisée',
            'Analyse complète de votre thème',
            'Guidance intuitive',
        ],
        duration: 'Accès illimité',
        access: ['pdf'],
        badge: '✨ Valable pour les 100 premiers clients',
        free: true,
        ctaLabel: 'Obtenir gratuitement',
        icons: [Star, Sparkles],
    },
    {
        id: 'mystique',
        name: 'Mystique',
        description: 'Approfondissez votre connaissance spirituelle',
        price: 47,
        features: [
            'Tout le contenu Initié',
            'Lecture audio complète (voix sacrée)',
            'Guidance approfondie',
            'Support prioritaire',
        ],
        duration: 'Accès à vie',
        access: ['pdf', 'audio'],
        badge: 'LE PLUS POPULAIRE',
        secondaryBadge: 'Meilleur rapport qualité/prix',
        popular: true,
        ctaLabel: 'Passer le Deuxième Portail',
        icons: [Crown, Music],
    },
    {
        id: 'profond',
        name: 'Profond',
        description: 'Expérience complète avec votre Mandala sacré',
        price: 67,
        features: [
            'Tout le contenu Mystique',
            'Mandala personnalisé HD',
            'Support visuel pour méditation',
            "Guide d'activation du Mandala",
        ],
        duration: 'Accès à vie',
        access: ['pdf', 'audio', 'mandala'],
        ctaLabel: "Pénétrer l'Ordre Profond",
        icons: [Eye, Heart],
    },
    {
        id: 'integrale',
        name: 'Intégral',
        description: 'Transformation complète avec rituels personnalisés',
        price: 97,
        features: [
            'Tout le contenu Profond',
            'Rituels personnalisés audio/vidéo',
            "Protocoles d'activation",
            'Suivi personnalisé 30 jours',
            'Accès aux cycles lunaires',
        ],
        duration: 'Accès à vie',
        access: ['pdf', 'audio', 'mandala', 'rituels'],
        badge: 'Bientôt disponible',
        comingSoon: true,
        ctaLabel: 'Bientôt disponible',
        icons: [Infinity, Zap],
    },
];

export function getProductById(id: Product['id']): Product | undefined {
    return PRODUCTS.find((p) => p.id === id);
}
