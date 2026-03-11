'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, ArrowLeft, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api from '../../../../lib/api';

// =============================================================================
// EMOTION CONFIG
// =============================================================================

const EMOTION_CONFIG: Record<string, { emoji: string; label: string }> = {
    paix: { emoji: '☮️', label: 'Paix' },
    joie: { emoji: '✨', label: 'Joie' },
    peur: { emoji: '😰', label: 'Peur' },
    confusion: { emoji: '🌀', label: 'Confusion' },
    tristesse: { emoji: '🌧️', label: 'Tristesse' },
    colère: { emoji: '🔥', label: 'Colère' },
    amour: { emoji: '💜', label: 'Amour' },
    surprise: { emoji: '⚡', label: 'Surprise' },
};

// =============================================================================
// TYPES
// =============================================================================

interface Dream {
    id: string;
    content: string;
    emotion?: string;
    interpretation: string;
    symbols: string[];
    createdAt: string;
}

interface Interpretation {
    summary?: string;
    symbols?: Array<{ name: string; meaning: string }>;
    guidance?: string;
    message?: string;
    [key: string]: unknown;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DreamDetailPage() {
    const params = useParams();
    const dreamId = params.id as string;

    const [dream, setDream] = useState<Dream | null>(null);
    const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!dreamId) return;

        const fetchDream = async () => {
            try {
                const res = await api.get(`/dreams/${dreamId}`);
                const d = res.data;
                setDream(d);

                // Parse interpretation JSON
                if (d.interpretation) {
                    try {
                        setInterpretation(JSON.parse(d.interpretation));
                    } catch {
                        // If not parseable JSON, wrap as plain text
                        setInterpretation({ message: d.interpretation });
                    }
                }
            } catch {
                setError('Impossible de charger ce rêve.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDream();
    }, [dreamId]);

    // Loading
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-serenity-400 animate-spin" />
            </div>
        );
    }

    // Error
    if (error || !dream) {
        return (
            <div className="max-w-2xl mx-auto px-4 py-12 text-center">
                <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-4" />
                <p className="text-stellar-400">{error || 'Rêve introuvable.'}</p>
                <Link
                    href="/sanctuaire/reves"
                    className="inline-flex items-center gap-2 mt-4 text-sm text-serenity-400 hover:text-serenity-300 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour au journal
                </Link>
            </div>
        );
    }

    const emotionInfo = dream.emotion ? EMOTION_CONFIG[dream.emotion] : null;
    const date = new Date(dream.createdAt);

    return (
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
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <Moon className="w-6 h-6 text-serenity-400" />
                    <time className="text-sm text-stellar-500">
                        {date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {' · '}
                        {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </time>
                </div>

                <h1 className="text-2xl md:text-3xl font-playfair italic text-white">
                    Rêve du {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                </h1>

                {emotionInfo && (
                    <span className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-sm bg-serenity-500/15 text-serenity-300 border border-serenity-400/20">
                        <span>{emotionInfo.emoji}</span>
                        {emotionInfo.label}
                    </span>
                )}
            </motion.div>

            {/* Dream content */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="p-5 rounded-2xl bg-abyss-600/50 border border-white/5 mb-6"
            >
                <h2 className="text-xs uppercase tracking-wider text-stellar-500 mb-3">Récit du rêve</h2>
                <p className="text-stellar-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {dream.content}
                </p>
            </motion.div>

            {/* Symbols */}
            {dream.symbols && dream.symbols.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-6"
                >
                    <h2 className="text-xs uppercase tracking-wider text-stellar-500 mb-3">Symboles détectés</h2>
                    <div className="flex flex-wrap gap-2">
                        {dream.symbols.map((symbol) => (
                            <span
                                key={symbol}
                                className="px-3 py-1.5 rounded-full text-xs bg-serenity-500/20 text-serenity-400 border border-serenity-500/10"
                            >
                                {symbol}
                            </span>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Interpretation */}
            {interpretation && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-5 rounded-2xl bg-gradient-to-br from-serenity-500/10 to-purple-500/5 border border-serenity-400/15 mb-6"
                >
                    <h2 className="text-sm font-semibold text-serenity-300 flex items-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4" />
                        Interprétation de Lumira
                    </h2>

                    {/* Summary */}
                    {interpretation.summary && (
                        <div className="mb-4">
                            <p className="text-stellar-300 text-sm leading-relaxed">
                                {interpretation.summary}
                            </p>
                        </div>
                    )}

                    {/* Detailed symbols from interpretation */}
                    {interpretation.symbols && interpretation.symbols.length > 0 && (
                        <div className="mb-4 space-y-3">
                            <h3 className="text-xs uppercase tracking-wider text-stellar-500">Analyse des symboles</h3>
                            {interpretation.symbols.map((s, i) => (
                                <div key={i} className="pl-3 border-l-2 border-serenity-500/30">
                                    <p className="text-sm font-medium text-serenity-300">{s.name}</p>
                                    <p className="text-sm text-stellar-400 mt-0.5">{s.meaning}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Guidance */}
                    {interpretation.guidance && (
                        <div className="pt-4 border-t border-white/5">
                            <h3 className="text-xs uppercase tracking-wider text-stellar-500 mb-2">Guidance</h3>
                            <p className="text-stellar-300 text-sm leading-relaxed italic">
                                {interpretation.guidance}
                            </p>
                        </div>
                    )}

                    {/* Plain text fallback */}
                    {interpretation.message && !interpretation.summary && !interpretation.guidance && (
                        <p className="text-stellar-300 text-sm leading-relaxed whitespace-pre-wrap">
                            {interpretation.message}
                        </p>
                    )}
                </motion.div>
            )}
        </div>
    );
}
