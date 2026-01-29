'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { OrderCard } from './OrderCard';
import { KanbanColumn as KanbanColumnType, Order } from '../types';

interface KanbanColumnProps {
  column: KanbanColumnType;
  orders: Order[];
  isLoading?: boolean;
}

const COLUMN_COLORS = {
  amber: {
    header: 'from-amber-500/20 to-amber-600/5',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/20 text-amber-400',
    dot: 'bg-amber-500',
  },
  blue: {
    header: 'from-blue-500/20 to-blue-600/5',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500/20 text-blue-400',
    dot: 'bg-blue-500',
  },
  purple: {
    header: 'from-purple-500/20 to-purple-600/5',
    border: 'border-purple-500/20',
    badge: 'bg-purple-500/20 text-purple-400',
    dot: 'bg-purple-500',
  },
  green: {
    header: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/20 text-emerald-400',
    dot: 'bg-emerald-500',
  },
};

export function KanbanColumn({ column, orders, isLoading }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const colors = COLUMN_COLORS[column.color as keyof typeof COLUMN_COLORS] || COLUMN_COLORS.amber;

  return (
    <div
      ref={setNodeRef}
      className={`
        w-80 flex-shrink-0 flex flex-col rounded-xl
        bg-slate-900/50 border transition-colors duration-200
        ${isOver ? `${colors.border} bg-slate-800/50` : 'border-white/5'}
      `}
    >
      {/* Header */}
      <div className={`p-4 rounded-t-xl bg-gradient-to-b ${colors.header}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{column.icon}</span>
            <h3 className="font-semibold text-white">{column.title}</h3>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${colors.badge}`}>
            {orders.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <SortableContext
        items={orders.map(o => o.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[200px]">
          {isLoading ? (
            // Loading skeletons
            <>
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-32 rounded-lg bg-slate-800/50 animate-pulse"
                />
              ))}
            </>
          ) : orders.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center h-32 text-slate-500">
              <span className="text-2xl mb-2">📭</span>
              <span className="text-sm">Aucune commande</span>
            </div>
          ) : (
            // Order cards
            orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <OrderCard order={order} />
              </motion.div>
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
