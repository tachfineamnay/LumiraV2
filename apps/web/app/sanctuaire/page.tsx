'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { MandalaNav } from '../../components/sanctuary/MandalaNav';
import { CosmicNotification } from '../../components/sanctuary/CosmicNotification';
import { ExpertValidationBanner } from '../../components/sanctuary/ExpertValidationBanner';
import { HolisticWizard } from '../../components/onboarding/HolisticWizard';
import { HolisticDiagnosticData } from '../../lib/holisticSchema';
import sanctuaireApi from '../../lib/sanctuaireApi';
import { useSanctuaire } from '../../context/SanctuaireContext';
import {
  useSanctuaireAuth,
  setFirstVisitFlag,
  clearFirstVisitFlag,
} from '../../context/SanctuaireAuthContext';
import { Loader2, Sparkles } from 'lucide-react';

// =============================================================================
// AUTO-LOGIN HANDLER
// =============================================================================

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

  // Payment confirmation has already created the httpOnly session. URL query
  // parameters may request onboarding but must never authenticate a visitor.
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

  // Onboarding modal - force display until profile is completed (server state as source of truth)
  if (showOnboarding && !profile?.profileCompleted) {
    return (
      <HolisticWizard
        userEmail={user?.email}
        onClose={() => {
          // User closed wizard to prepare (photos, etc.) - draft is auto-saved by HolisticWizard
          setShowOnboarding(false);
          clearFirstVisitFlag();
          toast.info('Votre progression est sauvegardée ✨', {
            description: 'Reprenez votre diagnostic quand vous êtes prêt via le bouton doré.',
            duration: 5000,
          });
          router.replace('/sanctuaire');
        }}
        onComplete={async (data) => {
          try {
            // Map wizard fields to API expected fields
            const profileData = {
              birthDate: data.birthDate,
              birthTime: data.birthTime || null,
              birthPlace: data.birthPlace,
              facePhotoUrl: data.facePhoto || null,
              palmPhotoUrl: data.palmPhoto || null,
              highs: data.highs,
              lows: data.lows,
              strongSide: data.strongSide,
              weakSide: data.weakSide,
              strongZone: data.strongZone,
              weakZone: data.weakZone,
              deliveryStyle: data.deliveryStyle,
              pace: data.pace,
              ailments: data.ailments || null,
              specificQuestion: data.specificQuestion || null,
              objective: data.objective || null,
              fears: data.fears || null,
              rituals: data.rituals || null,
              profileCompleted: true,
            };

            await sanctuaireApi.patch('/users/profile', profileData);
          } catch (error) {
            console.error('Failed to save holistic diagnostic:', error);
          } finally {
            setShowOnboarding(false);
            clearFirstVisitFlag();
            localStorage.removeItem('holistic_wizard_draft');
            localStorage.removeItem('holistic_wizard_email');
            await refetchData();
            router.replace('/sanctuaire');
          }
        }}
      />
    );
  }

  return null;
}

// =============================================================================
// DASHBOARD CONTENT
// =============================================================================

function DashboardContent() {
  const { isLoading, orderCount } = useSanctuaire();
  const { profile, refetchData, user } = useSanctuaireAuth();
  const [showWizard, setShowWizard] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // Check if onboarding is complete - use profileCompleted as single source of truth
  const isOnboardingComplete = profile?.profileCompleted === true;

  // Check for existing draft in localStorage (user started but didn't finish)
  useEffect(() => {
    const draft = localStorage.getItem('holistic_wizard_draft');
    const draftEmail = localStorage.getItem('holistic_wizard_email');
    // Draft exists and belongs to current user
    if (draft && (!draftEmail || draftEmail === user?.email)) {
      setHasDraft(true);
    } else {
      setHasDraft(false);
    }
  }, [user?.email, showWizard]); // Re-check when wizard closes

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
          <p className="text-stellar-500 text-sm tracking-widest uppercase">
            Chargement de votre sanctuaire...
          </p>
        </div>
      </div>
    );
  }

  const hasOrders = orderCount > 0;

  // Handle wizard completion
  const handleWizardComplete = async (data: HolisticDiagnosticData) => {
    try {
      const profileData = {
        birthDate: data.birthDate,
        birthTime: data.birthTime || null,
        birthPlace: data.birthPlace,
        facePhotoUrl: data.facePhoto || null,
        palmPhotoUrl: data.palmPhoto || null,
        highs: data.highs,
        lows: data.lows,
        strongSide: data.strongSide,
        weakSide: data.weakSide,
        strongZone: data.strongZone,
        weakZone: data.weakZone,
        deliveryStyle: data.deliveryStyle,
        pace: data.pace,
        ailments: data.ailments || null,
        specificQuestion: data.specificQuestion || null,
        objective: data.objective || null,
        fears: data.fears || null,
        rituals: data.rituals || null,
        profileCompleted: true,
      };

      await sanctuaireApi.patch('/users/profile', profileData);

      localStorage.removeItem('holistic_wizard_draft');
      localStorage.removeItem('holistic_wizard_email');

      await refetchData();
      toast.success('Diagnostic complété !', {
        description: 'Votre mandala est maintenant accessible.',
      });
    } catch (error) {
      console.error('Failed to save holistic diagnostic:', error);
      toast.error('Erreur lors de la sauvegarde', { description: 'Veuillez réessayer.' });
      await refetchData();
    } finally {
      setShowWizard(false);
    }
  };

  return (
    <>
      {/* Wizard Modal */}
      {showWizard && (
        <HolisticWizard
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

      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 flex flex-col items-center">
        {/* 🏛️ WELCOME */}
        <div className="text-center mb-8 relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-playfair italic text-gradient-gold mb-4"
          >
            Votre Sanctuaire Personnel
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-stellar-500 tracking-[0.15em] uppercase text-xs font-medium"
          >
            Explorez votre univers intérieur à travers le mandala sacré
          </motion.p>
        </div>

        {/* 🔔 ONBOARDING REMINDER - Shows if profile incomplete */}
        {!isOnboardingComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto mb-6 relative z-40"
          >
            <div className="relative group overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 backdrop-blur-xl shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              {/* Animated Background Sheen */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent pointer-events-none translate-x-[-100%] animate-[shimmer_3s_infinite]" />

              <div className="relative p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Icon */}
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
                    <Sparkles className="w-7 h-7 text-emerald-400" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-grow">
                  <h3 className="text-lg font-playfair italic text-emerald-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    {hasDraft ? 'Reprenez votre diagnostic' : 'Complétez votre profil'}
                  </h3>
                  <p className="text-emerald-100/80 text-sm mt-1">
                    {hasDraft
                      ? 'Votre progression a été sauvegardée. Continuez là où vous vous êtes arrêté.'
                      : 'Finalisez votre diagnostic holistique pour recevoir votre lecture Oracle personnalisée.'}
                  </p>
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => setShowWizard(true)}
                  className="w-full sm:flex-shrink-0 sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-sm font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  {hasDraft ? 'Continuer →' : 'Terminer →'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 👁️ EXPERT VALIDATION NOTIFICATION - Shows when expert validates a reading */}
        {isOnboardingComplete && (
          <div className="w-full max-w-2xl mx-auto mb-6 relative z-40">
            <ExpertValidationBanner />
          </div>
        )}

        {/* 🪐 MANDALA NAVIGATION or ONBOARDING CTA */}
        <section className="relative w-full flex justify-center items-start py-4 md:py-8 mb-6 md:mb-8 z-30">
          {isOnboardingComplete ? (
            <div>
              <MandalaNav />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-lg text-center"
            >
              <div className="glass-card p-8 rounded-2xl border border-horizon-400/20">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-horizon-400/20 to-serenity-400/20 flex items-center justify-center mb-6 border border-horizon-400/30">
                  <Sparkles className="w-8 h-8 text-horizon-400" />
                </div>
                <h3 className="text-xl font-playfair italic text-stellar-100 mb-3">
                  Complétez votre Diagnostic Vibratoire
                </h3>
                <p className="text-stellar-500 text-sm mb-6">
                  Partagez vos énergies, votre corps et vos préférences pour une expérience Oracle
                  personnalisée.
                </p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-900 font-semibold hover:shadow-lg hover:shadow-horizon-400/25 transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  Commencer le Diagnostic
                </button>
              </div>
            </motion.div>
          )}
        </section>

        {/* 🔔 ORDER STATUS */}
        {hasOrders && isOnboardingComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full max-w-3xl mx-auto mb-12 relative z-20"
          >
            <CosmicNotification
              title="Votre demande a été transmise avec succès"
              message="L'Oracle travaille sur votre révélation personnalisée. Vous serez notifié par email et via l'application dès qu'elle sera prête."
              delay="24h"
              status="En cours d'analyse"
              actionLabel="Voir ma lecture"
              actionHref="/sanctuaire/draws"
            />
          </motion.div>
        )}
      </div>
    </>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SanctuaireDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
            <p className="text-stellar-500 text-sm tracking-widest uppercase">Chargement...</p>
          </div>
        </div>
      }
    >
      <AutoLoginHandler />
      <DashboardContent />
    </Suspense>
  );
}
