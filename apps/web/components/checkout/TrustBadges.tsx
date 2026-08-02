'use client';

import { motion } from 'framer-motion';
import { Shield, Zap, RefreshCw } from 'lucide-react';

const badges = [
  {
    icon: Shield,
    title: 'Paiement 100% sécurisé',
    description: 'Cryptage SSL',
  },
  {
    icon: Zap,
    title: 'Accès immédiat',
    description: 'Dès confirmation',
  },
  {
    icon: RefreshCw,
    title: 'Satisfait ou remboursé',
    description: 'Garantie 14 jours',
  },
];

export function TrustBadges() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="grid grid-cols-3 gap-3"
    >
      {badges.map((badge, index) => (
        <motion.div
          key={badge.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
          className="backdrop-blur-sm rounded-xl p-3 text-center group transition-all duration-300 cursor-default"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(130,180,255,0.14)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(130,180,255,0.28)';
            (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.07)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(130,180,255,0.14)';
            (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
          }}
        >
          <div
            className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 transition-colors"
            style={{ background: 'rgba(100,160,255,0.1)' }}
          >
            <badge.icon className="w-5 h-5" style={{ color: 'rgba(140,190,255,0.8)' }} />
          </div>
          <p
            className="text-xs font-medium leading-tight"
            style={{ color: 'rgba(210,230,255,0.85)' }}
          >
            {badge.title}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'rgba(150,190,255,0.45)' }}>
            {badge.description}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}
