'use client';


import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  CheckCircle,
  Sparkles,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ActivityItem } from '../types';

interface ActivityFeedProps {
  items?: ActivityItem[];
}

const ICON_MAP = {
  order_new: ShoppingBag,
  order_completed: CheckCircle,
  generation_done: Sparkles,
  client_message: MessageSquare,
};

const COLOR_MAP = {
  order_new: 'text-amber-400 bg-amber-500/20',
  order_completed: 'text-emerald-400 bg-emerald-500/20',
  generation_done: 'text-purple-400 bg-purple-500/20',
  client_message: 'text-blue-400 bg-blue-500/20',
};

export function ActivityFeed({ items = [] }: ActivityFeedProps) {
  // Mock items for demo if empty
  const displayItems = items.length > 0 ? items : MOCK_ITEMS;

  return (
    <div className="bg-slate-900/50 rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white">Activité récente</h3>
      </div>

      {/* Feed */}
      <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
        <AnimatePresence initial={false}>
          {displayItems.map((item, index) => {
            const Icon = ICON_MAP[item.type] || Clock;
            const colorClass = COLOR_MAP[item.type] || 'text-slate-400 bg-slate-500/20';

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 p-4 hover:bg-white/5 transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                  )}
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {formatDistanceToNow(new Date(item.timestamp), {
                    addSuffix: true,
                    locale: fr,
                  })}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {displayItems.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune activité récente</p>
          </div>
        )}
      </div>
    </div>
  );
}

const MOCK_ITEMS: ActivityItem[] = [
  {
    id: '1',
    type: 'order_new',
    title: 'Nouvelle commande LUM-2026-0142',
    description: 'Marie D. - Niveau Mystique',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    type: 'generation_done',
    title: 'Génération terminée',
    description: 'LUM-2026-0141 - Pierre L.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'order_completed',
    title: 'Lecture scellée',
    description: 'LUM-2026-0139 - Sophie M.',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'order_new',
    title: 'Nouvelle commande LUM-2026-0140',
    description: 'Jean P. - Niveau Intégral',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];
