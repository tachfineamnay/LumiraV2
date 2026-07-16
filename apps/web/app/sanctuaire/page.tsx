'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { MandalaNav } from '../../components/sanctuary/MandalaNav';
import { CosmicNotification } from '../../components/sanctuary/CosmicNotification';
import { ExpertValidationBanner } from '../../components/sanctuary/ExpertValidationBanner';
import {
  CoreOnboardingData,
  CoreOnboardingWizard,
} from '../../components/onboarding/CoreOnboardingWizard';
import { HolisticWizard } from '../../components/onboarding/HolisticWizard';
import { HolisticDiagnosticData } from '../../lib/holisticSchema';
import sanctuaireApi from '../../lib/sanctuaireApi';
import { useSanctuaire } from '../../context/SanctuaireContext';
import {
  clearFirstVisitFlag,
  setFirstVisitFlag,
  useSanctuaireAuth,
} from '../../context/SanctuaireAuthContext';

type OnboardingFlow = 'core' | 'holistic' | null;

type CoreProfile = {
  birthDate?: string | null;
  birthTime?: string | null;
  birthPlace?: string | null;
  facePhotoUrl?: string | null;
  palmPhotoUrl?: string | null;
};

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

const hasCoreProfile = (profile?: CoreProfile | null) =>
  Boolean(
    profile?.birthDate &&
      profile?.birthPlace &&
      profile?.facePhotoUrl &&
      profile?.palmPhotoUrl,
  );

const coreDataFromProfile = (profile?: CoreProfile | null): Partial<CoreOnboardingData> => ({
  birthDate: toDateInput(profile?.birthDate),
  birthTime: profile?.birthTime || '',
  birthPlace: profile?.birthPlace || '',
  facePhoto: profile?.facePhotoUrl || '',
  palmPhoto: profile?.palmPhotoUrl || '',
});

const holisticInitialData = (
  profile?: CoreProfile | null,
  coreData?: CoreOnboardingData | null,
): Partial<HolisticDiagnosticData> => ({
  birthDate: coreData?.birthDate || toDateInput(profile?.birthDate),
  birthTime: coreData?.birthTime || profile?.birthTime || '',
  birthPlace: coreData?.birthPlace || profile?.birthPlace || '',
  facePhoto: coreData?.facePhoto || profile?.facePhotoUrl || '',
  palmPhoto: coreData?.palmPhoto || profile?.palmPhotoUrl || '',
});

const saveCoreProfile = async (data: CoreOnboardingData) => {
  await sanctuaireApi.patch('/users/profile', {
    birthDate: data.birthDate,
    birthTime: data.birthTime || null,
    birthPlace: data.birthPlace,
    facePhotoUrl: data.facePhoto,
    palmPhotoUrl: data.palmPhoto,
  });
};

const saveHolisticProfile = async (data: HolisticDiagnosticData) => {
  await sanctuaireApi.patch('/users/profile', {
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
  });
};

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
  const [activeFlow, setActiveFlow] = useState<OnboardingFlow>(null);
  const [capturedCoreData, setCapturedCoreData] = useState<CoreOnboardingData | null>(null);
  const onboardingRequested = searchParams.get('onboarding') === '1';

  useEffect(() => {
    if (authLoading || !onboardingRequested) return;

    if (!isAuthenticated) {
      router.replace('/sanctuaire/login');
      return;
    }

    if (profile?.profileCompleted) {
      router.replace('/sanctuaire');
      return;
    }

    setFirstVisitFlag(true);
    setActiveFlow(hasCoreProfile(profile) ? 'holistic' : 'core');
  }, [authLoading, onboardingRequested, isAuthenticated, profile, router]);

  if (activeFlow === 'core') {
    return (
      <CoreOnboardingWizard
        userEmail={user?.email}
        initialData={coreDataFromProfile(profile)}
        onClose={() => {
          setActiveFlow(null);
          clearFirstVisitFlag();
          toast.info('Votre progression est sauvegardée', {
            description: 'Vous pourrez reprendre depuis votre Sanctuaire.',
          });
          router.replace('/sanctuaire');
        }}
        onContinueNow={async (data) => {
          try {
            await saveCoreProfile(data);
            setCapturedCoreData(data);
            await refetchData();
            setActiveFlow('holistic');
          } catch (error) {
            console.error('Failed to save core onboarding:', error);
            toast.error('Impossible de sauvegarder vos éléments', {
              description: 'Veuillez réessayer sans fermer cette page.',
            });
            throw error;
          }
        }}
        onFinishLater={async (data) => {
          try {
            await saveCoreProfile(data);
            await refetchData();
            setActiveFlow(null);
            clearFirstVisitFlag();
            toast.success('Les éléments essentiels sont enregistrés', {
              description: 'Vous pourrez enrichir votre lecture plus tard depuis le Sanctuaire.',
              duration: 6000,
            });
            router.replace('/sanctuaire');
          } catch (error) {
            console.error('Failed to save core onboarding:', error);
            toast.error('Impossible de sauvegarder vos éléments', {
              description: 'Veuillez réessayer sans fermer cette page.',
            });
            throw error;
          }
        }}
      />
    );
  }

  if (activeFlow === 'holistic' && !profile?.profileCompleted) {
    return (
      <HolisticWizard
        userEmail={user?.email}
        initialData={holisticInitialData(profile, capturedCoreData)}
        onClose={() => {
          setActiveFlow(null);
          clearFirstVisitFlag();
          toast.info('Votre progression est sauvegardée', {
            description: 'Les bases sont enregistrées. Reprenez l’approfondissement quand vous le souhaitez.',
          });
          router.replace('/sanctuaire');
        }}
        onComplete={async (data) => {
          try {
            await saveHolisticProfile(data);
            localStorage.removeItem('holistic_wizard_draft');
            localStorage.removeItem('holistic_wizard_email');
            await refetchData();
            setActiveFlow(null);
            clearFirstVisitFlag();
            toast.success('Votre contexte a bien été transmis', {
              description: 'Lumira dispose maintenant de tous vos éléments.',
            });
            router.replace('/sanctuaire');
          } catch (error) {
            console.error('Failed to save holistic diagnostic:', error);
            toast.error('Erreur lors de la sauvegarde', {
              description: 'Veuillez réessayer sans fermer cette page.',
            });
            throw error;
          }
        }}
      />
    );
  }

  return null;
}

function DashboardContent() {
  const { isLoading, orderCount } = useSanctuaire();
  const { profile, refetchData, user } = useSanctuaireAuth();
  const [activeFlow, setActiveFlow] = useState<OnboardingFlow>(null);
  const [capturedCoreData, setCapturedCoreData] = useState<CoreOnboardingData | null>(null);
  const [hasCoreDraft, setHasCoreDraft] = useState(false);
  const [hasHolisticDraft, setHasHolisticDraft] = useState(false);

  const isOnboardingComplete = profile?.profileCompleted === true;
  const isCoreComplete = hasCoreProfile(profile);

  useEffect(() => {
    const coreDraftKey = `lumira_core_onboarding_${user?.email || 'anonymous'}`;
    setHasCoreDraft(Boolean(localStorage.getItem(coreDraftKey)));

    const holisticDraft = localStorage.getItem('holistic_wizard_draft');
    const draftEmail = localStorage.getItem('holistic_wizard_email');
    setHasHolisticDraft(Boolean(holisticDraft && (!draftEmail || draftEmail === user?.email)));
  }, [user?.email, activeFlow, profile]);

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
  const nextFlow: Exclude<OnboardingFlow, null> = isCoreComplete ? 'holistic' : 'core';
  const hasRelevantDraft = isCoreComplete ? hasHolisticDraft : hasCoreDraft;

  const handleHolisticComplete = async (data: HolisticDiagnosticData) => {
    try {
      await saveHolisticProfile(data);
      localStorage.removeItem('holistic_wizard_draft');
      localStorage.removeItem('holistic_wizard_email');
      await refetchData();
      toast.success('Votre contexte a bien été transmis', {
        description: 'Lumira dispose maintenant de tous vos éléments.',
      });
      setActiveFlow(null);
    } catch (error) {
      console.error('Failed to save holistic diagnostic:', error);
      toast.error('Erreur lors de la sauvegarde', { description: 'Veuillez réessayer.' });
      throw error;
    }
  };

  return (
    <>
      {activeFlow === 'core' && (
        <CoreOnboardingWizard
          userEmail={user?.email}
          initialData={coreDataFromProfile(profile)}
          onClose={() => {
            setActiveFlow(null);
            toast.info('Progression sauvegardée', {
              description: 'Reprenez quand vous êtes prêt.',
            });
          }}
          onContinueNow={async (data) => {
            try {
              await saveCoreProfile(data);
              setCapturedCoreData(data);
              await refetchData();
              setActiveFlow('holistic');
            } catch (error) {
              console.error('Failed to save core onboarding:', error);
              toast.error('Impossible de sauvegarder vos éléments', {
                description: 'Veuillez réessayer.',
              });
              throw error;
            }
          }}
          onFinishLater={async (data) => {
            try {
              await saveCoreProfile(data);
              await refetchData();
              setActiveFlow(null);
              toast.success('Les éléments essentiels sont enregistrés', {
                description: 'Vous pouvez compléter votre contexte maintenant ou plus tard.',
                duration: 6000,
              });
            } catch (error) {
              console.error('Failed to save core onboarding:', error);
              toast.error('Impossible de sauvegarder vos éléments', {
                description: 'Veuillez réessayer.',
              });
              throw error;
            }
          }}
        />
      )}

      {activeFlow === 'holistic' && (
        <HolisticWizard
          userEmail={user?.email}
          initialData={holisticInitialData(profile, capturedCoreData)}
          onComplete={handleHolisticComplete}
          onClose={() => {
            setActiveFlow(null);
            toast.info('Progression sauvegardée', {
              description: 'Les bases sont déjà enregistrées. Reprenez quand vous le souhaitez.',
            });
          }}
        />
      )}

      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 flex flex-col items-center">
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
            Votre espace privé Lumira
          </motion.p>
        </div>

        {!isOnboardingComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto mb-6 relative z-40"
          >
            <div className="relative group overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 backdrop-blur-xl shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent pointer-events-none translate-x-[-100%] animate-[shimmer_3s_infinite]" />

              <div className="relative p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
                    <Sparkles className="w-7 h-7 text-emerald-400" />
                  </div>
                </div>

                <div className="flex-grow">
                  <h3 className="text-lg font-playfair italic text-emerald-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    {!isCoreComplete
                      ? hasRelevantDraft
                        ? 'Reprenez vos éléments essentiels'
                        : 'Préparons votre lecture'
                      : hasRelevantDraft
                        ? 'Reprenez votre approfondissement'
                        : 'Enrichissez votre lecture'}
                  </h3>
                  <p className="text-emerald-100/80 text-sm mt-1">
                    {!isCoreComplete
                      ? 'Transmettez vos repères de naissance, votre visage et votre paume.'
                      : 'Les bases sont enregistrées. Ajoutez votre contexte et vos questions quand vous le souhaitez.'}
                  </p>
                </div>

                <button
                  onClick={() => setActiveFlow(nextFlow)}
                  className="w-full sm:flex-shrink-0 sm:w-auto min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-sm font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  {hasRelevantDraft ? 'Continuer →' : isCoreComplete ? 'Ajouter du contexte →' : 'Commencer →'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {isOnboardingComplete && (
          <div className="w-full max-w-2xl mx-auto mb-6 relative z-40">
            <ExpertValidationBanner />
          </div>
        )}

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
              <div className="glass-card p-6 sm:p-8 rounded-2xl border border-horizon-400/20">
                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-horizon-400/20 to-serenity-400/20 flex items-center justify-center mb-6 border border-horizon-400/30">
                  <Sparkles className="w-8 h-8 text-horizon-400" />
                </div>
                <h3 className="text-xl font-playfair italic text-stellar-100 mb-3">
                  {isCoreComplete ? 'Votre lecture prend forme' : 'Commençons par l’essentiel'}
                </h3>
                <p className="text-stellar-500 text-sm mb-6">
                  {isCoreComplete
                    ? 'Vos éléments principaux sont enregistrés. Vous pouvez maintenant ajouter ce que vous traversez et les questions que vous souhaitez confier à Lumira.'
                    : 'Quelques repères et deux images suffisent pour commencer. Vous choisirez ensuite de poursuivre maintenant ou plus tard.'}
                </p>
                <button
                  onClick={() => setActiveFlow(nextFlow)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-900 font-semibold hover:shadow-lg hover:shadow-horizon-400/25 transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  {isCoreComplete ? 'Ajouter mon contexte' : 'Transmettre mes éléments'}
                </button>
              </div>
            </motion.div>
          )}
        </section>

        {hasOrders && isCoreComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full max-w-3xl mx-auto mb-12 relative z-20"
          >
            <CosmicNotification
              title="Vos éléments essentiels ont bien été reçus"
              message="Lumira prépare votre lecture avec attention. Vous pouvez encore ajouter du contexte tant que l'analyse n'a pas été finalisée."
              delay="24 à 48h"
              status="Préparation en cours"
              actionLabel="Suivre ma lecture"
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
