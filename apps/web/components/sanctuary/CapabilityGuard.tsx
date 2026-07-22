'use client';

import React from 'react';
import { useSanctuaire } from '../../context/SanctuaireContext';
import Link from 'next/link';
import { Lock, Crown, Sparkles, FileText } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface SubscriptionGuardProps {
  /** Content to show when the user has an active subscription */
  children: React.ReactNode;
  /** Custom fallback UI when not subscribed */
  fallback?: React.ReactNode;
  /** Show loading skeleton while checking */
  showLoading?: boolean;
}

// =============================================================================
// V2 SUBSCRIPTION GUARD — replaces the old CapabilityGuard
// =============================================================================

export const CapabilityGuard: React.FC<
  SubscriptionGuardProps & {
    /** @deprecated — ignored in V2, kept for compat */
    requires?: string | string[];
    requireAll?: boolean;
    lockedConfig?: Record<string, unknown>;
  }
> = ({ children, fallback, showLoading = false }) => {
  const { isSubscribed, isLoading } = useSanctuaire();

  if (isLoading && showLoading) {
    return (
      <div className="animate-pulse bg-brume-800/25 rounded-2xl h-48 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ivoire-400/20 border-t-ivoire-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoading) return null;

  if (isSubscribed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  // Default: upgrade prompt
  return <SubscriptionPrompt />;
};

/**
 * Standalone subscription check guard — preferred V2 API.
 */
export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({
  children,
  fallback,
  showLoading = false,
}) => {
  const { isSubscribed, isLoading } = useSanctuaire();

  if (isLoading && showLoading) {
    return (
      <div className="animate-pulse bg-brume-800/25 rounded-2xl h-48 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ivoire-400/20 border-t-ivoire-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoading) return null;

  if (isSubscribed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return <SubscriptionPrompt />;
};

// =============================================================================
// SUBSCRIPTION PROMPT — shown when user is not subscribed
// =============================================================================

function SubscriptionPrompt() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ivoire-400/12 bg-gradient-to-br from-brume-700/25 via-lavande-500/8 to-brume-800/20 p-6 backdrop-blur-sm">
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-ivoire-400/6 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-lavande-400/5 rounded-full blur-3xl" />

      <div className="relative z-10 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-ivoire-400/12 to-ivoire-500/10 border border-ivoire-400/18">
          <Lock className="w-7 h-7 text-ivoire-400" />
        </div>

        <h3 className="text-xl font-playfair italic text-ivoire-200">
          Contenu réservé aux membres
        </h3>

        <p className="text-sm text-ivoire-100/60 max-w-sm mx-auto leading-relaxed">
          Rejoignez le <span className="text-ivoire-400 font-semibold">Cercle des Initiés</span>{' '}
          pour débloquer l'ensemble de votre parcours spirituel.
        </p>

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {[
            { icon: FileText, label: 'PDF privé' },
            { icon: Sparkles, label: 'Audio privé' },
            { icon: Crown, label: 'Sanctuaire 3 mois' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brume-800/25 border border-ivoire-500/8 text-xs text-ivoire-100/70"
            >
              <Icon className="w-3.5 h-3.5 text-ivoire-400/70" />
              {label}
            </div>
          ))}
        </div>

        <Link
          href="/commande"
          className="inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-ivoire-400 to-horizon-400 text-abyss-900 font-semibold hover:from-ivoire-300 hover:to-horizon-300 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(240,232,208,0.15)]"
        >
          <Crown className="w-4 h-4" />
          Obtenir l&apos;accès early — 17€
        </Link>

        <p className="text-[10px] text-ivoire-100/30 pt-2">
          Paiement unique · 3 mois · aucun renouvellement
        </p>
      </div>
    </div>
  );
}

export default CapabilityGuard;
