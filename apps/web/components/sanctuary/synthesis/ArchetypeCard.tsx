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
            className="h-full rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 p-6 flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span className="text-xs uppercase tracking-widest text-slate-400">
                    Votre Archétype
                </span>
            </div>

            {/* Archetype Name */}
            <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl md:text-4xl font-playfair italic text-amber-400 mb-4"
            >
                {archetype}
            </motion.h2>

            {/* Emotional State */}
            {emotionalState && (
                <p className="text-slate-300 text-sm mb-4">
                    État actuel : <span className="text-amber-300">{emotionalState}</span>
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
                            className="px-3 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20"
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
