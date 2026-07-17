'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { MandalaNav } from '../../components/sanctuary/MandalaNav';
import { CosmicNotification } from '../../components/sanctuary/CosmicNotification';
import { ExpertValidationBanner } from '../../components/sanctuary/ExpertValidationBanner';
import {
  CoreOnboardingWizard,
  type CoreOnboardingData,
} from '../../components/onboarding/CoreOnboardingWizard';
import sanctuaireApi from '../../lib/sanctuaireApi';
import { useSanctuaire } from '../../context/SanctuaireContext';
import {
  clearFirstVisitFlag,
  setFirstVisitFlag,
  useSanctuaireAuth,
} from '../../context/SanctuaireAuthContext';

async function saveCoreOnboarding(data: CoreOnboardingData) {
  await sanctuaireApi.patch('/users/profile', {
    birthDate: data.birthDate,
    birthTime: data.birthTime || null,
    birthPlace: data.birthPlace,
    facePhotoUrl: data.facePhoto,
    palmPhotoUrl: data.palmPhoto,
    profileCompleted: true,
    consent: { accepted: data.gdprConsent, version: '2026-07-16' },
  });
}

function AutoLoginHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    refetchData,
    profile,
    user,
  } = useSanctuaireAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const onboardingRequested = searchParams.get('onboarding') === '1';

  useEffect(() => {
    if (authLoading || !onboardingRequested) return;
    if (!isAuthenticated) {
      router.replace('/sanctuaire/login');
      return;
    }
    if (!profile?.profileCompleted) {
      setFirstVisitFlag(true);
      setShowOnboarding(true);
      return;
    }
    router.replace('/sanctuaire');
  }, [authLoading, onboardingRequested, isAuthenticated, profile?.profileCompleted, router]);

  if (showOnboarding && !profile?.profileCompleted) {
    return (
      <CoreOnboardingWizard
        userEmail={user?.email}
        onClose={() => {
          setShowOnboarding(false);
          clearFirstVisitFlag();
          toast.info('Votre progression est sauvegardée ✨', {
            description: 'Vous pouvez reprendre le recueil essentiel depuis le Sanctuaire.',
            duration: 5000,
          });
          router.replace('/sanctuaire');
        }}
        onComplete={async (data) => {
          await saveCoreOnboarding(data);
          setShowOnboarding(false);
          clearFirstVisitFlag();
          await refetchData();
          toast.success('Éléments essentiels enregistrés', {
            description: 'La préparation de votre expérience peut commencer.',
          });
          router.replace('/sanctuaire');
        }}
      />
    );
  }

  return null;
}

function DashboardContent() {
  const { isLoading, orderCount } = useSanctuaire();
  const { profile, refetchData, user } = useSanctuaireAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  const isOnboardingComplete = profile?.profileCompleted === true;

  useEffect(() => {
    if (isOnboardingComplete) {
      setHasDraft(false);
      return;
    }

    let active = true;
    sanctuaireApi
      .get('/users/onboarding')
      .then((response) => {
        if (!active) return;
        const progress = response.data;
        const hasData = progress?.data && Object.values(progress.data).some(Boolean);
        setHasDraft(Boolean(progress && (progress.currentStep > 0 || hasData)));
      })
      .catch(() => {
        if (active) setHasDraft(false);
      });

    return () => {
      active = false;
    };
  }, [isOnboardingComplete, showWizard, user?.email]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-horizon-400" />
          <p className="text-sm uppercase tracking-widest text-stellar-500">
            Chargement de votre sanctuaire...
          </p>
        </div>
      </div>
    );
  }

  const hasOrders = orderCount > 0;

  const handleWizardComplete = async (data: CoreOnboardingData) => {
    try {
      await saveCoreOnboarding(data);
      await refetchData();
      toast.success('Éléments essentiels enregistrés', {
        description: 'Votre Sanctuaire est maintenant ouvert.',
      });
      setShowWizard(false);
    } catch (error) {
      console.error('Failed to save core onboarding:', error);
      toast.error('Erreur lors de la sauvegarde', {
        description: 'Votre progression est conservée. Réessayez dans un instant.',
      });
      throw error;
    }
  };

  return (
    <>
      {showWizard && (
        <CoreOnboardingWizard
          userEmail={user?.email}
          onComplete={handleWizardComplete}
          onClose={() => {
            setShowWizard(false);
            toast.info('Progression sauvegardée ✨', {
              description: 'Reprenez quand vous êtes prêt.',
            });
          }}
        />
      )}

      <div className="mx-auto flex max-w-5xl flex-col items-center px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
        <div className="relative z-10 mb-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 font-playfair text-3xl italic text-gradient-gold md:text-5xl"
          >
            Votre Sanctuaire Personnel
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xs font-medium uppercase tracking-[0.15em] text-stellar-500"
          >
            Explorez votre univers intérieur à travers le mandala sacré
          </motion.p>
        </div>

        {!isOnboardingComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative z-40 mx-auto mb-6 w-full max-w-2xl"
          >
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 shadow-[0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-xl">
              <div className="relative flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border border-emerald-500/50 bg-emerald-500/20">
                  <Sparkles className="h-7 w-7 text-emerald-400" />
                </div>
                <div className="flex-grow">
                  <h3 className="flex items-center gap-2 font-playfair text-lg italic text-emerald-300">
                    {hasDraft ? 'Reprenez votre préparation' : 'Trois étapes essentielles'}
                  </h3>
                  <p className="mt-1 text-sm text-emerald-100/80">
                    {hasDraft
                      ? 'Votre progression serveur est sauvegardée. Continuez exactement où vous vous êtes arrêté.'
                      : 'Naissance, visage, paume et consentement. Le diagnostic complet pourra être enrichi plus tard.'}
                  </p>
                </div>
                <button
                  onClick={() => setShowWizard(true)}
                  className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/20 px-5 py-2.5 text-sm font-bold uppercase tracking-widest text-emerald-300 transition-all hover:bg-emerald-500/30 sm:w-auto sm:flex-shrink-0"
                >
                  {hasDraft ? 'Continuer →' : 'Commencer →'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {isOnboardingComplete && (
          <div className="relative z-40 mx-auto mb-6 w-full max-w-2xl">
            <ExpertValidationBanner />
          </div>
        )}

        <section className="relative z-30 mb-6 flex w-full items-start justify-center py-4 md:mb-8 md:py-8">
          {isOnboardingComplete ? (
            <MandalaNav />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-lg text-center"
            >
              <div className="glass-card rounded-2xl border border-horizon-400/20 p-8">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-horizon-400/30 bg-gradient-to-br from-horizon-400/20 to-serenity-400/20">
                  <Sparkles className="h-8 w-8 text-horizon-400" />
                </div>
                <h3 className="mb-3 font-playfair text-xl italic text-stellar-100">
                  Préparez votre première lecture
                </h3>
                <p className="mb-6 text-sm text-stellar-500">
                  Commencez par le minimum essentiel. Vous gardez la liberté de compléter le reste ensuite.
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 px-6 py-3 font-semibold text-abyss-900 transition-all hover:shadow-lg hover:shadow-horizon-400/25"
                >
                  <Sparkles className="h-5 w-5" />
                  Ouvrir les 3 étapes
                </button>
              </div>
            </motion.div>
          )}
        </section>

        {hasOrders && isOnboardingComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="relative z-20 mx-auto mb-12 w-full max-w-3xl"
          >
            <CosmicNotification
              title="Votre demande a été transmise avec succès"
              message="L'Oracle travaille sur votre révélation personnalisée. Vous serez notifié par email et via l'application dès qu'elle sera prête."
              delay="24–48h"
              status="En cours de préparation"
              actionLabel="Voir ma lecture"
              actionHref="/sanctuaire/draws"
            />
          </motion.div>
        )}
      </div>
    </>
  );
}

export default function SanctuaireDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-horizon-400" />
            <p className="text-sm uppercase tracking-widest text-stellar-500">Chargement...</p>
          </div>
        </div>
      }
    >
      <AutoLoginHandler />
      <DashboardContent />
    </Suspense>
  );
}
