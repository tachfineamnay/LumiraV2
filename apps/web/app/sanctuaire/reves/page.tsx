'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Plus, Loader2, Sparkles, Calendar, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import api from '../../../lib/api';

// =============================================================================
// TYPES
// =============================================================================

interface Dream {
    id: string;
    content: string;
    emotion: string | null;
    symbols: string[];
    interpretation: string;
    createdAt: string;
}

// =============================================================================
// EMOTION MAP
// =============================================================================

const EMOTION_CONFIG: Record<string, { emoji: string; color: string }> = {
    paix: { emoji: '☮️', color: 'text-serenity-400' },
    joie: { emoji: '✨', color: 'text-amber-400' },
    peur: { emoji: '😰', color: 'text-purple-400' },
    confusion: { emoji: '🌀', color: 'text-blue-400' },
    tristesse: { emoji: '🌧️', color: 'text-slate-400' },
    colère: { emoji: '🔥', color: 'text-rose-400' },
    amour: { emoji: '💜', color: 'text-pink-400' },
    surprise: { emoji: '⚡', color: 'text-yellow-400' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function DreamJournalPage() {
    const [dreams, setDreams] = useState<Dream[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDreams = async () => {
            try {
                const res = await api.get('/dreams');
                setDreams(res.data.dreams ?? []);
            } catch {
                setError('Impossible de charger vos rêves.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchDreams();
    }, []);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    // ── Loading ──────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-serenity-400 animate-spin" />
            </div>
        );
    }

    // ── Error ────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
                <p className="text-rose-400 mb-4">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-xl bg-white/5 text-stellar-300 border border-white/10 hover:bg-white/10 transition-colors"
                >
                    Réessayer
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-playfair italic text-white flex items-center gap-3">
                        <Moon className="w-7 h-7 text-serenity-400" />
                        Journal des Rêves
                    </h1>
                    <p className="text-stellar-500 text-sm mt-1">
                        {dreams.length} rêve{dreams.length !== 1 ? 's' : ''} enregistré{dreams.length !== 1 ? 's' : ''}
                    </p>
                </div>

                <Link
                    href="/sanctuaire/reves/nouveau"
                    className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-serenity-500 to-serenity-600 text-white font-semibold hover:from-serenity-400 hover:to-serenity-500 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(94,234,212,0.3)]"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nouveau Rêve</span>
                    <span className="sm:hidden">Ajouter</span>
                </Link>
            </div>

            {/* Empty state */}
            {dreams.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16"
                >
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-serenity-500/10 border border-serenity-500/20 flex items-center justify-center">
                        <Moon className="w-10 h-10 text-serenity-400/60" />
                    </div>
                    <h2 className="text-xl font-playfair italic text-white mb-3">
                        Votre journal est vierge
                    </h2>
                    <p className="text-stellar-500 max-w-sm mx-auto mb-8 text-sm leading-relaxed">
                        Commencez à consigner vos rêves et Lumira vous révélera les messages cachés de votre inconscient.
                    </p>
                    <Link
                        href="/sanctuaire/reves/nouveau"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-serenity-500 to-serenity-600 text-white font-semibold hover:from-serenity-400 hover:to-serenity-500 transition-all"
                    >
                        <Sparkles className="w-4 h-4" />
                        Consigner mon premier rêve
                    </Link>
                </motion.div>
            )}

            {/* Dream list */}
            <div className="space-y-4">
                <AnimatePresence>
                    {dreams.map((dream, i) => {
                        const emotionCfg = dream.emotion ? EMOTION_CONFIG[dream.emotion] : null;

                        return (
                            <motion.div
                                key={dream.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <Link href={`/sanctuaire/reves/${dream.id}`}>
                                    <div className="group p-5 rounded-2xl bg-abyss-600/50 border border-white/[0.06] hover:border-serenity-500/30 hover:bg-abyss-600/70 transition-all duration-300 cursor-pointer">
                                        {/* Top row: date + emotion */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2 text-xs text-stellar-500">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>{formatDate(dream.createdAt)}</span>
                                                <span className="text-stellar-600">·</span>
                                                <span>{formatTime(dream.createdAt)}</span>
                                            </div>
                                            {emotionCfg && (
                                                <span className={`text-xs ${emotionCfg.color} flex items-center gap-1`}>
                                                    <span>{emotionCfg.emoji}</span>
                                                    <span className="capitalize">{dream.emotion}</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Content preview */}
                                        <p className="text-sm text-stellar-300 line-clamp-2 mb-3 leading-relaxed">
                                            {dream.content}
                                        </p>

                                        {/* Symbols + arrow */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-wrap gap-1.5">
                                                {dream.symbols.slice(0, 4).map((sym) => (
                                                    <span
                                                        key={sym}
                                                        className="px-2.5 py-1 rounded-full bg-serenity-500/20 text-serenity-400 text-[11px] font-medium"
                                                    >
                                                        {sym}
                                                    </span>
                                                ))}
                                                {dream.symbols.length > 4 && (
                                                    <span className="px-2.5 py-1 rounded-full bg-white/5 text-stellar-500 text-[11px]">
                                                        +{dream.symbols.length - 4}
                                                    </span>
                                                )}
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-stellar-600 group-hover:text-serenity-400 transition-colors" />
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
}
