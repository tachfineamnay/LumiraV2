/**
 * Oracle Lumira - Entitlements System V2
 *
 * V2: Single 29€/month subscription — all capabilities granted to subscribers.
 * The capability list is kept for fine-grained feature-flag checks (e.g. chat_unlimited).
 */

// =============================================================================
// TYPES
// =============================================================================

export interface EntitlementsResponse {
    capabilities: string[];
    products: string[];
    highestLevel: number;  // Always 4 for subscribers (backward compat)
    orderCount: number;
}

// =============================================================================
// SUBSCRIPTION CAPABILITIES  (all features — every subscriber gets these)
// =============================================================================

export const SUBSCRIPTION_CAPABILITIES: readonly string[] = [
    'content.basic',
    'content.advanced',
    'content.expert',
    'content.full',
    'meditations.access',
    'meditations.advanced',
    'rituals.access',
    'rituals.personalized',
    'readings.pdf',
    'readings.audio',
    'readings.full',
    'audio.basic',
    'audio.full',
    'audio.premium',
    'mandala.basic',
    'mandala.hd',
    'mandala.personalized',
    'analysis.soul_profile',
    'analysis.blockages',
    'analysis.karmic_line',
    'analysis.life_cycles',
    'analysis.mission',
    'mentorat.access',
    'mentorat.personalized',
    'upload.photos',
    'upload.documents',
    'events.access',
    'events.priority',
    'community.access',
    'community.priority',
    'community.elite',
    'followup.7days',
    'followup.30days',
    'chat_unlimited',
    'sanctuaire.sphere.profile',
    'sanctuaire.sphere.readings',
    'sanctuaire.sphere.rituals',
    'sanctuaire.sphere.mandala',
    'sanctuaire.sphere.synthesis',
    'sanctuaire.sphere.guidance',
] as const;

// =============================================================================
// LEGACY LEVEL-BASED CAPABILITIES  (kept for backward compat — level 4 = all)
// =============================================================================

/** @deprecated V2: use SUBSCRIPTION_CAPABILITIES instead */
export const LEVEL_CAPABILITIES: Record<number, readonly string[]> = {
    0: [],
    1: SUBSCRIPTION_CAPABILITIES,
    2: SUBSCRIPTION_CAPABILITIES,
    3: SUBSCRIPTION_CAPABILITIES,
    4: SUBSCRIPTION_CAPABILITIES,
};

// Reverse mapping: every capability requires minimum level 1 in V2
export const CAPABILITY_MIN_LEVEL: Record<string, number> = {};
for (const cap of SUBSCRIPTION_CAPABILITIES) {
    CAPABILITY_MIN_LEVEL[cap as string] = 1;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Returns all subscription capabilities for any level ≥ 1 (V2: subscription-only). */
export function getCapabilitiesForLevel(level: number): string[] {
    if (level < 1) return [];
    return [...SUBSCRIPTION_CAPABILITIES];
}

/** Aggregate capabilities from multiple levels — V2 always returns full set when any level ≥ 1. */
export function aggregateCapabilities(levels: number[]): string[] {
    if (levels.length === 0 || Math.max(...levels) < 1) return [];
    return [...SUBSCRIPTION_CAPABILITIES];
}

/** Returns the highest level number — capped at 4 for V2 compatibility. */
export function getHighestLevel(levels: number[]): number {
    if (levels.length === 0) return 0;
    return Math.min(Math.max(...levels), 4);
}

/** Check if a given level has a capability — V2: every subscribed level has all caps. */
export function levelHasCapability(level: number, capability: string): boolean {
    if (level < 1) return false;
    return (SUBSCRIPTION_CAPABILITIES as readonly string[]).includes(capability);
}

/** Minimum required level for a capability — V2: always 1 (subscribed). */
export function getMinLevelForCapability(_capability: string): number {
    return 1;
}

// =============================================================================
// SUBSCRIPTION GATE HELPER
// =============================================================================

/**
 * V2: Check if a Stripe subscription is currently active.
 * This is the single access gate for the new single-offer model —
 * replaces all tier-based hasCapability() checks.
 */
export const isSubscriptionActive = (status?: string): boolean =>
    status === 'ACTIVE';



