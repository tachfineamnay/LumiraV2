'use client';

import React from 'react';
import { useSanctuaire } from '../../context/SanctuaireContext';
import { LockedCard } from '../ui/LockedCard';

// =============================================================================
// TYPES
// =============================================================================

interface CapabilityGuardProps {
    /** Single capability or array of capabilities required */
    requires: string | string[];
    /** If true, user needs ALL capabilities. If false.defaults to ANY */
    requireAll?: boolean;
    /** Custom fallback when capability is not met */
    fallback?: React.ReactNode;
    /** Auto-generate LockedCard fallback with these settings */
    lockedConfig?: {
        title: string;
        message: string;
        requiredLevel: 'Mystique' | 'Profond' | 'Intégral';
        productId: 'mystique' | 'profond' | 'integrale';
    };
    /** Content to show when capability is met */
    children: React.ReactNode;
    /** Show loading state while checking */
    showLoading?: boolean;
}

// =============================================================================
// CAPABILITY MAPPING TO LEVEL
// =============================================================================

const CAPABILITY_LEVEL_MAP: Record<string, { level: 'Mystique' | 'Profond' | 'Intégral'; productId: 'mystique' | 'profond' | 'integrale' }> = {
    // Level 2: Mystique
    'readings.audio': { level: 'Mystique', productId: 'mystique' },
    'audio.full': { level: 'Mystique', productId: 'mystique' },
    'rituals.access': { level: 'Mystique', productId: 'mystique' },
    'sanctuaire.sphere.rituals': { level: 'Mystique', productId: 'mystique' },
    'sanctuaire.sphere.mandala': { level: 'Mystique', productId: 'mystique' },
    'analysis.soul_profile': { level: 'Mystique', productId: 'mystique' },
    'analysis.blockages': { level: 'Mystique', productId: 'mystique' },
    'followup.7days': { level: 'Mystique', productId: 'mystique' },

    // Level 3: Profond
    'mandala.hd': { level: 'Profond', productId: 'profond' },
    'rituals.personalized': { level: 'Profond', productId: 'profond' },
    'sanctuaire.sphere.synthesis': { level: 'Profond', productId: 'profond' },
    'mentorat.access': { level: 'Profond', productId: 'profond' },
    'analysis.karmic_line': { level: 'Profond', productId: 'profond' },
    'analysis.life_cycles': { level: 'Profond', productId: 'profond' },
    'upload.documents': { level: 'Profond', productId: 'profond' },

    // Level 4: Intégral
    'sanctuaire.sphere.guidance': { level: 'Intégral', productId: 'integrale' },
    'mentorat.personalized': { level: 'Intégral', productId: 'integrale' },
    'analysis.mission': { level: 'Intégral', productId: 'integrale' },
    'followup.30days': { level: 'Intégral', productId: 'integrale' },
    'mandala.personalized': { level: 'Intégral', productId: 'integrale' },
    'audio.premium': { level: 'Intégral', productId: 'integrale' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export const CapabilityGuard: React.FC<CapabilityGuardProps> = ({
    requires,
    requireAll = false,
    fallback,
    lockedConfig,
    children,
    showLoading = false,
}) => {
    const { hasCapability, hasAnyCapability, hasAllCapabilities, isLoading } = useSanctuaire();

    // Show loading state if requested
    if (isLoading && showLoading) {
        return (
            <div className="animate-pulse bg-white/5 rounded-2xl h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-cosmic-gold/30 border-t-cosmic-gold rounded-full animate-spin" />
            </div>
        );
    }

    // Skip check while loading (show nothing or children based on use case)
    if (isLoading) {
        return null;
    }

    // Check capabilities
    const requiredCaps = Array.isArray(requires) ? requires : [requires];
    const hasAccess = requireAll
        ? hasAllCapabilities(requiredCaps)
        : requiredCaps.length === 1
            ? hasCapability(requiredCaps[0])
            : hasAnyCapability(requiredCaps);

    // If access granted, render children
    if (hasAccess) {
        return <>{children}</>;
    }

    // Render custom fallback if provided
    if (fallback) {
        return <>{fallback}</>;
    }

    // Auto-generate LockedCard if config provided
    if (lockedConfig) {
        const isIntegral = lockedConfig.productId === 'integrale';
        return (
            <LockedCard
                level={lockedConfig.requiredLevel}
                title={lockedConfig.title}
                message={lockedConfig.message}
                action={{
                    label: isIntegral ? 'Bientôt disponible' : `Débloquer niveau ${lockedConfig.requiredLevel}`,
                    productId: lockedConfig.productId,
                    comingSoon: isIntegral,
                }}
            />
        );
    }

    // Auto-detect level from first required capability
    const firstCap = requiredCaps[0];
    const levelInfo = CAPABILITY_LEVEL_MAP[firstCap];

    if (levelInfo) {
        const isIntegral = levelInfo.productId === 'integrale';
        return (
            <LockedCard
                level={levelInfo.level}
                title="Contenu verrouillé"
                message={`Cette fonctionnalité nécessite le niveau ${levelInfo.level}.`}
                action={{
                    label: isIntegral ? 'Bientôt disponible' : `Débloquer niveau ${levelInfo.level}`,
                    productId: levelInfo.productId,
                    comingSoon: isIntegral,
                }}
            />
        );
    }

    // Default: render nothing
    return null;
};

export default CapabilityGuard;
