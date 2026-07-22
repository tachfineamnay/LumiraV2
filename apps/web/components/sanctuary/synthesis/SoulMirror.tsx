'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { User } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface SoulMirrorProps {
  photoUrl?: string | null;
  userName?: string;
  archetype?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SoulMirror({ photoUrl, userName, archetype }: SoulMirrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
      className="relative h-full min-h-[300px] rounded-2xl overflow-hidden bg-gradient-to-br from-brume-800 to-abyss-800 border border-brume-600/30"
    >
      {/* Glowing Aura Background */}
      <div className="absolute inset-0 opacity-60">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%]">
          <div className="absolute inset-0 bg-gradient-radial from-ivoire-400/12 via-brume-500/5 to-transparent animate-pulse" />
        </div>
      </div>

      {/* Photo or Placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        {photoUrl ? (
          <div className="relative w-48 h-48 md:w-56 md:h-56">
            {/* Outer glow ring */}
            <motion.div
              className="absolute -inset-4 rounded-full bg-gradient-to-br from-ivoire-400/18 to-brume-500/8 blur-xl"
              animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ repeat: Infinity, duration: 4 }}
            />
            {/* Inner glow ring */}
            <motion.div
              className="absolute -inset-2 rounded-full bg-gradient-to-br from-ivoire-400/25 to-ivoire-400/15 blur-md"
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ repeat: Infinity, duration: 3, delay: 0.5 }}
            />
            {/* Photo */}
            <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-ivoire-400/25 shadow-xl shadow-ivoire-400/12">
              <Image src={photoUrl} alt={userName || 'Soul Mirror'} fill className="object-cover" />
            </div>
          </div>
        ) : (
          <div className="w-32 h-32 rounded-full bg-brume-700/30 flex items-center justify-center border border-brume-500/25">
            <User className="w-16 h-16 text-brume-300" />
          </div>
        )}
      </div>

      {/* Name and Archetype Label */}
      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#050A18] via-[#050A18]/80 to-transparent">
        <div className="text-center">
          {archetype && (
            <span className="text-xs uppercase tracking-widest text-ivoire-400/80 block mb-1">
              {archetype}
            </span>
          )}
          {userName && <h3 className="text-lg font-medium text-ivoire-100">{userName}</h3>}
        </div>
      </div>

      {/* Decorative corner elements */}
      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-ivoire-400/18 rounded-tl-lg" />
      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-ivoire-400/18 rounded-tr-lg" />
      <div className="absolute bottom-16 left-4 w-6 h-6 border-b-2 border-l-2 border-ivoire-400/18 rounded-bl-lg" />
      <div className="absolute bottom-16 right-4 w-6 h-6 border-b-2 border-r-2 border-ivoire-400/18 rounded-br-lg" />
    </motion.div>
  );
}

export default SoulMirror;
