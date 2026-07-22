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
  variant = 'chat',
}: SubscriptionLockProps) {
  // Use quota for display when available
  const displayTotal = quota;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-ivoire-400/12 bg-gradient-to-br from-brume-700/25 via-lavande-500/8 to-brume-800/20 p-6 backdrop-blur-sm"
    >
      {/* Decorative glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-ivoire-400/6 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-lavande-400/5 rounded-full blur-3xl" />

      <div className="relative z-10 text-center space-y-4">
        {/* Icon */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-ivoire-400/12 to-ivoire-500/10 border border-ivoire-400/18"
        >
          <Lock className="w-7 h-7 text-ivoire-400" />
        </motion.div>

        {/* Title */}
        <h3 className="text-xl font-playfair italic text-ivoire-200">
          L'Oracle doit se reposer...
        </h3>

        {/* Description */}
        <p className="text-sm text-ivoire-100/60 max-w-sm mx-auto leading-relaxed">
          {variant === 'chat' ? (
            <>
              Vous avez utilisé vos{' '}
              <span className="text-ivoire-400 font-semibold">
                {messagesUsed}/{displayTotal}
              </span>{' '}
              messages gratuits. Rejoignez le{' '}
              <span className="text-ivoire-400 font-semibold">Cercle des Initiés</span> pour des
              échanges illimités avec l'Oracle.
            </>
          ) : (
            <>
              Cette fonctionnalité est réservée aux membres du{' '}
              <span className="text-ivoire-400 font-semibold">Cercle des Initiés</span>.
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brume-800/25 border border-ivoire-500/8 text-xs text-ivoire-100/70"
            >
              <Icon className="w-3.5 h-3.5 text-ivoire-400/70" />
              {label}
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <Link
          href="/sanctuaire/abonnement"
          className="inline-flex items-center gap-2 mt-4 px-6 py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-ivoire-400 to-horizon-400 text-abyss-900 font-semibold hover:from-ivoire-300 hover:to-horizon-300 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(240,232,208,0.15)]"
        >
          <Crown className="w-4 h-4" />
          Rejoindre le Cercle
        </Link>

        {/* Subtle reminder */}
        <p className="text-[10px] text-ivoire-100/30 pt-2">Annulation possible à tout moment</p>
      </div>
    </motion.div>
  );
}
