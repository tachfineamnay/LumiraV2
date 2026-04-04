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
    bg: 'bg-amber-500/15',
    text: 'text-amber-600',
  },
  emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-600',
  },
  blue: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-500/15',
    text: 'text-green-600',
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
    color: 'amber',
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
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
              relative overflow-hidden rounded-lg
              bg-desk-surface border border-desk-border
              p-3 ${card.large ? 'col-span-2 md:col-span-1' : ''}
            `}
          >
            {/* Background accent */}
            <div className={`absolute top-0 left-0 w-1 h-full ${colors.bg}`} />

            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg}`}>
                  <Icon className={`w-4 h-4 ${colors.text}`} />
                </div>
              </div>

              {isLoading ? (
                <div className="h-7 w-14 rounded bg-desk-card animate-pulse" />
              ) : (
                <div className="text-xl font-bold text-desk-text">
                  {card.getValue(stats)}
                </div>
              )}
              
              <div className="text-sm text-desk-muted mt-1">
                {card.label}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
