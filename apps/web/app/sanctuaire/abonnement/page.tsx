'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  Crown,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import sanctuaireApi from '../../../lib/sanctuaireApi';

// =============================================================================
// TYPES
// =============================================================================

interface Subscription {
  id: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
  isLifetimeAccess: boolean;
  cancellable: boolean;
}

interface SubscriptionStatus {
  hasSubscription: boolean;
  subscription: Subscription | null;
}

// =============================================================================
// STATUS HELPERS
// =============================================================================

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ACTIVE: { label: 'Actif', color: 'text-emerald-400', icon: CheckCircle2 },
  PAST_DUE: { label: 'Paiement en retard', color: 'text-amber-400', icon: AlertCircle },
  CANCELED: { label: 'Annulé', color: 'text-rose-400', icon: XCircle },
  EXPIRED: { label: 'Expiré', color: 'text-slate-400', icon: XCircle },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AbonnementPage() {
  const [data, setData] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await sanctuaireApi.get('/subscriptions/status');
      setData(res.data);
    } catch {
      setError("Impossible de charger les informations d'abonnement.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // -------------------------------------------------------------------------
  // LOADING
  // -------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-horizon-400 animate-spin" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // NO SUBSCRIPTION
  // -------------------------------------------------------------------------

  if (!data?.hasSubscription || !data.subscription) {
    return (
      <div className="max-w-lg mx-auto px-3 sm:px-6 py-8 sm:py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-horizon-400/10 border border-horizon-400/20 flex items-center justify-center mx-auto mb-6">
          <CreditCard className="w-8 h-8 text-horizon-400" />
        </div>
        <h1 className="text-2xl font-playfair italic text-white mb-3">Aucun accès actif</h1>
        <p className="text-stellar-500 text-sm mb-8 max-w-xs mx-auto">
          Accédez à l&apos;ensemble des sagesses de Lumira avec un paiement unique.
        </p>
        <Link
          href="/commande"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-horizon-400 to-amber-500 text-abyss-900 font-semibold hover:from-horizon-300 hover:to-amber-400 transition-all"
        >
          <Crown className="w-5 h-5" />
          Obtenir l&apos;accès à vie
        </Link>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // SUBSCRIPTION VIEW
  // -------------------------------------------------------------------------

  const sub = data.subscription;
  const statusInfo = STATUS_MAP[sub.status] || STATUS_MAP.EXPIRED;
  const StatusIcon = statusInfo.icon;
  const isActive = sub.status === 'ACTIVE';
  const isCancelPending = sub.cancelAtPeriodEnd;

  return (
    <div className="max-w-lg mx-auto px-3 sm:px-6 py-4 sm:py-8">
      {/* Back */}
      <Link
        href="/sanctuaire"
        className="inline-flex items-center gap-2 text-sm text-stellar-500 hover:text-stellar-300 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Sanctuaire
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-playfair italic text-white flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-horizon-400" />
          Mon accès
        </h1>
      </div>

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-abyss-600/50 border border-white/5 mb-6"
      >
        {/* Plan row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-horizon-400/30 to-amber-500/20 border border-horizon-400/40 flex items-center justify-center">
              <Crown className="w-5 h-5 text-horizon-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Accès Sanctuaire</h2>
              <p className="text-xs text-stellar-500">Paiement unique · accès à vie</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 ${statusInfo.color}`}>
            <StatusIcon className="w-4 h-4" />
            <span className="text-xs font-medium">{statusInfo.label}</span>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-1.5 text-stellar-500 text-xs mb-1">
              <Calendar className="w-3.5 h-3.5" />
              Accès activé
            </div>
            <p className="text-sm text-stellar-300">{formatDate(sub.currentPeriodStart)}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-1.5 text-stellar-500 text-xs mb-1">
              <Calendar className="w-3.5 h-3.5" />
              {sub.isLifetimeAccess
                ? 'Durée d’accès'
                : isCancelPending
                  ? "Fin de l'accès"
                  : 'Renouvellement'}
            </div>
            <p className="text-sm text-stellar-300">
              {sub.isLifetimeAccess ? 'À vie' : formatDate(sub.currentPeriodEnd)}
            </p>
          </div>
        </div>

        {sub.cancellable && isCancelPending && isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 rounded-xl bg-amber-500/10 border border-amber-400/20 mb-6"
          >
            <p className="text-sm text-amber-300">
              Votre abonnement prendra fin le <strong>{formatDate(sub.currentPeriodEnd)}</strong>.
              Vous conservez l&apos;accès jusqu&apos;à cette date.
            </p>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm mb-6"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
