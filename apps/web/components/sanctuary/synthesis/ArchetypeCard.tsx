'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface ArchetypeCardProps {
    archetype: string;
    keywords?: string[];
    emotionalState?: string;
    keyBlockage?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ArchetypeCard({
    archetype,
    keywords = [],
    emotionalState,
    keyBlockage,
}: ArchetypeCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="h-full rounded-2xl bg-abyss-600/40 border border-white/[0.06] p-6 flex flex-col backdrop-blur-sm"
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-horizon-400" />
                <span className="text-xs uppercase tracking-widest text-stellar-400">
                    Votre Archétype
                </span>
            </div>

            {/* Archetype Name */}
            <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl md:text-4xl font-playfair italic text-gradient-gold mb-4"
            >
                {archetype}
            </motion.h2>

            {/* Emotional State */}
            {emotionalState && (
                <p className="text-stellar-300 text-sm mb-4">
                    État actuel : <span className="text-horizon-300">{emotionalState}</span>
                </p>
            )}

            {/* Keywords Tags */}
            {keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-auto">
                    {keywords.slice(0, 5).map((keyword, index) => (
                        <motion.span
                            key={keyword}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 + index * 0.1 }}
                            className="px-3 py-1 text-xs font-medium rounded-full bg-horizon-400/10 text-horizon-300 border border-horizon-400/20"
                        >
                            {keyword}
                        </motion.span>
                    ))}
                </div>
            )}

            {/* Key Blockage (if any) */}
            {keyBlockage && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20"
                >
                    <span className="text-xs uppercase tracking-wider text-rose-400/80 block mb-1">
                        Blocage à Transcender
                    </span>
                    <p className="text-sm text-rose-300">{keyBlockage}</p>
                </motion.div>
            )}
        </motion.div>
    );
}

export default ArchetypeCard;
