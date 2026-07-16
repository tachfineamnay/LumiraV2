'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  Check,
  Clock,
  Loader2,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react';
import { SmartPhotoUploader } from './SmartPhotoUploader';

export interface CoreOnboardingData {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  facePhoto: string;
  palmPhoto: string;
}

interface CoreOnboardingWizardProps {
  userEmail?: string;
  initialData?: Partial<CoreOnboardingData>;
  onContinueNow: (data: CoreOnboardingData) => Promise<void>;
  onFinishLater: (data: CoreOnboardingData) => Promise<void>;
  onClose?: () => void;
}

type Step = 0 | 1 | 2;

const EMPTY_DATA: CoreOnboardingData = {
  birthDate: '',
  birthTime: '',
  birthPlace: '',
  facePhoto: '',
  palmPhoto: '',
};

const STEP_LABELS = ['Repères', 'Photos', 'Suite'];

export function CoreOnboardingWizard({
  userEmail,
  initialData,
  onContinueNow,
  onFinishLater,
  onClose,
}: CoreOnboardingWizardProps) {
  const draftKey = useMemo(
    () => `lumira_core_onboarding_${userEmail || 'anonymous'}`,
    [userEmail],
  );

  const [step, setStep] = useState<Step>(0);
  const [data, setData] = useState<CoreOnboardingData>(() => {
    if (typeof window === 'undefined') return { ...EMPTY_DATA, ...initialData };

    try {
      const saved = window.localStorage.getItem(draftKey);
      const draft = saved ? (JSON.parse(saved) as Partial<CoreOnboardingData>) : {};
      return { ...EMPTY_DATA, ...initialData, ...draft };
    } catch {
      return { ...EMPTY_DATA, ...initialData };
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(draftKey, JSON.stringify(data));
  }, [data, draftKey]);

  const clearDraft = () => window.localStorage.removeItem(draftKey);

  const validateCurrentStep = () => {
    const nextErrors: Record<string, string> = {};

    if (step === 0) {
      if (!data.birthDate) nextErrors.birthDate = 'La date de naissance est requise.';
      if (data.birthPlace.trim().length < 2) {
        nextErrors.birthPlace = 'Indiquez au moins une ville et un pays.';
      }
    }

    if (step === 1) {
      if (!data.facePhoto) nextErrors.facePhoto = 'Ajoutez une photo nette de votre visage.';
      if (!data.palmPhoto) nextErrors.palmPhoto = 'Ajoutez une photo nette de votre paume.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, 2) as Step);
  };

  const goBack = () => {
    setErrors({});
    setStep((current) => Math.max(current - 1, 0) as Step);
  };

  const submitChoice = async (choice: 'now' | 'later') => {
    setIsSubmitting(true);
    try {
      if (choice === 'now') {
        await onContinueNow(data);
      } else {
        await onFinishLater(data);
      }
      clearDraft();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-abyss-900/95 backdrop-blur-xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full h-full md:h-auto md:max-h-[92vh] md:max-w-2xl md:mx-4 md:rounded-2xl bg-abyss-800 md:border md:border-white/10 md:shadow-2xl overflow-hidden flex flex-col"
      >
        <header className="flex-shrink-0 border-b border-white/5 bg-abyss-800/90 backdrop-blur-sm">
          <div className="h-1 bg-abyss-700">
            <motion.div
              className="h-full bg-gradient-to-r from-horizon-400 to-horizon-500"
              animate={{ width: `${((step + 1) / 3) * 100}%` }}
            />
          </div>

          <div className="px-4 md:px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-horizon-400">
                  Préparation de votre lecture
                </p>
                <h2 className="mt-1 text-lg md:text-xl font-playfair italic text-stellar-100">
                  Les éléments essentiels
                </h2>
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer et reprendre plus tard"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-stellar-400 hover:text-stellar-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {STEP_LABELS.map((label, index) => (
                <div key={label} className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                      index < step
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : index === step
                          ? 'bg-horizon-400 text-abyss-900'
                          : 'bg-white/5 text-stellar-600'
                    }`}
                  >
                    {index < step ? <Check className="w-3.5 h-3.5" /> : index + 1}
                  </span>
                  <span className="hidden sm:block truncate text-xs text-stellar-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 md:p-6">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.section
                  key="birth"
                  initial={{ opacity: 0, x: 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -28 }}
                  className="space-y-5"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-horizon-400/10 border border-horizon-400/20 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-horizon-400" />
                    </div>
                    <h3 className="mt-4 text-xl font-playfair italic text-stellar-100">
                      Vos repères de naissance
                    </h3>
                    <p className="mt-2 text-sm text-stellar-500 max-w-md mx-auto">
                      Commençons par les informations rapides qui servent de base à votre lecture.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-stellar-400 mb-2">
                        <Calendar className="w-3.5 h-3.5" /> Date de naissance
                      </label>
                      <input
                        type="date"
                        value={data.birthDate}
                        onChange={(event) => {
                          setData((current) => ({ ...current, birthDate: event.target.value }));
                          setErrors((current) => ({ ...current, birthDate: '' }));
                        }}
                        className="w-full min-h-[48px] px-4 py-3 bg-abyss-700/50 border border-white/10 rounded-xl text-stellar-100 focus:border-horizon-400 focus:ring-2 focus:ring-horizon-400/20 outline-none"
                      />
                      {errors.birthDate && <p className="mt-1 text-xs text-rose-400">{errors.birthDate}</p>}
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-stellar-400 mb-2">
                        <MapPin className="w-3.5 h-3.5" /> Lieu de naissance
                      </label>
                      <input
                        type="text"
                        value={data.birthPlace}
                        onChange={(event) => {
                          setData((current) => ({ ...current, birthPlace: event.target.value }));
                          setErrors((current) => ({ ...current, birthPlace: '' }));
                        }}
                        placeholder="Ville, pays"
                        className="w-full min-h-[48px] px-4 py-3 bg-abyss-700/50 border border-white/10 rounded-xl text-stellar-100 placeholder:text-stellar-600 focus:border-horizon-400 focus:ring-2 focus:ring-horizon-400/20 outline-none"
                      />
                      {errors.birthPlace && <p className="mt-1 text-xs text-rose-400">{errors.birthPlace}</p>}
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-stellar-400 mb-2">
                        <Clock className="w-3.5 h-3.5" /> Heure de naissance
                        <span className="normal-case tracking-normal text-stellar-600">(facultative)</span>
                      </label>
                      <input
                        type="time"
                        value={data.birthTime}
                        onChange={(event) =>
                          setData((current) => ({ ...current, birthTime: event.target.value }))
                        }
                        className="w-full min-h-[48px] px-4 py-3 bg-abyss-700/50 border border-white/10 rounded-xl text-stellar-100 focus:border-horizon-400 focus:ring-2 focus:ring-horizon-400/20 outline-none"
                      />
                    </div>
                  </div>
                </motion.section>
              )}

              {step === 1 && (
                <motion.section
                  key="photos"
                  initial={{ opacity: 0, x: 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -28 }}
                  className="space-y-5"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto rounded-full bg-horizon-400/10 border border-horizon-400/20 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-horizon-400" />
                    </div>
                    <h3 className="mt-4 text-xl font-playfair italic text-stellar-100">
                      Votre visage et votre main
                    </h3>
                    <p className="mt-2 text-sm text-stellar-500 max-w-md mx-auto">
                      Deux images nettes permettent de préparer l'analyse visuelle. Elles restent privées.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <SmartPhotoUploader
                        label="Photo du visage"
                        description="De face, sans filtre, dans une lumière naturelle."
                        value={data.facePhoto || undefined}
                        onChange={(value) => {
                          setData((current) => ({ ...current, facePhoto: value || '' }));
                          setErrors((current) => ({ ...current, facePhoto: '' }));
                        }}
                      />
                      {errors.facePhoto && <p className="mt-2 text-xs text-rose-400">{errors.facePhoto}</p>}
                    </div>

                    <div>
                      <SmartPhotoUploader
                        label="Photo de la paume"
                        description="Main ouverte, entière, nette et bien éclairée."
                        value={data.palmPhoto || undefined}
                        onChange={(value) => {
                          setData((current) => ({ ...current, palmPhoto: value || '' }));
                          setErrors((current) => ({ ...current, palmPhoto: '' }));
                        }}
                      />
                      {errors.palmPhoto && <p className="mt-2 text-xs text-rose-400">{errors.palmPhoto}</p>}
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-stellar-600 text-center">
                    Ces images sont utilisées uniquement pour préparer votre lecture Lumira.
                  </p>
                </motion.section>
              )}

              {step === 2 && (
                <motion.section
                  key="choice"
                  initial={{ opacity: 0, x: 28 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -28 }}
                  className="space-y-5"
                >
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <Sparkles className="w-7 h-7 text-emerald-300" />
                    </div>
                    <h3 className="mt-4 text-xl md:text-2xl font-playfair italic text-stellar-100">
                      Les bases sont là
                    </h3>
                    <p className="mt-2 text-sm text-stellar-500 max-w-md mx-auto">
                      Vous pouvez maintenant partager davantage de contexte, ou reprendre tranquillement plus tard.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => submitChoice('now')}
                      className="w-full text-left p-4 rounded-2xl border border-horizon-400/40 bg-horizon-400/10 hover:bg-horizon-400/15 transition-colors disabled:opacity-50"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>
                          <strong className="block text-stellar-100">Je complète maintenant</strong>
                          <span className="block mt-1 text-sm text-stellar-500">
                            Ajoutez vos questions, votre contexte et ce que vous traversez.
                          </span>
                        </span>
                        {isSubmitting ? (
                          <Loader2 className="w-5 h-5 text-horizon-300 animate-spin flex-shrink-0" />
                        ) : (
                          <ArrowRight className="w-5 h-5 text-horizon-300 flex-shrink-0" />
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => submitChoice('later')}
                      className="w-full text-left p-4 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>
                          <strong className="block text-stellar-200">Je termine plus tard</strong>
                          <span className="block mt-1 text-sm text-stellar-500">
                            Vos éléments essentiels sont enregistrés. Vous pourrez reprendre depuis votre Sanctuaire.
                          </span>
                        </span>
                        <ArrowRight className="w-5 h-5 text-stellar-500 flex-shrink-0" />
                      </span>
                    </button>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center text-xs leading-relaxed text-emerald-100/70">
                    Dès que vos éléments essentiels sont transmis, Lumira peut préparer votre lecture avec attention.
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </main>

        <footer className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-white/5 bg-abyss-800/90 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 0 || isSubmitting}
              className={`min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                step === 0
                  ? 'opacity-0 pointer-events-none'
                  : 'bg-white/5 text-stellar-300 hover:bg-white/10 border border-white/10'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </button>

            <span className="text-xs text-stellar-600">{step + 1} / 3</span>

            {step < 2 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={isSubmitting}
                className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-900 font-semibold text-sm hover:shadow-lg hover:shadow-horizon-400/25 transition-all disabled:opacity-50"
              >
                Continuer
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-[105px]" aria-hidden="true" />
            )}
          </div>
        </footer>
      </motion.div>
    </div>
  );
}
