'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface ExpertUser {
    id: string;
    email: string;
    name: string;
    role: 'EXPERT' | 'ADMIN';
    isActive: boolean;
}

interface ExpertAuthContextType {
    expert: ExpertUser | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    verifyToken: () => Promise<boolean>;
}

const ExpertAuthContext = createContext<ExpertAuthContextType | undefined>(undefined);

const TOKEN_KEY = 'expert_token';
const REFRESH_TOKEN_KEY = 'expert_refresh_token';
const USER_KEY = 'expert_user';
const TOKEN_EXPIRY_HOURS = 8;

export const ExpertAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [expert, setExpert] = useState<ExpertUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Check if on login page
    const isLoginPage = pathname === '/admin/login';

    // Clear auth data
    const clearAuth = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setExpert(null);
    }, []);

    // Logout function
    const logout = useCallback(() => {
        clearAuth();
        router.push('/admin/login');
    }, [clearAuth, router]);

    // Verify token with API
    const verifyToken = useCallback(async (): Promise<boolean> => {
        const savedToken = localStorage.getItem(TOKEN_KEY);
        if (!savedToken) return false;

        try {
            const res = await fetch(`${apiUrl}/api/expert/verify`, {
                headers: { Authorization: `Bearer ${savedToken}` },
            });

            if (res.ok) {
                const data = await res.json();
                if (data.valid && data.expert) {
                    setExpert(data.expert);
                    setToken(savedToken);
                    return true;
                }
            }

            // Token invalid - clear and redirect
            clearAuth();
            return false;
        } catch {
            clearAuth();
            return false;
        }
    }, [apiUrl, clearAuth]);

    // Login function
    const login = useCallback(async (email: string, password: string) => {
        const res = await fetch(`${apiUrl}/api/expert/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Email ou mot de passe incorrect');
        }

        // Store tokens
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        if (data.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
        }
        localStorage.setItem(USER_KEY, JSON.stringify(data.expert));

        setToken(data.accessToken);
        setExpert(data.expert);

        router.push('/admin/board');
    }, [apiUrl, router]);

    // Initialize auth on mount
    useEffect(() => {
        const initAuth = async () => {
            const savedToken = localStorage.getItem(TOKEN_KEY);
            const savedUser = localStorage.getItem(USER_KEY);

            if (savedToken && savedUser) {
                try {
                    const user = JSON.parse(savedUser);
                    setToken(savedToken);
                    setExpert(user);

                    // Verify token in background
                    const isValid = await verifyToken();
                    if (!isValid && !isLoginPage) {
                        router.push('/admin/login');
                    }
                } catch {
                    clearAuth();
                    if (!isLoginPage) {
                        router.push('/admin/login');
                    }
                }
            } else if (!isLoginPage) {
                router.push('/admin/login');
            }

            setIsLoading(false);
        };

        initAuth();
    }, [verifyToken, clearAuth, router, isLoginPage]);

    // Token expiry check (every 5 minutes)
    useEffect(() => {
        if (!token) return;

        const checkInterval = setInterval(async () => {
            const isValid = await verifyToken();
            if (!isValid) {
                logout();
            }
        }, 5 * 60 * 1000); // 5 minutes

        return () => clearInterval(checkInterval);
    }, [token, verifyToken, logout]);

    const value: ExpertAuthContextType = {
        expert,
        token,
        isLoading,
        isAuthenticated: !!token && !!expert,
        login,
        logout,
        verifyToken,
    };

    return (
        <ExpertAuthContext.Provider value={value}>
            {children}
        </ExpertAuthContext.Provider>
    );
};

export const useExpertAuth = () => {
    const context = useContext(ExpertAuthContext);
    if (context === undefined) {
        throw new Error('useExpertAuth must be used within an ExpertAuthProvider');
    }
    return context;
};

// Hook for protected routes
export const useRequireExpertAuth = () => {
    const { isAuthenticated, isLoading } = useExpertAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/admin/login');
        }
    }, [isAuthenticated, isLoading, router]);

    return { isAuthenticated, isLoading };
};
