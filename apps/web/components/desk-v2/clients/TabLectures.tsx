'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  MessageSquare,
  ShoppingCart,
  Wrench,
} from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import { LevelBadge } from '../shared/LevelBadge';
import { Badge } from '../shared/Badge';
import { ClientFullData, ClientOrder } from './types';
import api from '@/lib/api';
import { toast } from 'sonner';

interface TabLecturesProps {
  client: ClientFullData;
  onRefresh: () => void;
}

export function TabLectures({ client, onRefresh }: TabLecturesProps) {
  const { orders } = client;
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [regeneratingOrder, setRegeneratingOrder] = useState<string | null>(null);

  const handleViewPdf = (order: ClientOrder) => {
    const pdfUrl = `/api/readings/${order.orderNumber}/download`;
    window.open(pdfUrl, '_blank');
  };

  const handleRegenerate = async (orderId: string) => {
    try {
      setRegeneratingOrder(orderId);
      await api.post(`/expert/orders/${orderId}/generate`);
      toast.success('Régénération lancée', { description: 'La lecture sera bientôt disponible' });
      setTimeout(onRefresh, 3000);
    } catch (error) {
      toast.error('Erreur lors de la régénération');
      console.error(error);
    } finally {
      setRegeneratingOrder(null);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-desk-hover flex items-center justify-center mb-4">
          <FileText className="w-8 h-8 text-desk-subtle" />
        </div>
        <p className="text-sm text-desk-muted">Aucune commande</p>
        <p className="text-xs text-desk-subtle mt-1">Le voyage n&apos;a pas encore commencé...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-desk-muted">{orders.length} lecture{orders.length > 1 ? 's' : ''}</span>
        <span className="text-sm font-semibold text-amber-600">{client.stats.totalSpentFormatted} au total</span>
      </div>

      {/* Order List */}
      {orders.map((order, index) => {
        const isExpanded = expandedOrder === order.id;
        const isCompleted = order.status === 'COMPLETED';
        const isFailed = order.status === 'FAILED';
        const hasPdf = isCompleted && order.generatedContent;
        const hasAddons = order.addons && order.addons.length > 0;
        const hasUpsell = order.upsellOfferedAt || order.upsellAcceptedAt;

        return (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="bg-desk-hover rounded-xl border border-desk-border-subtle overflow-hidden"
          >
            {/* Header row */}
            <button
              onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              className="w-full p-4 flex items-center gap-4 hover:bg-desk-hover transition-colors text-left"
            >
              {/* Status dot */}
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-red-500' : 'bg-amber-500'}`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-desk-muted">{order.orderNumber}</span>
                  <LevelBadge level={order.level} size="sm" showIcon={false} />
                  <StatusBadge status={order.status} size="sm" />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-desk-muted">{formatAmount(order.amount)}</span>
                  <span className="text-xs text-desk-subtle">{formatDate(order.createdAt)}</span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2">
                {order.expertPrompt && (
                  <span title="Expert prompt défini" className="p-1 bg-purple-500/10 rounded">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                  </span>
                )}
                {hasAddons && (
                  <span title="Addons achetés" className="p-1 bg-emerald-500/10 rounded">
                    <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                  </span>
                )}
                {hasUpsell && (
                  <Badge variant={order.upsellAcceptedAt ? 'success' : 'warning'} size="sm">
                    {order.upsellAcceptedAt ? 'Upsell accepté' : 'Upsell proposé'}
                  </Badge>
                )}
              </div>

              <ChevronDown className={`w-4 h-4 text-desk-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded */}
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="px-4 pb-4 border-t border-desk-border-subtle"
              >
                <div className="pt-3 space-y-3">
                  {/* Timeline events */}
                  <div className="pl-4 border-l border-desk-border space-y-2 text-xs">
                    {order.paidAt && (
                      <div className="flex items-center gap-2 text-desk-muted">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>Payée</span>
                        <span className="text-desk-subtle">{formatDate(order.paidAt)}</span>
                      </div>
                    )}
                    {order.deliveredAt && (
                      <div className="flex items-center gap-2 text-desk-muted">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        <span>Livrée</span>
                        <span className="text-desk-subtle">{formatDate(order.deliveredAt)}</span>
                      </div>
                    )}
                    {isFailed && (
                      <div className="flex items-center gap-2 text-desk-muted">
                        <XCircle className="w-3 h-3 text-red-600" />
                        <span>Échec</span>
                      </div>
                    )}
                  </div>

                  {/* Expert Prompt */}
                  {order.expertPrompt && (
                    <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
                      <p className="text-xs text-purple-600 font-medium mb-1 flex items-center gap-1">
                        <Wrench className="w-3 h-3" /> Expert Prompt
                      </p>
                      <p className="text-sm text-desk-text">{order.expertPrompt}</p>
                    </div>
                  )}

                  {/* Expert Instructions */}
                  {order.expertInstructions && (
                    <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                      <p className="text-xs text-blue-600 font-medium mb-1">Instructions expert</p>
                      <p className="text-sm text-desk-text">{order.expertInstructions}</p>
                    </div>
                  )}

                  {/* Addons */}
                  {hasAddons && (
                    <div className="flex flex-wrap gap-2">
                      {order.addons!.map((addon, i) => (
                        <span key={i} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-600">
                          {addon.type} — {formatAmount(addon.amount)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Photos */}
                  {order.files.length > 0 && (
                    <div className="flex gap-2">
                      {order.files.map((file) => (
                        <div key={file.id} className="w-12 h-12 rounded-lg overflow-hidden border border-desk-border">
                          <img src={file.url} alt={file.type} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    {hasPdf && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewPdf(order); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 rounded-lg text-xs font-medium transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Voir PDF
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    {(isFailed || (!isCompleted && order.status !== 'PENDING')) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRegenerate(order.id); }}
                        disabled={regeneratingOrder === order.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-desk-hover hover:bg-desk-card text-desk-text rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {regeneratingOrder === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Relancer
                      </button>
                    )}
                    {!hasPdf && isCompleted && (
                      <div
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 text-orange-600 rounded-lg text-xs"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        PDF non disponible
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatAmount(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}
