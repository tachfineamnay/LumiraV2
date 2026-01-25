'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Lock } from 'lucide-react';
import { useSanctuaireAuth } from '../../context/SanctuaireAuthContext';

interface SanctuaireGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Client-side route guard for Sanctuaire protected pages.
 * Redirects unauthenticated users to the login page.
 */
export const SanctuaireGuard: React.FC<SanctuaireGuardProps> = ({ children, fallback }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isAuthenticated, isLoading } = useSanctuaireAuth();
    const [shouldRedirect, setShouldRedirect] = useState(false);

    const hasAutoLoginParams = searchParams.get('email') && searchParams.get('token');

    useEffect(() => {
        if (!isLoading && !isAuthenticated && !hasAutoLoginParams) {
            setShouldRedirect(true);
            // Small delay to show feedback before redirect
            const timer = setTimeout(() => {
                router.push('/sanctuaire/login');
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, isAuthenticated, router, hasAutoLoginParams]);

    // Authenticated or Auto-login allowed to proceed to children
    if (isAuthenticated || hasAutoLoginParams) {
        return <>{children}</>;
    }

    // Loading state
    if (isLoading) {
        return fallback || (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
                    <p className="text-stellar-500 text-sm tracking-widest uppercase">
                        Vérification de l&apos;accès...
                    </p>
                </div>
            </div>
        );
    }

    // Redirecting state
    if (shouldRedirect) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-6 text-center px-4"
                >
                    <div className="w-16 h-16 rounded-full bg-horizon-400/10 flex items-center justify-center border border-horizon-400/20">
                        <Lock className="w-8 h-8 text-horizon-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-playfair italic text-stellar-200 mb-2">
                            Accès Protégé
                        </h2>
                        <p className="text-stellar-500 text-sm">
                            Veuillez vous connecter pour accéder au Sanctuaire
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-horizon-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs uppercase tracking-wider">Redirection...</span>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Authenticated or Auto-login allowed to proceed to children
    return <>{children}</>;
};

export default SanctuaireGuard;
