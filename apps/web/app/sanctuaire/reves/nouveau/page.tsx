'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../../../lib/api';

// =============================================================================
// EMOTIONS
// =============================================================================

const EMOTIONS = [
    { key: 'paix', emoji: '☮️', label: 'Paix' },
    { key: 'joie', emoji: '✨', label: 'Joie' },
    { key: 'peur', emoji: '😰', label: 'Peur' },
    { key: 'confusion', emoji: '🌀', label: 'Confusion' },
    { key: 'tristesse', emoji: '🌧️', label: 'Tristesse' },
    { key: 'colère', emoji: '🔥', label: 'Colère' },
    { key: 'amour', emoji: '💜', label: 'Amour' },
    { key: 'surprise', emoji: '⚡', label: 'Surprise' },
];

// =============================================================================
// DREAM LOADER — Optimistic UI while the AI interprets
// =============================================================================

function DreamLoader() {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-abyss-900/95 backdrop-blur-md"
        >
            <div className="text-center max-w-sm px-6">
                {/* Animated moon */}
                <motion.div
                    animate={{
                        scale: [1, 1.15, 1],
                        rotate: [0, 10, -10, 0],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-serenity-400/30 to-purple-500/20 border border-serenity-400/30 flex items-center justify-center"
                >
                    <Moon className="w-12 h-12 text-serenity-300" />
                </motion.div>

                {/* Pulsing text */}
                <motion.p
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-lg font-playfair italic text-serenity-300 mb-4"
                >
                    Lumira explore ton monde onirique...
                </motion.p>

                <p className="text-xs text-stellar-600">
                    Interprétation en cours · Quelques instants
                </p>

                {/* Progress dots */}
                <div className="flex justify-center gap-2 mt-6">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                            className="w-2 h-2 rounded-full bg-serenity-400"
                        />
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function NewDreamPage() {
    const router = useRouter();
    const [content, setContent] = useState('');
    const [emotion, setEmotion] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const charCount = content.length;
    const isValid = charCount >= 20 && charCount <= 2000;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid || isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const res = await api.post('/dreams', {
                content,
                ...(emotion ? { emotion } : {}),
            });

            const dreamId = res.data.dream?.id;
            if (dreamId) {
                router.push(`/sanctuaire/reves/${dreamId}`);
            } else {
                router.push('/sanctuaire/reves');
            }
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 429) {
                setError('Limite atteinte : maximum 2 rêves par jour. Revenez demain.');
            } else {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                setError(msg || 'Erreur lors de l\'envoi. Veuillez réessayer.');
            }
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Dream Loader Overlay */}
            <AnimatePresence>
                {isSubmitting && <DreamLoader />}
            </AnimatePresence>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
                {/* Back link */}
                <Link
                    href="/sanctuaire/reves"
                    className="inline-flex items-center gap-2 text-sm text-stellar-500 hover:text-stellar-300 transition-colors mb-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Journal des Rêves
                </Link>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl md:text-3xl font-playfair italic text-white flex items-center gap-3">
                        <Moon className="w-7 h-7 text-serenity-400" />
                        Consigner un rêve
                    </h1>
                    <p className="text-stellar-500 text-sm mt-2">
                        Décrivez votre rêve le plus fidèlement possible. Lumira en décodera les messages cachés.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Textarea */}
                    <div>
                        <label className="block text-sm font-medium text-stellar-300 mb-2">
                            Votre rêve
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="J'étais dans une forêt sombre, une lumière dorée apparaissait au loin..."
                            rows={8}
                            maxLength={2000}
                            className="w-full rounded-xl bg-abyss-600/50 border border-white/10 text-stellar-200 placeholder-stellar-600 px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-serenity-500/50 focus:ring-1 focus:ring-serenity-500/30 transition-colors resize-none"
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className={`text-xs ${charCount < 20 ? 'text-amber-400' : charCount > 1900 ? 'text-rose-400' : 'text-stellar-600'}`}>
                                {charCount < 20 ? `${20 - charCount} caractères minimum restants` : `${charCount}/2000`}
                            </span>
                        </div>
                    </div>

                    {/* Emotion selector */}
                    <div>
                        <label className="block text-sm font-medium text-stellar-300 mb-3">
                            Émotion dominante <span className="text-stellar-600">(optionnel)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {EMOTIONS.map((em) => (
                                <button
                                    key={em.key}
                                    type="button"
                                    onClick={() => setEmotion(emotion === em.key ? null : em.key)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm transition-all duration-200 ${
                                        emotion === em.key
                                            ? 'bg-serenity-500/20 border border-serenity-400/40 text-serenity-300'
                                            : 'bg-white/5 border border-white/10 text-stellar-400 hover:bg-white/10 hover:text-stellar-300'
                                    }`}
                                >
                                    <span>{em.emoji}</span>
                                    <span>{em.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm"
                        >
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </motion.div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={!isValid || isSubmitting}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-serenity-500 to-serenity-600 text-white font-semibold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:from-serenity-400 hover:to-serenity-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(94,234,212,0.3)]"
                    >
                        <Sparkles className="w-5 h-5" />
                        Soumettre à Lumira
                    </button>
                </form>
            </div>
        </>
    );
}
