'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface SynthesisContentProps {
    synthesis: string;
    lifeMission?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SynthesisContent({ synthesis, lifeMission }: SynthesisContentProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 p-6 md:p-8"
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-white">La Synthèse de Votre Âme</h3>
                    <p className="text-xs text-slate-500">Révélation de l&apos;Oracle</p>
                </div>
            </div>

            {/* Synthesis Text */}
            <div className="prose prose-invert prose-amber max-w-none">
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-slate-300 leading-relaxed text-base md:text-lg font-serif"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                >
                    {synthesis}
                </motion.p>
            </div>

            {/* Life Mission */}
            {lifeMission && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-amber-500/10 border border-amber-500/20"
                >
                    <span className="text-xs uppercase tracking-widest text-amber-400/80 block mb-2">
                        Votre Mission de Vie
                    </span>
                    <p className="text-amber-200 font-medium leading-relaxed">
                        {lifeMission}
                    </p>
                </motion.div>
            )}
        </motion.div>
    );
}

export default SynthesisContent;
