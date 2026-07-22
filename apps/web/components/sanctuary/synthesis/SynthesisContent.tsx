'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { MysticAudioPlayer } from '../../ui/MysticAudioPlayer';

// =============================================================================
// TYPES
// =============================================================================

interface SynthesisContentProps {
  synthesis: string;
  lifeMission?: string;
  audioUrl?: string | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SynthesisContent({ synthesis, lifeMission, audioUrl }: SynthesisContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl bg-brume-800/35 border border-ivoire-500/[0.05] p-6 md:p-8 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-ivoire-400/12 flex items-center justify-center border border-ivoire-400/20">
          <BookOpen className="w-5 h-5 text-ivoire-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-ivoire-100">La Synthèse de Votre Âme</h3>
          <p className="text-xs text-brume-300">Révélation de l&apos;Oracle</p>
        </div>
      </div>

      {/* Audio Player */}
      {audioUrl !== undefined && (
        <div className="mb-6">
          <MysticAudioPlayer
            audioUrl={audioUrl}
            loadingText="Audio de la synthèse en préparation..."
          />
        </div>
      )}

      {/* Synthesis Text */}
      <div className="prose prose-invert max-w-none">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-ivoire-200 leading-relaxed text-base md:text-lg font-playfair"
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
          className="mt-8 p-4 rounded-xl bg-gradient-to-r from-ivoire-400/8 via-ivoire-500/4 to-ivoire-400/8 border border-ivoire-400/15"
        >
          <span className="text-xs uppercase tracking-widest text-ivoire-400/80 block mb-2">
            Votre Mission de Vie
          </span>
          <p className="text-ivoire-300 font-medium leading-relaxed">{lifeMission}</p>
        </motion.div>
      )}
    </motion.div>
  );
}

export default SynthesisContent;
