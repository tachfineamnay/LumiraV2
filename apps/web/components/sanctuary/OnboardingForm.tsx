'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Check, User, Sparkles, Camera } from 'lucide-react';

interface OnboardingFormProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: 'Informations Personnelles', icon: User },
  { id: 2, title: 'Question Spirituelle', icon: Sparkles },
  { id: 3, title: 'Photos (Optionnel)', icon: Camera },
];

export const OnboardingForm = ({ isOpen, onClose, onComplete }: OnboardingFormProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    birthTime: '',
    birthPlace: '',
    spiritualQuestion: '',
    photos: [] as File[],
  });

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#050A18]/85 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-[rgba(90,148,205,0.20)] bg-white/90 shadow-[0_20px_60px_rgba(70,125,185,0.18)] backdrop-blur-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgba(90,148,205,0.12)] p-6">
          <div>
            <h2 className="font-playfair text-xl italic text-[#0d1f35]">Compléter votre profil</h2>
            <p className="mt-1 text-xs text-[#587898]">Étape {currentStep} sur 3</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[#587898] transition-colors hover:bg-[rgba(90,148,205,0.10)] hover:text-[#0d1f35]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 px-6 py-4">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                  currentStep >= step.id
                    ? 'bg-[#b08828] text-white'
                    : 'bg-[rgba(90,148,205,0.12)] text-[#587898]'
                }`}
              >
                {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 transition-colors ${
                    currentStep > step.id ? 'bg-[#b08828]' : 'bg-[rgba(90,148,205,0.15)]'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 min-h-[300px]">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-[#384060]">Prénom</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full rounded-xl border border-[rgba(90,148,205,0.22)] bg-white/60 px-4 py-3 text-[#0d1f35] placeholder-[#7898b8] backdrop-blur-sm transition-colors focus:border-[#5a94cd] focus:outline-none focus:ring-2 focus:ring-[rgba(90,148,205,0.20)]"
                      placeholder="Votre prénom"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-[#384060]">Nom</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full rounded-xl border border-[rgba(90,148,205,0.22)] bg-white/60 px-4 py-3 text-[#0d1f35] placeholder-[#7898b8] backdrop-blur-sm transition-colors focus:border-[#5a94cd] focus:outline-none focus:ring-2 focus:ring-[rgba(90,148,205,0.20)]"
                      placeholder="Votre nom"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-[#384060]">
                    Date de naissance
                  </label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full rounded-xl border border-[rgba(90,148,205,0.22)] bg-white/60 px-4 py-3 text-[#0d1f35] backdrop-blur-sm transition-colors focus:border-[#5a94cd] focus:outline-none focus:ring-2 focus:ring-[rgba(90,148,205,0.20)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-[#384060]">
                      Heure de naissance
                    </label>
                    <input
                      type="time"
                      value={formData.birthTime}
                      onChange={(e) => setFormData({ ...formData, birthTime: e.target.value })}
                      className="w-full rounded-xl border border-[rgba(90,148,205,0.22)] bg-white/60 px-4 py-3 text-[#0d1f35] backdrop-blur-sm transition-colors focus:border-[#5a94cd] focus:outline-none focus:ring-2 focus:ring-[rgba(90,148,205,0.20)]"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-[#384060]">
                      Lieu de naissance
                    </label>
                    <input
                      type="text"
                      value={formData.birthPlace}
                      onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                      className="w-full rounded-xl border border-[rgba(90,148,205,0.22)] bg-white/60 px-4 py-3 text-[#0d1f35] placeholder-[#7898b8] backdrop-blur-sm transition-colors focus:border-[#5a94cd] focus:outline-none focus:ring-2 focus:ring-[rgba(90,148,205,0.20)]"
                      placeholder="Ville, Pays"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <label className="mb-2 block text-xs font-medium text-[#384060]">
                    Quelle est votre question spirituelle principale ?
                  </label>
                  <textarea
                    value={formData.spiritualQuestion}
                    onChange={(e) =>
                      setFormData({ ...formData, spiritualQuestion: e.target.value })
                    }
                    rows={6}
                    className="w-full resize-none rounded-xl border border-[rgba(90,148,205,0.22)] bg-white/60 px-4 py-3 text-[#0d1f35] placeholder-[#7898b8] backdrop-blur-sm transition-colors focus:border-[#5a94cd] focus:outline-none focus:ring-2 focus:ring-[rgba(90,148,205,0.20)]"
                    placeholder="Décrivez ce que vous souhaitez explorer lors de cette lecture..."
                  />
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-[#385c7a]">
                  Vous pouvez ajouter des photos pour enrichir votre lecture (optionnel).
                </p>
                <div className="cursor-pointer rounded-xl border-2 border-dashed border-[rgba(90,148,205,0.25)] p-8 text-center transition-colors hover:border-[rgba(90,148,205,0.45)] hover:bg-[rgba(90,148,205,0.04)]">
                  <Camera className="mx-auto mb-4 h-12 w-12 text-[#7898b8]" />
                  <p className="text-sm text-[#587898]">
                    Glissez-déposez vos photos ici ou cliquez pour sélectionner
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[rgba(90,148,205,0.10)] p-6">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-[#587898] transition-colors hover:text-[#0d1f35] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNext}
            className="flex items-center gap-2 rounded-xl bg-[#b08828] px-6 py-3 font-medium text-white shadow-[0_4px_16px_rgba(176,136,40,0.25)] transition-colors hover:bg-[#c89830]"
          >
            {currentStep === 3 ? 'Terminer' : 'Continuer'}
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
