'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios, { AxiosError } from 'axios';

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
    facePhotoUrl: string | null;
    palmPhotoUrl: string | null;
    profileCompleted: boolean;
}

interface CompletedOrder {
    id: string;
    orderNumber: string;
    level: number;
    status: string;
    deliveredAt: string | null;
    createdAt: string;
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
    | { success: true; isFirstVisit: boolean }
    | { success: false; error: string; isRateLimited?: boolean; retryAfter?: number };

interface SanctuaireAuthContextType {
    // Authentication
    isAuthenticated: boolean;
    isLoading: boolean;
    user: SanctuaireUser | null;
    authenticateWithEmail: (email: string) => Promise<AuthResult>;
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// =============================================================================
// DEFAULT CONTEXT
// =============================================================================

const defaultContext: SanctuaireAuthContextType = {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    authenticateWithEmail: async () => ({ success: false, error: 'Not initialized' }),
    logout: () => { },
    capabilities: [],
    products: [],
    highestLevel: 0,
    levelMetadata: null,
    hasCapability: () => false,
    hasProduct: () => false,
    profile: null,
    orders: [],
    stats: null,
    cooldownRemaining: 0,
    isCoolingDown: false,
    refetchData: async () => { },
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
    const [stats, setStats] = useState<{ totalOrders: number; completedOrders: number } | null>(null);

    // Rate limiting state
    const [cooldownRemaining, setCooldownRemaining] = useState(0);

    // Error state
    const [error, setError] = useState<string | null>(null);

    // Check for existing token on mount
    useEffect(() => {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        if (savedToken) {
            setToken(savedToken);
            initializeFromToken(savedToken);
        } else {
            setIsLoading(false);
        }

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
    }, []);

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

    // Initialize from existing token
    const initializeFromToken = async (authToken: string) => {
        try {
            // Fetch user data in parallel
            const [profileRes, entitlementsRes, ordersRes] = await Promise.all([
                axios.get(`${API_URL}/api/users/profile`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                }),
                axios.get(`${API_URL}/api/users/entitlements`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                }),
                axios.get(`${API_URL}/api/users/orders/completed`, {
                    headers: { Authorization: `Bearer ${authToken}` },
                }),
            ]);

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

            // Set entitlements
            const entData = entitlementsRes.data as EntitlementsData;
            setCapabilities(entData.capabilities);
            setProducts(entData.products);
            setHighestLevel(entData.highestLevel);
            setLevelMetadata(entData.levelMetadata);

            // Set orders
            setOrders(ordersRes.data);

            setIsAuthenticated(true);
            setError(null);
        } catch (err) {
            console.error('Failed to initialize from token:', err);
            // Token might be expired or invalid
            handleLogout();
        } finally {
            setIsLoading(false);
        }
    };

    // Authenticate with email
    const authenticateWithEmail = useCallback(async (email: string): Promise<AuthResult> => {
        if (cooldownRemaining > 0) {
            return {
                success: false,
                error: `Trop de tentatives. Patientez ${cooldownRemaining}s avant de réessayer.`,
                isRateLimited: true,
                retryAfter: cooldownRemaining,
            };
        }

        try {
            const response = await axios.post(`${API_URL}/api/auth/sanctuaire-v2`, {
                email: email.toLowerCase().trim(),
            });

            const { token: newToken, user: userData } = response.data;

            // Store token
            localStorage.setItem(TOKEN_KEY, newToken);
            sessionStorage.setItem(EMAIL_SESSION_KEY, email);
            setToken(newToken);

            // Set user data
            setUser(userData);
            setIsAuthenticated(true);

            // Check for first visit
            const isFirstVisit = sessionStorage.getItem(FIRST_VISIT_KEY) === 'true';

            // Initialize full data
            await initializeFromToken(newToken);

            return { success: true, isFirstVisit };
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

            // Handle auth error (401)
            if (axiosError.response?.status === 401) {
                const message = axiosError.response.data?.message ||
                    axiosError.response.data?.error ||
                    'Aucune commande trouvée pour cet email';
                return { success: false, error: message };
            }

            // Handle 404
            if (axiosError.response?.status === 404) {
                return { success: false, error: 'Erreur technique. Contactez le support.' };
            }

            // Generic error
            return { success: false, error: 'Erreur de connexion. Veuillez réessayer.' };
        }
    }, [cooldownRemaining]);

    // Logout
    const handleLogout = useCallback(() => {
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
        setStats(null);
        setError(null);
    }, []);

    // Refetch all data
    const refetchData = useCallback(async () => {
        if (token) {
            await initializeFromToken(token);
        }
    }, [token]);

    // Capability checks
    const hasCapability = useCallback((capability: string): boolean => {
        return capabilities.includes(capability);
    }, [capabilities]);

    const hasProduct = useCallback((productId: string): boolean => {
        return products.includes(productId);
    }, [products]);

    // Memoized context value
    const value = useMemo<SanctuaireAuthContextType>(() => ({
        isAuthenticated,
        isLoading,
        user,
        authenticateWithEmail,
        logout: handleLogout,
        capabilities,
        products,
        highestLevel,
        levelMetadata,
        hasCapability,
        hasProduct,
        profile,
        orders,
        stats,
        cooldownRemaining,
        isCoolingDown: cooldownRemaining > 0,
        refetchData,
        error,
    }), [
        isAuthenticated,
        isLoading,
        user,
        authenticateWithEmail,
        handleLogout,
        capabilities,
        products,
        highestLevel,
        levelMetadata,
        hasCapability,
        hasProduct,
        profile,
        orders,
        stats,
        cooldownRemaining,
        refetchData,
        error,
    ]);

    return (
        <SanctuaireAuthContext.Provider value={value}>
            {children}
        </SanctuaireAuthContext.Provider>
    );
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
