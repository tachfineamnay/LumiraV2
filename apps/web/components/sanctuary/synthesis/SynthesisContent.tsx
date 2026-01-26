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
            className="rounded-2xl bg-abyss-600/40 border border-white/[0.06] p-6 md:p-8 backdrop-blur-sm"
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-horizon-400/20 flex items-center justify-center border border-horizon-400/30">
                    <BookOpen className="w-5 h-5 text-horizon-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-stellar-100">La Synthèse de Votre Âme</h3>
                    <p className="text-xs text-stellar-500">Révélation de l&apos;Oracle</p>
                </div>
            </div>

            {/* Synthesis Text */}
            <div className="prose prose-invert max-w-none">
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-stellar-300 leading-relaxed text-base md:text-lg font-playfair"
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
                    className="mt-8 p-4 rounded-xl bg-gradient-to-r from-horizon-400/10 via-horizon-500/5 to-horizon-400/10 border border-horizon-400/20"
                >
                    <span className="text-xs uppercase tracking-widest text-horizon-400/80 block mb-2">
                        Votre Mission de Vie
                    </span>
                    <p className="text-horizon-200 font-medium leading-relaxed">
                        {lifeMission}
                    </p>
                </motion.div>
            )}
        </motion.div>
    );
}

export default SynthesisContent;
