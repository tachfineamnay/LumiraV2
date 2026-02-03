'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock,
  FileText,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import { LevelBadge } from '../shared/LevelBadge';
import { ClientFullData, ClientOrder } from './types';
import api from '@/lib/api';
import { toast } from 'sonner';

interface OrderTimelineProps {
  client: ClientFullData;
  onRefresh: () => void;
}

export function OrderTimeline({ client, onRefresh }: OrderTimelineProps) {
  const { orders } = client;
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [regeneratingOrder, setRegeneratingOrder] = useState<string | null>(null);

  const handleViewPdf = async (order: ClientOrder) => {
    // Build the PDF URL from the order
    const pdfUrl = `/api/readings/${order.orderNumber}/download`;
    window.open(pdfUrl, '_blank');
  };

  const handleRegenerate = async (orderId: string) => {
    try {
      setRegeneratingOrder(orderId);
      await api.post(`/expert/orders/${orderId}/generate`);
      toast.success('Régénération lancée', { description: 'La lecture sera bientôt disponible' });
      // Refresh after a few seconds
      setTimeout(onRefresh, 3000);
    } catch (error) {
      toast.error('Erreur lors de la régénération');
      console.error(error);
    } finally {
      setRegeneratingOrder(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-stellar-100 flex items-center gap-2">
          <Clock className="w-5 h-5 text-serenity-400" />
          Ligne de Temps
        </h3>
        <p className="text-xs text-stellar-400 mt-1">Historique des commandes</p>
      </div>

      {/* Orders List */}
      <div className="divide-y divide-white/5 max-h-[550px] overflow-y-auto">
        {orders.length > 0 ? (
          orders.map((order, index) => (
            <OrderItem
              key={order.id}
              order={order}
              index={index}
              isExpanded={expandedOrder === order.id}
              onToggle={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              onViewPdf={() => handleViewPdf(order)}
              onRegenerate={() => handleRegenerate(order.id)}
              isRegenerating={regeneratingOrder === order.id}
            />
          ))
        ) : (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6 text-stellar-400" />
            </div>
            <p className="text-sm text-stellar-400">Aucune commande</p>
            <p className="text-xs text-stellar-400/60 mt-1">Le voyage n'a pas encore commencé...</p>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {orders.length > 0 && (
        <div className="p-4 border-t border-white/10 bg-white/5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stellar-400">Total dépensé</span>
            <span className="text-amber-400 font-semibold">{client.stats.totalSpentFormatted}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Order Item Component
function OrderItem({
  order,
  index,
  isExpanded,
  onToggle,
  onViewPdf,
  onRegenerate,
  isRegenerating,
}: {
  order: ClientOrder;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onViewPdf: () => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  const isCompleted = order.status === 'COMPLETED';
  const isFailed = order.status === 'FAILED';
  const hasPdf = isCompleted && order.generatedContent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group"
    >
      {/* Main Row */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors text-left"
      >
        {/* Timeline Dot */}
        <div className="relative">
          <div className={`
            w-3 h-3 rounded-full mt-1.5
            ${isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : 'bg-amber-500'}
          `} />
          {index < 999 && ( // Always show line except for very last
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-px h-full bg-white/10" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-stellar-400">{order.orderNumber}</span>
            <LevelBadge level={order.level} size="sm" showIcon={false} />
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={order.status} size="sm" />
            <span className="text-xs text-stellar-400">
              {formatAmount(order.amount)}
            </span>
          </div>

          <p className="text-xs text-stellar-400/60 mt-1">
            {formatDate(order.createdAt)}
          </p>
        </div>

        {/* Expand Icon */}
        <ChevronDown className={`
          w-4 h-4 text-stellar-400 transition-transform mt-1
          ${isExpanded ? 'rotate-180' : ''}
        `} />
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-4 pb-4 ml-6"
        >
          {/* Timeline Details */}
          <div className="pl-4 border-l border-white/10 space-y-2 text-xs">
            {order.paidAt && (
              <TimelineEvent
                icon={<CheckCircle className="w-3 h-3 text-emerald-400" />}
                label="Payée"
                date={order.paidAt}
              />
            )}
            {order.deliveredAt && (
              <TimelineEvent
                icon={<CheckCircle className="w-3 h-3 text-emerald-400" />}
                label="Livrée"
                date={order.deliveredAt}
              />
            )}
            {isFailed && (
              <TimelineEvent
                icon={<XCircle className="w-3 h-3 text-red-400" />}
                label="Échec"
                date={order.createdAt}
              />
            )}
          </div>

          {/* Photos */}
          {order.files.length > 0 && (
            <div className="mt-3 flex gap-2">
              {order.files.map((file) => (
                <div 
                  key={file.id}
                  className="w-12 h-12 rounded-lg overflow-hidden border border-white/10"
                >
                  <img 
                    src={file.url} 
                    alt={file.type}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            {hasPdf && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewPdf(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-medium transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Voir PDF
                <ExternalLink className="w-3 h-3" />
              </button>
            )}

            {(isFailed || (!isCompleted && order.status !== 'PENDING')) && (
              <button
                onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
                disabled={isRegenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-stellar-100 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Relancer
              </button>
            )}

            {!hasPdf && isCompleted && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-400 rounded-lg text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                PDF non disponible
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Timeline Event
function TimelineEvent({ 
  icon, 
  label, 
  date 
}: { 
  icon: React.ReactNode; 
  label: string; 
  date: string;
}) {
  return (
    <div className="flex items-center gap-2 text-stellar-400">
      {icon}
      <span>{label}</span>
      <span className="text-stellar-400/60">{formatDate(date)}</span>
    </div>
  );
}

// Helpers
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatAmount(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}
