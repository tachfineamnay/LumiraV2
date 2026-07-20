'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AxiosError } from 'axios';
import sanctuaireApi from '../lib/sanctuaireApi';

// =============================================================================
// TYPES
// =============================================================================

interface SanctuaireUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  level: number;
}

interface UserProfile {
  birthDate: string | null;
  birthTime: string | null;
  birthPlace: string | null;
  specificQuestion: string | null;
  objective: string | null;
  openReading?: boolean | null;
  facePhotoUrl: string | null;
  palmPhotoUrl: string | null;
  highs: string | null;
  lows: string | null;
  strongSide: string | null;
  weakSide: string | null;
  strongZone: string | null;
  weakZone: string | null;
  deliveryStyle: string | null;
  pace: number | null;
  ailments: string | null;
  fears: string | null;
  rituals: string | null;
  profileCompleted: boolean;
  submittedAt: string | null;
}

interface CompletedOrder {
  id: string;
  orderNumber: string;
  level: number;
  status: string;
  deliveredAt: string | null;
  createdAt: string;
  intakeRequired?: boolean;
  intakeStatus?: 'DRAFT' | 'SEALED' | null;
  intakeSealedAt?: string | null;
}

export interface OnboardingProgress {
  orderId?: string;
  currentStep: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  data: Record<string, unknown>;
  revision?: number;
  updatedAt?: string | null;
  completedAt: string | null;
  canEdit?: boolean;
}

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

type AuthResult =
  | { success: true; isFirstVisit?: boolean; message?: string }
  | { success: false; error: string; isRateLimited?: boolean; retryAfter?: number };

interface SanctuaireAuthContextType {
  // Authentication
  isAuthenticated: boolean;
  isLoading: boolean;
  user: SanctuaireUser | null;
  authenticateWithEmail: (email: string) => Promise<AuthResult>;
  consumeMagicLink: (token: string) => Promise<AuthResult>;
  /**
   * Re-probe the session cookie and re-initialize auth state.
   * Use this for post-checkout auto-login when the cookie was already set
   * by payment-success — avoids sending any email OTP.
   * Returns true if the session is now authenticated.
   */
  retrySessionProbe: () => Promise<boolean>;
  logout: () => void;

  // Entitlements
  capabilities: string[];
  products: string[];
  highestLevel: number;
  levelMetadata: LevelMetadata | null;
  hasCapability: (capability: string) => boolean;
  hasProduct: (productId: string) => boolean;

  // User Data
  profile: UserProfile | null;
  orders: CompletedOrder[];
  onboardingProgress: OnboardingProgress | null;
  stats: { totalOrders: number; completedOrders: number } | null;

  // Rate Limiting
  cooldownRemaining: number;
  isCoolingDown: boolean;

  // Actions
  refetchData: () => Promise<void>;

  // Error
  error: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TOKEN_KEY = 'sanctuaire_token';
const EMAIL_SESSION_KEY = 'sanctuaire_email';
const FIRST_VISIT_KEY = 'sanctuaire_first_visit';
const COOLDOWN_KEY = 'sanctuaire_auth_cooldown';
const COOLDOWN_DURATION = 60; // seconds

async function persistSanctuaireSession(token: string) {
  const response = await fetch('/api/auth/sanctuaire/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    throw new Error('Failed to persist session cookie');
  }
}

async function clearSanctuaireSession() {
  await fetch('/api/auth/sanctuaire/session', { method: 'DELETE' });
}

// =============================================================================
// DEFAULT CONTEXT
// =============================================================================

const defaultContext: SanctuaireAuthContextType = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  authenticateWithEmail: async () => ({ success: false, error: 'Not initialized' }),
  consumeMagicLink: async () => ({ success: false, error: 'Not initialized' }),
  retrySessionProbe: async () => false,
  logout: () => {},
  capabilities: [],
  products: [],
  highestLevel: 0,
  levelMetadata: null,
  hasCapability: () => false,
  hasProduct: () => false,
  profile: null,
  orders: [],
  onboardingProgress: null,
  stats: null,
  cooldownRemaining: 0,
  isCoolingDown: false,
  refetchData: async () => {},
  error: null,
};

// =============================================================================
// CONTEXT
// =============================================================================

const SanctuaireAuthContext = createContext<SanctuaireAuthContextType>(defaultContext);

// =============================================================================
// PROVIDER
// =============================================================================

export const SanctuaireAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<SanctuaireUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Entitlements state
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [highestLevel, setHighestLevel] = useState(0);
  const [levelMetadata, setLevelMetadata] = useState<LevelMetadata | null>(null);

  // User data state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress | null>(null);
  const [stats, setStats] = useState<{ totalOrders: number; completedOrders: number } | null>(null);

  // Rate limiting state
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Logout
  const handleLogout = useCallback(async () => {
    await clearSanctuaireSession();
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EMAIL_SESSION_KEY);
    sessionStorage.removeItem(FIRST_VISIT_KEY);
    // 🧹 Clear onboarding draft on logout to prevent data leakage between users
    localStorage.removeItem('holistic_wizard_draft');
    localStorage.removeItem('holistic_wizard_email');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setCapabilities([]);
    setProducts([]);
    setHighestLevel(0);
    setLevelMetadata(null);
    setProfile(null);
    setOrders([]);
    setOnboardingProgress(null);
    setStats(null);
    setError(null);
  }, []);

  // Initialize from existing token
  const initializeFromToken = useCallback(async () => {
    try {
      const [profileRes, entitlementsRes, onboardingRes] = await Promise.all([
        sanctuaireApi.get('/users/profile'),
        sanctuaireApi.get('/users/entitlements'),
        // A missing draft is normal for a first visit. Profile and entitlement
        // requests remain authoritative for session validity.
        sanctuaireApi.get('/users/onboarding').catch(() => null),
      ]);

      let ordersData: CompletedOrder[] = [];
      try {
        const ordersRes = await sanctuaireApi.get('/users/orders/completed');
        ordersData = ordersRes.data as CompletedOrder[];
      } catch (ordersErr: unknown) {
        const status = (ordersErr as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          await handleLogout();
          return;
        }
      }

      // Set user from profile
      const profileData = profileRes.data;
      setUser({
        id: profileData.id,
        email: profileData.email,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
        level: entitlementsRes.data.highestLevel,
      });
      setProfile(profileData.profile);
      setStats(profileData.stats);
      setOnboardingProgress((onboardingRes?.data as OnboardingProgress | null | undefined) ?? null);

      // Set entitlements
      const entData = entitlementsRes.data as EntitlementsData;
      setCapabilities(entData.capabilities);
      setProducts(entData.products);
      setHighestLevel(entData.highestLevel);
      setLevelMetadata(entData.levelMetadata);

      // Set orders
      setOrders(ordersData);

      setIsAuthenticated(true);
      setError(null);
    } catch (err: unknown) {
      console.error('Failed to initialize from token:', err);
      const status = (err as { response?: { status?: number } })?.response?.status;
      // Only logout on explicit 401 (expired/invalid token), not on network errors
      if (status === 401) {
        handleLogout();
      } else {
        setIsLoading(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    handleLogout,
    setUser,
    setProfile,
    setStats,
    setCapabilities,
    setProducts,
    setHighestLevel,
    setLevelMetadata,
    setOrders,
    setOnboardingProgress,
    setIsAuthenticated,
    setError,
    setIsLoading,
  ]);

  // Check for existing session on mount
  useEffect(() => {
    const bootstrapAuth = async () => {
      const legacyToken = localStorage.getItem(TOKEN_KEY);
      if (legacyToken) {
        localStorage.removeItem(TOKEN_KEY);
        try {
          await persistSanctuaireSession(legacyToken);
        } catch {
          setIsLoading(false);
          return;
        }
        setToken('session');
        await initializeFromToken();
        return;
      }

      // Probe session cookie without forcing unauthenticated 401 chatter
      try {
        const probe = await fetch('/api/auth/sanctuaire/session', { method: 'GET' });
        const data = await probe.json().catch(() => ({ authenticated: false }));
        if (!data?.authenticated) {
          setIsLoading(false);
          return;
        }
      } catch {
        setIsLoading(false);
        return;
      }

      setToken('session');
      await initializeFromToken();
    };

    bootstrapAuth().catch(() => setIsLoading(false));

    // Check for cooldown
    const cooldownEnd = sessionStorage.getItem(COOLDOWN_KEY);
    if (cooldownEnd) {
      const remaining = Math.ceil((parseInt(cooldownEnd) - Date.now()) / 1000);
      if (remaining > 0) {
        setCooldownRemaining(remaining);
      } else {
        sessionStorage.removeItem(COOLDOWN_KEY);
      }
    }
  }, [initializeFromToken, setIsLoading, setToken]);

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            sessionStorage.removeItem(COOLDOWN_KEY);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownRemaining]);

  // Request a magic link. This endpoint never authenticates the browser.
  const authenticateWithEmail = useCallback(
    async (email: string): Promise<AuthResult> => {
      if (cooldownRemaining > 0) {
        return {
          success: false,
          error: `Trop de tentatives. Patientez ${cooldownRemaining}s avant de réessayer.`,
          isRateLimited: true,
          retryAfter: cooldownRemaining,
        };
      }

      try {
        const response = await sanctuaireApi.post('/auth/sanctuaire-v2', {
          email: email.toLowerCase().trim(),
        });
        return {
          success: true,
          message:
            response.data?.message ||
            'Si un accès existe pour cette adresse, un lien de connexion vient d’être envoyé.',
        };
      } catch (err) {
        const axiosError = err as AxiosError<{ message?: string; error?: string }>;

        // Handle rate limiting (429)
        if (axiosError.response?.status === 429) {
          const cooldownEnd = Date.now() + COOLDOWN_DURATION * 1000;
          sessionStorage.setItem(COOLDOWN_KEY, cooldownEnd.toString());
          setCooldownRemaining(COOLDOWN_DURATION);

          return {
            success: false,
            error: `Trop de tentatives. Patientez ${COOLDOWN_DURATION}s avant de réessayer.`,
            isRateLimited: true,
            retryAfter: COOLDOWN_DURATION,
          };
        }

        // Handle 404
        if (axiosError.response?.status === 404) {
          return { success: false, error: 'Erreur technique. Contactez le support.' };
        }

        // Generic error
        return { success: false, error: 'Erreur de connexion. Veuillez réessayer.' };
      }
    },
    [cooldownRemaining],
  );

  const consumeMagicLink = useCallback(
    async (magicToken: string): Promise<AuthResult> => {
      try {
        const response = await sanctuaireApi.post('/auth/sanctuaire/consume-link', {
          token: magicToken,
        });
        const { token: newToken } = response.data;
        if (!newToken) {
          return { success: false, error: "Impossible d'établir la session sécurisée." };
        }

        await persistSanctuaireSession(newToken);
        setToken('session');
        await initializeFromToken();
        return {
          success: true,
          isFirstVisit: sessionStorage.getItem(FIRST_VISIT_KEY) === 'true',
        };
      } catch (err) {
        const axiosError = err as AxiosError<{ message?: string; error?: string }>;
        if (axiosError.response?.status === 401) {
          return {
            success: false,
            error: 'Ce lien de connexion est invalide, expiré ou a déjà été utilisé.',
          };
        }
        return { success: false, error: 'Erreur de connexion. Veuillez demander un nouveau lien.' };
      }
    },
    [initializeFromToken],
  );

  // Re-probe session cookie (no email OTP) — for post-checkout auto-login
  const retrySessionProbe = useCallback(async (): Promise<boolean> => {
    try {
      const probe = await fetch('/api/auth/sanctuaire/session', { method: 'GET' });
      const data = await probe.json().catch(() => ({ authenticated: false }));
      if (!data?.authenticated) {
        return false;
      }
      setToken('session');
      await initializeFromToken();
      return true;
    } catch {
      return false;
    }
  }, [initializeFromToken, setToken]);

  // Refetch all data
  const refetchData = useCallback(async () => {
    if (token) {
      await initializeFromToken();
    }
  }, [token, initializeFromToken]);

  // Capability checks
  const hasCapability = useCallback(
    (capability: string): boolean => {
      return capabilities.includes(capability);
    },
    [capabilities],
  );

  const hasProduct = useCallback(
    (productId: string): boolean => {
      return products.includes(productId);
    },
    [products],
  );

  // Memoized context value
  const value = useMemo<SanctuaireAuthContextType>(
    () => ({
      isAuthenticated,
      isLoading,
      user,
      authenticateWithEmail,
      consumeMagicLink,
      retrySessionProbe,
      logout: handleLogout,
      capabilities,
      products,
      highestLevel,
      levelMetadata,
      hasCapability,
      hasProduct,
      profile,
      orders,
      onboardingProgress,
      stats,
      cooldownRemaining,
      isCoolingDown: cooldownRemaining > 0,
      refetchData,
      error,
    }),
    [
      isAuthenticated,
      isLoading,
      user,
      authenticateWithEmail,
      consumeMagicLink,
      retrySessionProbe,
      handleLogout,
      capabilities,
      products,
      highestLevel,
      levelMetadata,
      hasCapability,
      hasProduct,
      profile,
      orders,
      onboardingProgress,
      stats,
      cooldownRemaining,
      refetchData,
      error,
    ],
  );

  return <SanctuaireAuthContext.Provider value={value}>{children}</SanctuaireAuthContext.Provider>;
};

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Get the full Sanctuaire auth context
 */
export const useSanctuaireAuth = (): SanctuaireAuthContextType => {
  const context = useContext(SanctuaireAuthContext);
  if (context === undefined) {
    throw new Error('useSanctuaireAuth must be used within a SanctuaireAuthProvider');
  }
  return context;
};

/**
 * Check if user is authenticated
 */
export const useIsAuthenticated = (): boolean => {
  const { isAuthenticated, isLoading } = useSanctuaireAuth();
  return !isLoading && isAuthenticated;
};

/**
 * Get current user
 */
export const useSanctuaireUser = () => {
  const { user, isLoading } = useSanctuaireAuth();
  return { user, isLoading };
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Detect first visit token from URL
 */
export const isFirstVisitToken = (token: string | null): boolean => {
  return token?.startsWith('fv_') ?? false;
};

/**
 * Set first visit flag in session storage
 */
export const setFirstVisitFlag = (value: boolean): void => {
  if (value) {
    sessionStorage.setItem(FIRST_VISIT_KEY, 'true');
  } else {
    sessionStorage.removeItem(FIRST_VISIT_KEY);
  }
};

/**
 * Clear first visit flag
 */
export const clearFirstVisitFlag = (): void => {
  sessionStorage.removeItem(FIRST_VISIT_KEY);
};
