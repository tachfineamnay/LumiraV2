'use client';

import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  TrendingUp,

  DollarSign,
} from 'lucide-react';
import { DeskStats } from '../types';

interface StatsGridProps {
  stats: DeskStats;
  isLoading?: boolean;
}

const STAT_CARDS = [
  {
    id: 'pending',
    label: 'En attente',
    getValue: (s: DeskStats) => s.pendingCount + s.processingCount,
    icon: Clock,
    color: 'amber',
    gradient: 'from-amber-500 to-amber-600',
  },
  {
    id: 'validation',
    label: 'À valider',
    getValue: (s: DeskStats) => s.validationCount,
    icon: ShoppingBag,
    color: 'purple',
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    id: 'completed',
    label: 'Terminées (total)',
    getValue: (s: DeskStats) => s.completedCount,
    icon: CheckCircle,
    color: 'emerald',
    gradient: 'from-emerald-500 to-emerald-600',
  },
  {
    id: 'today',
    label: 'Aujourd\'hui',
    getValue: (s: DeskStats) => s.completedToday,
    icon: TrendingUp,
    color: 'blue',
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    id: 'revenue',
    label: 'Revenu du jour',
    getValue: (s: DeskStats) => `${(s.revenueToday / 100).toFixed(0)}€`,
    icon: DollarSign,
    color: 'green',
    gradient: 'from-green-500 to-green-600',
    large: true,
  },
];

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {STAT_CARDS.map((card, index) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`
            relative overflow-hidden rounded-xl
            bg-slate-900/50 border border-white/5
            p-4 ${card.large ? 'col-span-2 md:col-span-1' : ''}
          `}
        >
          {/* Background gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-5`} />

          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                bg-${card.color}-500/20
              `}>
                <card.icon className={`w-5 h-5 text-${card.color}-400`} />
              </div>
            </div>

            {isLoading ? (
              <div className="h-8 w-16 rounded bg-slate-800 animate-pulse" />
            ) : (
              <div className="text-2xl font-bold text-white">
                {card.getValue(stats)}
              </div>
            )}
            
            <div className="text-sm text-slate-400 mt-1">
              {card.label}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
