'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  CheckCircle,
  Sparkles,
  MessageSquare,
  Clock,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ActivityItem } from '../types';

interface ActivityFeedProps {
  items?: ActivityItem[];
  isLoading?: boolean;
}

const ICON_MAP = {
  order_new: ShoppingBag,
  order_completed: CheckCircle,
  generation_done: Sparkles,
  client_message: MessageSquare,
};

const COLOR_MAP = {
  order_new: 'text-amber-600 bg-amber-500/15',
  order_completed: 'text-emerald-600 bg-emerald-500/15',
  generation_done: 'text-amber-600 bg-amber-500/15',
  client_message: 'text-blue-600 bg-blue-500/15',
};

export function ActivityFeed({ items = [], isLoading = false }: ActivityFeedProps) {
  return (
    <div className="bg-desk-surface rounded-lg border border-desk-border overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-desk-border">
        <h3 className="text-xs font-medium text-desk-muted uppercase tracking-wide">Activité récente</h3>
      </div>

      {/* Feed */}
      <div className="divide-y divide-desk-border max-h-[360px] overflow-y-auto">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-desk-subtle">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucune activité récente</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map((item, index) => {
              const Icon = ICON_MAP[item.type] || Clock;
              const colorClass = COLOR_MAP[item.type] || 'text-desk-muted bg-desk-card';

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-start gap-3 px-3 py-2.5 hover:bg-desk-card transition-colors"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-desk-text">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-desk-subtle mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-desk-subtle flex-shrink-0">
                    {formatDistanceToNow(new Date(item.timestamp), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
