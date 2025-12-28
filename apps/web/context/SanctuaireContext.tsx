'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

// =============================================================================
// TYPES
// =============================================================================

interface LevelMetadata {
    level: 1 | 2 | 3 | 4;
    name: 'Initié' | 'Mystique' | 'Profond' | 'Intégral';
    productId: 'initie' | 'mystique' | 'profond' | 'integrale';
    price: number;
    color: string;
    icon: string;
}

interface EntitlementsData {
    capabilities: string[];
    products: string[];
    highestLevel: number;
    levelMetadata: LevelMetadata;
    orderCount: number;
}

interface SanctuaireContextType {
    capabilities: string[];
    highestLevel: number;
    levelMetadata: LevelMetadata | null;
    orderCount: number;
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

const DEFAULT_LEVEL_METADATA: LevelMetadata = {
    level: 1,
    name: 'Initié',
    productId: 'initie',
    price: 0,
    color: '#3B82F6',
    icon: '✨',
};

const defaultContext: SanctuaireContextType = {
    capabilities: [],
    highestLevel: 0,
    levelMetadata: null,
    orderCount: 0,
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
    const { token, user } = useAuth();
    const [data, setData] = useState<EntitlementsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEntitlements = useCallback(async () => {
        if (!token || !user) {
            setData(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const response = await axios.get<EntitlementsData>(
                `${process.env.NEXT_PUBLIC_API_URL}/users/entitlements`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            setData(response.data);
        } catch (err) {
            console.error('Failed to fetch entitlements:', err);
            setError('Erreur lors du chargement des droits d\'accès');
            // Set default data for graceful degradation
            setData({
                capabilities: [],
                products: [],
                highestLevel: 0,
                levelMetadata: DEFAULT_LEVEL_METADATA,
                orderCount: 0,
            });
        } finally {
            setIsLoading(false);
        }
    }, [token, user]);

    // Fetch entitlements when auth state changes
    useEffect(() => {
        fetchEntitlements();
    }, [fetchEntitlements]);

    // Capability check functions
    const hasCapability = useCallback((capability: string): boolean => {
        if (!data) return false;
        return data.capabilities.includes(capability);
    }, [data]);

    const hasAnyCapability = useCallback((capabilities: string[]): boolean => {
        if (!data) return false;
        return capabilities.some(cap => data.capabilities.includes(cap));
    }, [data]);

    const hasAllCapabilities = useCallback((capabilities: string[]): boolean => {
        if (!data) return false;
        return capabilities.every(cap => data.capabilities.includes(cap));
    }, [data]);

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo<SanctuaireContextType>(() => ({
        capabilities: data?.capabilities ?? [],
        highestLevel: data?.highestLevel ?? 0,
        levelMetadata: data?.levelMetadata ?? null,
        orderCount: data?.orderCount ?? 0,
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
 * Quick check if user has a specific capability
 */
export const useCapabilityCheck = (capability: string): boolean => {
    const { hasCapability, isLoading } = useSanctuaire();
    return !isLoading && hasCapability(capability);
};

/**
 * Get user's current level information
 */
export const useCurrentLevel = () => {
    const { highestLevel, levelMetadata, isLoading } = useSanctuaire();
    return { level: highestLevel, metadata: levelMetadata, isLoading };
};
