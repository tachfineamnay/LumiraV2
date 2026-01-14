'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
    Star,
    Lock,
    Check,
    Sparkles,
    MessageCircle,
    X,
    ChevronRight,
    Loader2,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export interface PathStep {
    id: string;
    dayNumber: number;
    title: string;
    description: string;
    synthesis: string; // Mantra
    actionType: 'MANTRA' | 'RITUAL' | 'JOURNALING' | 'MEDITATION' | 'REFLECTION';
    isCompleted: boolean;
    unlockedAt?: string | null;
    completedAt?: string | null;
}

interface TimelineConstellationProps {
    steps: PathStep[];
    currentDay: number;
    archetype?: string;
    onCompleteStep: (stepId: string) => Promise<void>;
    onOpenChat?: () => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TimelineConstellation({
    steps,
    currentDay,
    archetype,
    onCompleteStep,
    onOpenChat,
}: TimelineConstellationProps) {
    const [selectedStep, setSelectedStep] = useState<PathStep | null>(null);
    const [isCompleting, setIsCompleting] = useState(false);

    const handleCompleteStep = useCallback(async () => {
        if (!selectedStep) return;

        setIsCompleting(true);
        try {
            await onCompleteStep(selectedStep.id);

            // Confetti explosion! 🎉
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#fbbf24', '#f59e0b', '#d97706', '#ffffff'],
            });

            // Close modal after celebration
            setTimeout(() => {
                setSelectedStep(null);
            }, 1500);
        } catch (error) {
            console.error('Failed to complete step:', error);
        } finally {
            setIsCompleting(false);
        }
    }, [selectedStep, onCompleteStep]);

    const getStepState = (step: PathStep): 'locked' | 'active' | 'completed' => {
        if (step.isCompleted) return 'completed';
        if (step.unlockedAt) return 'active';
        return 'locked';
    };

    return (
        <div className="relative min-h-[600px]">
            {/* Header */}
            <div className="text-center mb-8">
                <motion.h2
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-bold text-white mb-2"
                >
                    Votre Chemin de Vie
                </motion.h2>
                {archetype && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-amber-400/80 text-sm"
                    >
                        Guidé par l&apos;archétype <span className="font-semibold">{archetype}</span>
                    </motion.p>
                )}
            </div>

            {/* Constellation Timeline */}
            <div className="relative max-w-md mx-auto">
                {/* Vertical Line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500/50 via-amber-400/30 to-slate-700/30 transform -translate-x-1/2" />

                {/* Steps */}
                <div className="space-y-12">
                    {steps.map((step, index) => {
                        const state = getStepState(step);
                        const isActive = state === 'active';
                        const isCompleted = state === 'completed';
                        const isLocked = state === 'locked';

                        return (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`relative flex items-center ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'
                                    }`}
                            >
                                {/* Star Node */}
                                <div className="absolute left-1/2 transform -translate-x-1/2 z-10">
                                    <StarNode
                                        state={state}
                                        dayNumber={step.dayNumber}
                                        onClick={() => !isLocked && setSelectedStep(step)}
                                    />
                                </div>

                                {/* Content Card */}
                                <motion.div
                                    whileHover={!isLocked ? { scale: 1.02 } : {}}
                                    onClick={() => !isLocked && setSelectedStep(step)}
                                    className={`
                    w-[calc(50%-40px)] p-4 rounded-xl cursor-pointer transition-all
                    ${index % 2 === 0 ? 'mr-auto pr-8' : 'ml-auto pl-8'}
                    ${isLocked
                                            ? 'opacity-40 grayscale cursor-not-allowed'
                                            : isActive
                                                ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 hover:border-amber-400/50'
                                                : 'bg-slate-800/60 border border-slate-700/50 hover:border-amber-500/30'
                                        }
                  `}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <ActionIcon type={step.actionType} />
                                        <span className="text-xs text-slate-400">Jour {step.dayNumber}</span>
                                        {isCompleted && (
                                            <span className="ml-auto text-emerald-400">
                                                <Check className="w-4 h-4" />
                                            </span>
                                        )}
                                    </div>
                                    <h4 className={`font-medium ${isActive ? 'text-amber-300' : 'text-white'}`}>
                                        {step.title}
                                    </h4>
                                    {!isLocked && (
                                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                                            {step.description}
                                        </p>
                                    )}
                                </motion.div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Floating Chat Button */}
            {onOpenChat && (
                <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: 'spring' }}
                    onClick={onOpenChat}
                    className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 text-slate-900 shadow-xl shadow-amber-500/30 flex items-center justify-center hover:from-amber-400 hover:to-amber-500 transition-colors z-40"
                    title="Parler à l'Oracle"
                >
                    <MessageCircle className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Sparkles className="w-2.5 h-2.5 text-white" />
                    </span>
                </motion.button>
            )}

            {/* Step Detail Modal */}
            <AnimatePresence>
                {selectedStep && (
                    <StepModal
                        step={selectedStep}
                        onClose={() => setSelectedStep(null)}
                        onComplete={handleCompleteStep}
                        isCompleting={isCompleting}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StarNode({
    state,
    dayNumber,
    onClick,
}: {
    state: 'locked' | 'active' | 'completed';
    dayNumber: number;
    onClick: () => void;
}) {
    const isActive = state === 'active';
    const isCompleted = state === 'completed';
    const isLocked = state === 'locked';

    return (
        <motion.button
            onClick={onClick}
            disabled={isLocked}
            animate={isActive ? { scale: [1, 1.15, 1] } : {}}
            transition={isActive ? { repeat: Infinity, duration: 2 } : {}}
            className={`
        relative w-12 h-12 rounded-full flex items-center justify-center
        transition-all cursor-pointer disabled:cursor-not-allowed
        ${isCompleted
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/40'
                    : isActive
                        ? 'bg-gradient-to-br from-amber-500/80 to-amber-600/80 shadow-xl shadow-amber-500/50'
                        : 'bg-slate-700/80 border border-slate-600'
                }
      `}
        >
            {/* Pulsing glow for active */}
            {isActive && (
                <>
                    <motion.div
                        className="absolute inset-0 rounded-full bg-amber-400/30"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    />
                    <motion.div
                        className="absolute inset-0 rounded-full bg-amber-500/20"
                        animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ repeat: Infinity, duration: 2, delay: 0.3 }}
                    />
                </>
            )}

            {isCompleted ? (
                <Star className="w-6 h-6 text-slate-900 fill-current" />
            ) : isLocked ? (
                <Lock className="w-5 h-5 text-slate-500" />
            ) : (
                <span className="text-sm font-bold text-white">{dayNumber}</span>
            )}
        </motion.button>
    );
}

function ActionIcon({ type }: { type: PathStep['actionType'] }) {
    const icons: Record<string, string> = {
        MANTRA: '🕉️',
        RITUAL: '🕯️',
        JOURNALING: '📝',
        MEDITATION: '🧘',
        REFLECTION: '💭',
    };
    return <span className="text-sm">{icons[type] || '✨'}</span>;
}

function StepModal({
    step,
    onClose,
    onComplete,
    isCompleting,
}: {
    step: PathStep;
    onClose: () => void;
    onComplete: () => void;
    isCompleting: boolean;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 w-full max-w-md border border-amber-500/30 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ActionIcon type={step.actionType} />
                            <span className="text-sm text-amber-400/80">Jour {step.dayNumber}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">{step.title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-slate-700 transition-colors text-slate-400"
                        title="Fermer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Description */}
                <div className="mb-6">
                    <p className="text-slate-300 text-sm leading-relaxed">{step.description}</p>
                </div>

                {/* Mantra/Synthesis */}
                {step.synthesis && (
                    <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
                        <span className="text-xs text-amber-400/80 uppercase tracking-wider block mb-2">
                            Mantra du Jour
                        </span>
                        <p className="text-amber-300 font-medium italic">&quot;{step.synthesis}&quot;</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    {!step.isCompleted ? (
                        <button
                            onClick={onComplete}
                            disabled={isCompleting}
                            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-bold hover:from-amber-400 hover:to-amber-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isCompleting ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Check className="w-5 h-5" />
                                    Marquer comme Complété
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="flex-1 px-6 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 font-medium text-center border border-emerald-500/30">
                            ✓ Étape Complétée
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}

export default TimelineConstellation;
