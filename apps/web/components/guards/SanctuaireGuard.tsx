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

function hasPostCheckoutBypass(searchParams: URLSearchParams): boolean {
  const email = searchParams.get('email');
  const token = searchParams.get('token');
  const onboarding = searchParams.get('onboarding') === '1';
  const subscriptionSuccess = searchParams.get('subscription') === 'success';

  // Fresh checkout / soft fallback: email + first-visit token or onboarding flag
  if (email && (onboarding || (token && token.startsWith('fv_')))) {
    return true;
  }
  // Legacy email+token combo
  if (email && token) {
    return true;
  }
  // Real Stripe subscription Checkout return
  if (subscriptionSuccess) {
    return true;
  }
  return false;
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

  const hasAutoLoginParams = hasPostCheckoutBypass(searchParams);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !hasAutoLoginParams) {
      setShouldRedirect(true);
      const redirectTarget =
        typeof window !== 'undefined' && window.location.pathname.startsWith('/sanctuaire')
          ? `${window.location.pathname}${window.location.search}`
          : '/sanctuaire';
      const email = searchParams.get('email');
      const params = new URLSearchParams({ redirect: redirectTarget });
      if (email) params.set('email', email);
      const loginUrl = `/sanctuaire/login?${params.toString()}`;
      const timer = setTimeout(() => {
        router.push(loginUrl);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, router, hasAutoLoginParams, searchParams]);

  // Fast path: authenticated or post-checkout / auto-login params — never show Accès Protégé
  if (isAuthenticated || hasAutoLoginParams) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      fallback || (
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
            <p className="text-stellar-500 text-sm tracking-widest uppercase">
              Vérification de l&apos;accès...
            </p>
          </div>
        </div>
      )
    );
  }

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
            <h2 className="text-xl font-playfair italic text-stellar-200 mb-2">Accès Protégé</h2>
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

  return <>{children}</>;
};

export default SanctuaireGuard;
