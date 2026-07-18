'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import sanctuaireApi from '../lib/sanctuaireApi';
import { useSanctuaireAuth } from './SanctuaireAuthContext';

// =============================================================================
// TYPES
// =============================================================================

interface LifetimeAccessData {
  /** Whether the buyer has the permanent paid-order entitlement. */
  hasLifetimeAccess: boolean;
  /** Number of paid-order entitlements. */
  orderCount: number;
  capabilities: string[];
  highestLevel: number;
}

interface SanctuaireContextType {
  /** Primary client authorization: a paid order grants permanent access. */
  hasLifetimeAccess: boolean;
  /** @deprecated Alias for dormant legacy components; not a subscription check. */
  isSubscribed: boolean;
  orderCount: number;
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
  hasLifetimeAccess: false,
  isSubscribed: false,
  orderCount: 0,
  capabilities: [],
  highestLevel: 0,
  hasCapability: () => false,
  hasAnyCapability: () => false,
  hasAllCapabilities: () => false,
  isLoading: true,
  error: null,
  refetch: async () => {},
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
  const userId = user?.id ?? null;
  const [data, setData] = useState<LifetimeAccessData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasCachedEntitlementsRef = useRef(false);

  const fetchEntitlements = useCallback(async () => {
    if (!isAuthenticated || !userId) {
      hasCachedEntitlementsRef.current = false;
      setData(null);
      setIsLoading(false);
      return;
    }

    try {
      // Silent refresh when entitlements are already cached — avoids tearing
      // down Sanctuaire pages (e.g. onboarding modal) during refetchData.
      if (!hasCachedEntitlementsRef.current) {
        setIsLoading(true);
      }
      setError(null);

      const response = await sanctuaireApi.get('/users/entitlements');

      const entitlement = response.data;
      const hasLifetimeAccess = (entitlement.orderCount ?? 0) > 0;
      hasCachedEntitlementsRef.current = true;
      setData({
        hasLifetimeAccess,
        orderCount: entitlement.orderCount ?? 0,
        capabilities: entitlement.capabilities ?? [],
        highestLevel: entitlement.highestLevel ?? 0,
      });
    } catch (err) {
      console.error('Failed to fetch entitlements:', err);
      setError("Erreur lors du chargement des droits d'accès");
      hasCachedEntitlementsRef.current = true;
      setData({
        hasLifetimeAccess: false,
        orderCount: 0,
        capabilities: [],
        highestLevel: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, isAuthenticated]);

  // Fetch entitlements when auth state changes
  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements]);

  // A paid permanent entitlement unlocks the client surface. Legacy
  // capability checks are retained only for dormant V1 consumers.
  const hasCapability = useCallback(
    (capability: string): boolean => {
      if (!data) return false;
      if (data.hasLifetimeAccess) return true;
      return data.capabilities.includes(capability);
    },
    [data],
  );

  const hasAnyCapability = useCallback(
    (capabilities: string[]): boolean => {
      if (!data) return false;
      if (data.hasLifetimeAccess) return true;
      return capabilities.some((cap) => data.capabilities.includes(cap));
    },
    [data],
  );

  const hasAllCapabilities = useCallback(
    (capabilities: string[]): boolean => {
      if (!data) return false;
      if (data.hasLifetimeAccess) return true;
      return capabilities.every((cap) => data.capabilities.includes(cap));
    },
    [data],
  );

  const value = useMemo<SanctuaireContextType>(
    () => ({
      hasLifetimeAccess: data?.hasLifetimeAccess ?? false,
      // Deprecated compatibility alias, deliberately derived from a paid
      // order rather than the legacy Subscription model.
      isSubscribed: data?.hasLifetimeAccess ?? false,
      orderCount: data?.orderCount ?? 0,
      capabilities: data?.capabilities ?? [],
      highestLevel: data?.highestLevel ?? 0,
      hasCapability,
      hasAnyCapability,
      hasAllCapabilities,
      isLoading,
      error,
      refetch: fetchEntitlements,
    }),
    [
      data,
      hasCapability,
      hasAnyCapability,
      hasAllCapabilities,
      isLoading,
      error,
      fetchEntitlements,
    ],
  );

  return <SanctuaireContext.Provider value={value}>{children}</SanctuaireContext.Provider>;
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
 * Quick check for the permanent paid-order entitlement.
 */
export const useLifetimeAccess = (): { hasLifetimeAccess: boolean; isLoading: boolean } => {
  const { hasLifetimeAccess, isLoading } = useSanctuaire();
  return { hasLifetimeAccess, isLoading };
};

/** @deprecated Legacy alias; use useLifetimeAccess. */
export const useIsSubscribed = (): { isSubscribed: boolean; isLoading: boolean } => {
  const { hasLifetimeAccess, isLoading } = useSanctuaire();
  return { isSubscribed: hasLifetimeAccess, isLoading };
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
