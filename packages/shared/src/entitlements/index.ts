/**
 * Oracle Lumira - Entitlements System
 * 
 * Capability-based access control with hierarchical product levels.
 * Each level inherits ALL capabilities from lower levels.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface LevelMetadata {
    level: 1 | 2 | 3 | 4;
    name: 'Initié' | 'Mystique' | 'Profond' | 'Intégral';
    productId: 'initie' | 'mystique' | 'profond' | 'integrale';
    price: number;
    color: string;
    icon: string;
}

export interface EntitlementsResponse {
    capabilities: string[];
    products: string[];
    highestLevel: number;
    levelMetadata: LevelMetadata;
    orderCount: number;
}

// =============================================================================
// LEVEL METADATA
// =============================================================================

export const LEVEL_METADATA: Record<number, LevelMetadata> = {
    0: { level: 1, name: 'Initié', productId: 'initie', price: 0, color: '#3B82F6', icon: '✨' },
    1: { level: 1, name: 'Initié', productId: 'initie', price: 0, color: '#3B82F6', icon: '✨' },
    2: { level: 2, name: 'Mystique', productId: 'mystique', price: 47, color: '#7C3AED', icon: '🔮' },
    3: { level: 3, name: 'Profond', productId: 'profond', price: 67, color: '#F59E0B', icon: '🌟' },
    4: { level: 4, name: 'Intégral', productId: 'integrale', price: 97, color: '#10B981', icon: '👑' },
};

export const PRODUCT_TO_LEVEL: Record<string, number> = {
    'initie': 1,
    'mystique': 2,
    'profond': 3,
    'integrale': 4,
};

export const LEVEL_TO_PRODUCT: Record<number, string> = {
    1: 'initie',
    2: 'mystique',
    3: 'profond',
    4: 'integrale',
};

// =============================================================================
// CAPABILITIES BY LEVEL (Cumulative - each includes all previous)
// =============================================================================

/** Level 1: Initié - Découverte, PDF uniquement */
const LEVEL_1_CAPABILITIES = [
    'content.basic',
    'meditations.access',
    'readings.pdf',
    'audio.basic',
    'mandala.basic',
    'community.access',
    'upload.photos',
    'sanctuaire.sphere.profile',
    'sanctuaire.sphere.readings',
    // Inclusion des capacités supérieures pour l'offre unique Initié Master
    'content.advanced',
    'meditations.advanced',
    'rituals.access',
    'readings.audio',
    'audio.full',
    'analysis.soul_profile',
    'analysis.blockages',
    'events.access',
    'followup.7days',
    'sanctuaire.sphere.rituals',
    'sanctuaire.sphere.mandala',
    'content.expert',
    'rituals.personalized',
    'mandala.hd',
    'mentorat.access',
    'analysis.karmic_line',
    'analysis.life_cycles',
    'community.priority',
    'events.priority',
    'upload.documents',
    'sanctuaire.sphere.synthesis',
    'content.full',
    'readings.full',
    'audio.premium',
    'mandala.personalized',
    'mentorat.personalized',
    'analysis.mission',
    'followup.30days',
    'community.elite',
    'sanctuaire.sphere.guidance',
] as const;

/** Level 2: Mystique - PDF + Audio */
const LEVEL_2_CAPABILITIES = [
    ...LEVEL_1_CAPABILITIES,
    'content.advanced',
    'meditations.advanced',
    'rituals.access',
    'readings.audio',
    'audio.full',
    'analysis.soul_profile',
    'analysis.blockages',
    'events.access',
    'followup.7days',
    'sanctuaire.sphere.rituals',
    'sanctuaire.sphere.mandala',
] as const;

/** Level 3: Profond - PDF + Audio + Mandala HD */
const LEVEL_3_CAPABILITIES = [
    ...LEVEL_2_CAPABILITIES,
    'content.expert',
    'rituals.personalized',
    'mandala.hd',
    'mentorat.access',
    'analysis.karmic_line',
    'analysis.life_cycles',
    'community.priority',
    'events.priority',
    'upload.documents',
    'sanctuaire.sphere.synthesis',
] as const;

/** Level 4: Intégral - Tout + Rituels + Suivi 30j */
const LEVEL_4_CAPABILITIES = [
    ...LEVEL_3_CAPABILITIES,
    'content.full',
    'readings.full',
    'audio.premium',
    'mandala.personalized',
    'mentorat.personalized',
    'analysis.mission',
    'followup.30days',
    'community.elite',
    'sanctuaire.sphere.guidance',
] as const;

export const LEVEL_CAPABILITIES: Record<number, readonly string[]> = {
    0: [],
    1: LEVEL_1_CAPABILITIES,
    2: LEVEL_2_CAPABILITIES,
    3: LEVEL_3_CAPABILITIES,
    4: LEVEL_4_CAPABILITIES,
};

// =============================================================================
// CAPABILITY TO MINIMUM LEVEL MAPPING
// =============================================================================

export const CAPABILITY_MIN_LEVEL: Record<string, number> = {};

// Build reverse mapping
for (let level = 1; level <= 4; level++) {
    for (const cap of LEVEL_CAPABILITIES[level]) {
        if (!(cap in CAPABILITY_MIN_LEVEL)) {
            CAPABILITY_MIN_LEVEL[cap] = level;
        }
    }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get capabilities for a specific level (includes all inherited)
 */
export function getCapabilitiesForLevel(level: number): string[] {
    const effectiveLevel = Math.max(0, Math.min(4, level));
    return [...(LEVEL_CAPABILITIES[effectiveLevel] || [])];
}

/**
 * Aggregate capabilities from multiple product levels
 */
export function aggregateCapabilities(levels: number[]): string[] {
    if (levels.length === 0) return [];
    const maxLevel = Math.max(...levels);
    return getCapabilitiesForLevel(maxLevel);
}

/**
 * Get the highest level from a list of levels
 */
export function getHighestLevel(levels: number[]): number {
    if (levels.length === 0) return 0;
    return Math.max(...levels);
}

/**
 * Get metadata for a level
 */
export function getLevelMetadata(level: number): LevelMetadata {
    const effectiveLevel = Math.max(0, Math.min(4, level));
    return LEVEL_METADATA[effectiveLevel] || LEVEL_METADATA[1];
}

/**
 * Get level name from level number
 */
export function getLevelNameFromLevel(level: number): string {
    return LEVEL_TO_PRODUCT[level] || 'initie';
}

/**
 * Get level number from product ID
 */
export function getLevelFromProductId(productId: string): number {
    return PRODUCT_TO_LEVEL[productId.toLowerCase()] || 1;
}

/**
 * Check if a level has a specific capability
 */
export function levelHasCapability(level: number, capability: string): boolean {
    const caps = LEVEL_CAPABILITIES[level] || [];
    return caps.includes(capability);
}

/**
 * Get minimum level required for a capability
 */
export function getMinLevelForCapability(capability: string): number {
    return CAPABILITY_MIN_LEVEL[capability] || 5; // 5 = never accessible
}

/**
 * Get upgrade suggestions based on current level
 */
export function getUpgradeSuggestions(currentLevel: number): LevelMetadata[] {
    const suggestions: LevelMetadata[] = [];

    if (currentLevel < 2) {
        suggestions.push(LEVEL_METADATA[2]); // Mystique
        suggestions.push(LEVEL_METADATA[3]); // Profond
    } else if (currentLevel < 3) {
        suggestions.push(LEVEL_METADATA[3]); // Profond only
    } else if (currentLevel < 4) {
        suggestions.push(LEVEL_METADATA[4]); // Intégral (coming soon)
    }

    return suggestions;
}

/**
 * Check if Intégral is available for purchase
 */
export function isIntegralAvailable(): boolean {
    return false; // Coming soon
}
