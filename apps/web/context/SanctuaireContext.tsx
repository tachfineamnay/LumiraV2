'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useSanctuaireAuth } from './SanctuaireAuthContext';

// =============================================================================
// TYPES
// =============================================================================

interface SubscriptionData {
    /** Whether the user has an active subscription (29€/month) */
    isSubscribed: boolean;
    /** Subscription status from backend: ACTIVE | PAST_DUE | CANCELED | EXPIRED | null */
    subscriptionStatus: string | null;
    /** Number of completed orders (legacy reads) */
    orderCount: number;
    // Legacy fields kept for backward compat — always populated for subscribers
    capabilities: string[];
    highestLevel: number;
}

interface SanctuaireContextType {
    /** V2 primary check: does user have an active subscription? */
    isSubscribed: boolean;
    subscriptionStatus: string | null;
    orderCount: number;
    // Legacy compat — hasCapability returns true for everything if subscribed
    capabilities: string[];
    highestLevel: number;
    hasCapability: (capability: string) => boolean;
    hasAnyCapability: (capabilities: string[]) => boolean;
    hasAllCapabilities: (capabilities: string[]) => boolean;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const defaultContext: SanctuaireContextType = {
    isSubscribed: false,
    subscriptionStatus: null,
    orderCount: 0,
    capabilities: [],
    highestLevel: 0,
    hasCapability: () => false,
    hasAnyCapability: () => false,
    hasAllCapabilities: () => false,
    isLoading: true,
    error: null,
    refetch: async () => { },
};

// =============================================================================
// CONTEXT
// =============================================================================

const SanctuaireContext = createContext<SanctuaireContextType>(defaultContext);

// =============================================================================
// PROVIDER
// =============================================================================

export const SanctuaireProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isAuthenticated } = useSanctuaireAuth();
    const [data, setData] = useState<SubscriptionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEntitlements = useCallback(async () => {
        const token = localStorage.getItem('sanctuaire_token');
        if (!token || !user) {
            setData(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Try V2 subscription status first
            let isSubscribed = false;
            let subscriptionStatus: string | null = null;
            try {
                const subResponse = await axios.get(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/subscriptions/status`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                subscriptionStatus = subResponse.data?.status ?? null;
                isSubscribed = subscriptionStatus === 'ACTIVE';
            } catch {
                // Endpoint may not exist yet — fall back to legacy
            }

            // Also fetch legacy entitlements for backward compat
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/api/users/entitlements`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const legacy = response.data;
            // If subscribed, treat as full access (highestLevel = 4, all capabilities)
            setData({
                isSubscribed,
                subscriptionStatus,
                orderCount: legacy.orderCount ?? 0,
                capabilities: legacy.capabilities ?? [],
                highestLevel: isSubscribed ? 4 : (legacy.highestLevel ?? 0),
            });
        } catch (err) {
            console.error('Failed to fetch entitlements:', err);
            setError('Erreur lors du chargement des droits d\'accès');
            setData({
                isSubscribed: false,
                subscriptionStatus: null,
                orderCount: 0,
                capabilities: [],
                highestLevel: 0,
            });
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    // Fetch entitlements when auth state changes
    useEffect(() => {
        fetchEntitlements();
    }, [fetchEntitlements]);

    // V2: if subscribed, all capabilities are granted
    const hasCapability = useCallback((capability: string): boolean => {
        if (!data) return false;
        if (data.isSubscribed) return true;
        return data.capabilities.includes(capability);
    }, [data]);

    const hasAnyCapability = useCallback((capabilities: string[]): boolean => {
        if (!data) return false;
        if (data.isSubscribed) return true;
        return capabilities.some(cap => data.capabilities.includes(cap));
    }, [data]);

    const hasAllCapabilities = useCallback((capabilities: string[]): boolean => {
        if (!data) return false;
        if (data.isSubscribed) return true;
        return capabilities.every(cap => data.capabilities.includes(cap));
    }, [data]);

    const value = useMemo<SanctuaireContextType>(() => ({
        isSubscribed: data?.isSubscribed ?? false,
        subscriptionStatus: data?.subscriptionStatus ?? null,
        orderCount: data?.orderCount ?? 0,
        capabilities: data?.capabilities ?? [],
        highestLevel: data?.highestLevel ?? 0,
        hasCapability,
        hasAnyCapability,
        hasAllCapabilities,
        isLoading,
        error,
        refetch: fetchEntitlements,
    }), [data, hasCapability, hasAnyCapability, hasAllCapabilities, isLoading, error, fetchEntitlements]);

    return (
        <SanctuaireContext.Provider value={value}>
            {children}
        </SanctuaireContext.Provider>
    );
};

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Get the full Sanctuaire context
 */
export const useSanctuaire = (): SanctuaireContextType => {
    const context = useContext(SanctuaireContext);
    if (context === undefined) {
        throw new Error('useSanctuaire must be used within a SanctuaireProvider');
    }
    return context;
};

/**
 * V2: Quick check if user has an active subscription
 */
export const useIsSubscribed = (): { isSubscribed: boolean; isLoading: boolean } => {
    const { isSubscribed, isLoading } = useSanctuaire();
    return { isSubscribed, isLoading };
};

/**
 * @deprecated Legacy — use useIsSubscribed instead.
 * Quick check if user has a specific capability
 */
export const useCapabilityCheck = (capability: string): boolean => {
    const { hasCapability, isLoading } = useSanctuaire();
    return !isLoading && hasCapability(capability);
};

/**
 * @deprecated Legacy — use useIsSubscribed instead.
 * Get user's current level information
 */
export const useCurrentLevel = () => {
    const { highestLevel, isLoading } = useSanctuaire();
    return { level: highestLevel, metadata: null, isLoading };
};
