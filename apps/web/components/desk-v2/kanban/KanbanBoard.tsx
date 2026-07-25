'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import expertApi from '@/lib/expertApi';
import { useExpertAuth } from '@/context/ExpertAuthContext';
import { KanbanColumn } from './KanbanColumn';
import { useOrders } from '../hooks/useOrders';
import { useSocket } from '../hooks/useSocket';
import { KANBAN_COLUMNS } from '../types';

export function KanbanBoard() {
  const router = useRouter();
  const { orders, isLoading, fetchOrders, updateOrder } = useOrders();
  const { expert } = useExpertAuth();
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [claimingOrderId, setClaimingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && orders.validation.length > 0) {
      toast.info(
        `${orders.validation.length} lecture${orders.validation.length > 1 ? 's' : ''} à examiner`,
        { description: 'Le contrôle expert est prêt dans la colonne À valider.' },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const { orderViewers } = useSocket({
    onNewOrder: (order) => {
      toast.success(`Nouvelle commande : ${order.orderNumber}`);
      void fetchOrders();
    },
    onIntakeReady: (data) => {
      toast.success('Dossier client confirmé', {
        description: `La commande ${data.orderNumber || data.orderId} peut maintenant être prise en charge.`,
      });
      void fetchOrders();
    },
    onStatusChange: () => void fetchOrders(),
    onGenerationComplete: (data) => {
      if (data.success) {
        toast.success(`Lecture prête — ${data.orderNumber}`, {
          action: {
            label: 'Réviser',
            onClick: () => router.push(`/admin/studio/${data.orderId}`),
          },
        });
      } else {
        toast.error(`Échec génération — ${data.orderNumber}`, { description: data.error });
      }
      void fetchOrders();
    },
    onOrderClaimed: (data) => {
      updateOrder(data.orderId, {
        expertReview: {
          assignedBy: data.expertId,
          assignedName: data.expertName,
          assignedAt: data.timestamp,
        },
      });
      if (data.expertId !== expert?.id) {
        toast.info(`${data.expertName} a pris la commande ${data.orderNumber}`);
      }
    },
  });

  const filteredOrders = useMemo(() => {
    if (!levelFilter) return orders;
    return {
      paid: orders.paid.filter((order) => order.level === levelFilter),
      processing: orders.processing.filter((order) => order.level === levelFilter),
      validation: orders.validation.filter((order) => order.level === levelFilter),
      completed: orders.completed.filter((order) => order.level === levelFilter),
    };
  }, [orders, levelFilter]);

  const claim = async (orderId: string) => {
    if (claimingOrderId) return;
    setClaimingOrderId(orderId);
    try {
      await expertApi.post(`/expert/orders/${orderId}/assign`);
      toast.success('Commande prise en charge', {
        description: 'Le dossier scellé est disponible dans le Studio.',
      });
      await fetchOrders();
    } catch (error: unknown) {
      const data = (
        error as {
          response?: { data?: { message?: string | string[]; code?: string } };
        }
      )?.response?.data;
      const message = Array.isArray(data?.message) ? data?.message.join(' ') : data?.message;
      if (data?.code === 'READING_INTAKE_REQUIRED') {
        toast.info('Dossier en attente de confirmation', {
          description:
            'Le client peut encore relire et modifier son brouillon. La prise en charge sera disponible dès le scellement.',
        });
      } else {
        toast.error('Impossible de prendre la commande', { description: message });
      }
    } finally {
      setClaimingOrderId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-desk-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
        <div>
          <h1 className="text-lg font-semibold text-desk-text sm:text-xl">Lectures</h1>
          <p className="mt-0.5 hidden text-sm text-desk-muted sm:block">
            Un statut réel, une action principale, aucune transition manuelle.
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-desk-border bg-desk-card p-1">
            <button
              type="button"
              onClick={() => setLevelFilter(null)}
              className={`min-h-9 shrink-0 rounded-md px-3 text-sm ${levelFilter === null ? 'bg-amber-500 text-slate-950' : 'text-desk-muted hover:text-desk-text'}`}
            >
              Tous
            </button>
            {[1, 2, 3, 4].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setLevelFilter(level)}
                className={`min-h-9 shrink-0 rounded-md px-3 text-sm ${levelFilter === level ? 'bg-amber-500 text-slate-950' : 'text-desk-muted hover:text-desk-text'}`}
              >
                N{level}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void fetchOrders()}
            disabled={isLoading}
            aria-label="Rafraîchir"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-desk-muted hover:bg-desk-hover hover:text-desk-text disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto p-3 sm:p-6">
        <div className="flex h-full min-w-max gap-3 sm:gap-4">
          {KANBAN_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              orders={filteredOrders[column.id]}
              isLoading={isLoading}
              currentExpertId={expert?.id}
              orderViewers={orderViewers}
              onClaim={claim}
              claimingOrderId={claimingOrderId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
