'use client';

import { motion } from 'framer-motion';
import { OrderCard } from './OrderCard';
import type { KanbanColumn as KanbanColumnType, Order } from '../types';
import type { OrderViewer } from '../hooks/useSocket';

interface KanbanColumnProps {
  column: KanbanColumnType;
  orders: Order[];
  isLoading?: boolean;
  currentExpertId?: string;
  orderViewers?: Record<string, OrderViewer[]>;
  onClaim?: (orderId: string) => void;
  claimingOrderId?: string | null;
}

const COLUMN_COLORS = {
  amber: {
    header: 'from-amber-500/20 to-amber-600/5',
    badge: 'bg-amber-500/20 text-amber-700',
  },
  blue: {
    header: 'from-blue-500/20 to-blue-600/5',
    badge: 'bg-blue-500/20 text-blue-700',
  },
  rose: {
    header: 'from-rose-500/20 to-rose-600/5',
    badge: 'bg-rose-500/20 text-rose-700',
  },
  green: {
    header: 'from-emerald-500/20 to-emerald-600/5',
    badge: 'bg-emerald-500/20 text-emerald-700',
  },
};

const COLUMN_LABELS = {
  paid: 'Nouvelles',
  processing: 'En production',
  validation: 'À valider',
  completed: 'Livrées',
} as const;

export function KanbanColumn({
  column,
  orders,
  isLoading,
  currentExpertId,
  orderViewers = {},
  onClaim,
  claimingOrderId,
}: KanbanColumnProps) {
  const colors = COLUMN_COLORS[column.color as keyof typeof COLUMN_COLORS] ?? COLUMN_COLORS.amber;
  const myOrdersCount = currentExpertId
    ? orders.filter(
        (order) => (order.expertReview as { assignedBy?: string })?.assignedBy === currentExpertId,
      ).length
    : 0;
  const label = COLUMN_LABELS[column.id] ?? column.title;

  return (
    <section className="flex w-[85vw] max-w-80 shrink-0 snap-center flex-col rounded-xl border border-desk-border bg-desk-surface sm:w-80">
      <header className={`rounded-t-xl bg-gradient-to-b p-4 ${colors.header}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{column.icon}</span>
            <h2 className="font-semibold text-desk-text">{label}</h2>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-sm font-medium ${colors.badge}`}>
            {orders.length}
          </span>
        </div>
        {myOrdersCount > 0 && (
          <p className="mt-1 text-[11px] font-medium text-emerald-700">{myOrdersCount} à moi</p>
        )}
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {isLoading ? (
          [1, 2, 3].map((index) => (
            <div key={index} className="h-36 animate-pulse rounded-xl bg-desk-card" />
          ))
        ) : orders.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-desk-muted">
            <span className="text-2xl">📭</span>
            <span className="mt-2 text-sm">Aucune lecture</span>
          </div>
        ) : (
          orders.map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <OrderCard
                order={order}
                columnId={column.id}
                currentExpertId={currentExpertId}
                viewers={orderViewers[order.id]}
                onClaim={onClaim}
                isClaiming={claimingOrderId === order.id}
              />
            </motion.div>
          ))
        )}
      </div>
    </section>
  );
}
