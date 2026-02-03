'use client';

import { motion } from 'framer-motion';
import { Lock, Sparkles, Crown, MessageCircle } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionLockProps {
  messagesUsed?: number;
  quota?: number;
  variant?: 'chat' | 'feature';
}

export function SubscriptionLock({ 
  messagesUsed = 3, 
  quota = 3,
  variant = 'chat' 
}: SubscriptionLockProps) {
  // Use quota for display when available
  const displayTotal = quota;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-900/20 via-purple-900/20 to-indigo-900/20 p-6 backdrop-blur-sm"
    >
      {/* Decorative glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 text-center space-y-4">
        {/* Icon */}
        <motion.div
          animate={{ 
            scale: [1, 1.05, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30"
        >
          <Lock className="w-7 h-7 text-amber-400" />
        </motion.div>

        {/* Title */}
        <h3 className="text-xl font-playfair italic text-amber-100">
          L'Oracle doit se reposer...
        </h3>

        {/* Description */}
        <p className="text-sm text-white/60 max-w-sm mx-auto leading-relaxed">
          {variant === 'chat' ? (
            <>
              Vous avez utilisé vos <span className="text-amber-400 font-semibold">{messagesUsed}/{displayTotal}</span> messages 
              gratuits. Rejoignez le <span className="text-amber-400 font-semibold">Cercle des Initiés</span> pour 
              des échanges illimités avec l'Oracle.
            </>
          ) : (
            <>
              Cette fonctionnalité est réservée aux membres du{' '}
              <span className="text-amber-400 font-semibold">Cercle des Initiés</span>.
            </>
          )}
        </p>

        {/* Benefits preview */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {[
            { icon: MessageCircle, label: 'Chat illimité' },
            { icon: Sparkles, label: 'Guidances exclusives' },
            { icon: Crown, label: 'Accès prioritaire' },
          ].map(({ icon: Icon, label }) => (
            <div 
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/70"
            >
              <Icon className="w-3.5 h-3.5 text-amber-400/70" />
              {label}
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Link
          href="/sanctuaire/settings/billing"
          className="inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-abyss-900 font-semibold hover:from-amber-400 hover:to-amber-500 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]"
        >
          <Crown className="w-4 h-4" />
          Rejoindre le Cercle
        </Link>

        {/* Subtle reminder */}
        <p className="text-[10px] text-white/30 pt-2">
          Annulation possible à tout moment
        </p>
      </div>
    </motion.div>
  );
}
