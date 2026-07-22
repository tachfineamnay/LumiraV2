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
        className="relative w-full max-w-2xl mx-4 bg-brume-800/95 backdrop-blur-xl border border-ivoire-500/8 rounded-2xl shadow-aube-glow overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-ivoire-500/[0.04] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-playfair italic text-ivoire-100">Compléter votre profil</h2>
            <p className="text-xs text-brume-300 mt-1">Étape {currentStep} sur 3</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-brume-800/25 text-brume-300 hover:text-ivoire-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 py-4 flex items-center gap-2">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  currentStep >= step.id
                    ? 'bg-ivoire-400 text-abyss-900'
                    : 'bg-brume-700/30 text-brume-300'
                }`}
              >
                {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 transition-colors ${
                    currentStep > step.id ? 'bg-ivoire-400' : 'bg-brume-700/30'
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
                    <label className="block text-xs text-ivoire-200 mb-2">Prénom</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-3 bg-brume-800/25 border border-ivoire-500/8 rounded-xl text-ivoire-100 placeholder-brume-300 focus:border-ivoire-400 focus:ring-2 focus:ring-ivoire-400/20"
                      placeholder="Votre prénom"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ivoire-200 mb-2">Nom</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-3 bg-brume-800/25 border border-ivoire-500/8 rounded-xl text-ivoire-100 placeholder-brume-300 focus:border-ivoire-400 focus:ring-2 focus:ring-ivoire-400/20"
                      placeholder="Votre nom"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-ivoire-200 mb-2">Date de naissance</label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-4 py-3 bg-brume-800/25 border border-ivoire-500/8 rounded-xl text-ivoire-100 focus:border-ivoire-400 focus:ring-2 focus:ring-ivoire-400/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-ivoire-200 mb-2">Heure de naissance</label>
                    <input
                      type="time"
                      value={formData.birthTime}
                      onChange={(e) => setFormData({ ...formData, birthTime: e.target.value })}
                      className="w-full px-4 py-3 bg-brume-800/25 border border-ivoire-500/8 rounded-xl text-ivoire-100 focus:border-ivoire-400 focus:ring-2 focus:ring-ivoire-400/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-ivoire-200 mb-2">Lieu de naissance</label>
                    <input
                      type="text"
                      value={formData.birthPlace}
                      onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                      className="w-full px-4 py-3 bg-brume-800/25 border border-ivoire-500/8 rounded-xl text-ivoire-100 placeholder-brume-300 focus:border-ivoire-400 focus:ring-2 focus:ring-ivoire-400/20"
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
                  <label className="block text-xs text-ivoire-200 mb-2">
                    Quelle est votre question spirituelle principale ?
                  </label>
                  <textarea
                    value={formData.spiritualQuestion}
                    onChange={(e) =>
                      setFormData({ ...formData, spiritualQuestion: e.target.value })
                    }
                    rows={6}
                    className="w-full px-4 py-3 bg-brume-800/25 border border-ivoire-500/8 rounded-xl text-ivoire-100 placeholder-brume-300 focus:border-ivoire-400 focus:ring-2 focus:ring-ivoire-400/20 resize-none"
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
                <p className="text-sm text-ivoire-200">
                  Vous pouvez ajouter des photos pour enrichir votre lecture (optionnel).
                </p>
                <div className="border-2 border-dashed border-ivoire-500/15 rounded-xl p-8 text-center hover:border-ivoire-400/40 transition-colors cursor-pointer">
                  <Camera className="w-12 h-12 text-brume-300 mx-auto mb-4" />
                  <p className="text-sm text-brume-300">
                    Glissez-déposez vos photos ici ou cliquez pour sélectionner
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-ivoire-500/[0.04] flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-brume-300 hover:text-ivoire-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-ivoire-400 text-abyss-900 font-medium"
          >
            {currentStep === 3 ? 'Terminer' : 'Continuer'}
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
