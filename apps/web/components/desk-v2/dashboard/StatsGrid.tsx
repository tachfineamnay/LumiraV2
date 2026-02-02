'use client';

import { motion } from 'framer-motion';
import {
  ShoppingBag,
  Clock,
  CheckCircle,
  TrendingUp,
  DollarSign,
  LucideIcon,
} from 'lucide-react';
import { DeskStats } from '../types';

interface StatsGridProps {
  stats: DeskStats;
  isLoading?: boolean;
}

// Static color classes to avoid Tailwind purge issues
const COLOR_CLASSES = {
  amber: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    gradient: 'from-amber-500 to-amber-600',
  },
  purple: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    gradient: 'from-purple-500 to-purple-600',
  },
  emerald: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    gradient: 'from-emerald-500 to-emerald-600',
  },
  blue: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    gradient: 'from-blue-500 to-blue-600',
  },
  green: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    gradient: 'from-green-500 to-green-600',
  },
} as const;

type ColorKey = keyof typeof COLOR_CLASSES;

interface StatCard {
  id: string;
  label: string;
  getValue: (s: DeskStats) => number | string;
  icon: LucideIcon;
  color: ColorKey;
  large?: boolean;
}

const STAT_CARDS: StatCard[] = [
  {
    id: 'pending',
    label: 'En attente',
    getValue: (s) => s.pendingCount + s.processingCount,
    icon: Clock,
    color: 'amber',
  },
  {
    id: 'validation',
    label: 'À valider',
    getValue: (s) => s.validationCount,
    icon: ShoppingBag,
    color: 'purple',
  },
  {
    id: 'completed',
    label: 'Terminées (total)',
    getValue: (s) => s.completedCount,
    icon: CheckCircle,
    color: 'emerald',
  },
  {
    id: 'today',
    label: "Aujourd'hui",
    getValue: (s) => s.completedToday,
    icon: TrendingUp,
    color: 'blue',
  },
  {
    id: 'revenue',
    label: 'Revenu du jour',
    getValue: (s) => `${(s.revenueToday / 100).toFixed(0)}€`,
    icon: DollarSign,
    color: 'green',
    large: true,
  },
];

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {STAT_CARDS.map((card, index) => {
        const colors = COLOR_CLASSES[card.color];
        const Icon = card.icon;
        
        return (
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
            <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-5`} />

            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors.bg}`}>
                  <Icon className={`w-5 h-5 ${colors.text}`} />
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
        );
      })}
    </div>
  );
}
