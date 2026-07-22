'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { OrderCard } from './OrderCard';
import { useOrders } from '../hooks/useOrders';
import { useSocket } from '../hooks/useSocket';
import { useExpertAuth } from '@/context/ExpertAuthContext';
import { KANBAN_COLUMNS, Order, KanbanColumnId } from '../types';
import expertApi from '@/lib/expertApi';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

export function KanbanBoard() {
  const router = useRouter();
  const { orders, isLoading, fetchOrders, moveOrder, updateOrder } = useOrders();
  const { expert } = useExpertAuth();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [generatingOrderId, setGeneratingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && orders.validation.length > 0) {
      toast.info(
        `${orders.validation.length} lecture${orders.validation.length > 1 ? 's' : ''} en attente de validation`,
        {
          description: 'Des lectures sont prêtes pour votre approbation.',
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const { orderViewers } = useSocket({
    onNewOrder: (order) => {
      // The socket payload is intentionally minimal (no client identity);
      // reload the board to get the full order.
      toast.success(`Nouvelle commande: ${order.orderNumber}`);
      fetchOrders();
    },
    onStatusChange: (data) => {
      if (data.newStatus === 'AWAITING_VALIDATION') {
        toast.info(`Lecture prête à valider: ${data.orderNumber}`, {
          description: 'Une lecture attend votre approbation dans la colonne Validation.',
        });
      }
      fetchOrders();
    },
    onGenerationComplete: (data) => {
      if (data.success) {
        toast.success(`Lecture prête — ${data.orderNumber}`, {
          description: 'Ouvrir la révision',
          action: {
            label: 'Révision',
            onClick: () => router.push(`/admin/studio/${data.orderId}`),
          },
        });
      } else {
        toast.error(`Échec génération — ${data.orderNumber}`, {
          description: data.error,
          action: {
            label: 'Production',
            onClick: () => router.push('/admin/production'),
          },
        });
      }
      fetchOrders();
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const filteredOrders = useMemo(() => {
    if (!levelFilter) return orders;
    return {
      paid: orders.paid.filter((order) => order.level === levelFilter),
      processing: orders.processing.filter((order) => order.level === levelFilter),
      validation: orders.validation.filter((order) => order.level === levelFilter),
      completed: orders.completed.filter((order) => order.level === levelFilter),
    };
  }, [orders, levelFilter]);

  const findOrderColumn = (orderId: string): KanbanColumnId | null => {
    for (const [columnId, columnOrders] of Object.entries(filteredOrders)) {
      if (columnOrders.find((order: Order) => order.id === orderId)) {
        return columnId as KanbanColumnId;
      }
    }
    return null;
  };

  const handleClaim = async (orderId: string) => {
    try {
      await expertApi.post(`/expert/orders/${orderId}/assign`);
      toast.success('Commande prise en charge', {
        description: 'Vérifiez le dossier puis lancez la production lorsque vous êtes prêt.',
      });
      await fetchOrders();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(message || 'Impossible de prendre la commande');
      console.error(error);
    }
  };

  const handleGenerate = async (orderId: string) => {
    setGeneratingOrderId(orderId);
    try {
      const { data } = await expertApi.post(`/expert/orders/${orderId}/jobs/reading`, {});
      const current = filteredOrders.paid.find((order) => order.id === orderId);
      if (current) {
        updateOrder(orderId, {
          expertReview: {
            ...((current.expertReview as Record<string, unknown>) || {}),
            production: data.job,
          },
        });
      }
      toast.success('Production lancée', {
        description: 'Le traitement continue côté serveur. Vous pouvez ouvrir une autre commande.',
      });
      window.setTimeout(() => void fetchOrders(), 800);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error('Impossible de lancer la production', { description: message });
    } finally {
      setGeneratingOrderId(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const column = findOrderColumn(active.id as string);
    if (column) {
      const order = filteredOrders[column].find((candidate) => candidate.id === active.id);
      setActiveOrder(order || null);
    }
  };

  const handleDragOver = () => undefined;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const sourceColumn = findOrderColumn(activeId);
    let destinationColumn: KanbanColumnId | null = null;

    if (KANBAN_COLUMNS.find((column) => column.id === overId)) {
      destinationColumn = overId as KanbanColumnId;
    } else {
      destinationColumn = findOrderColumn(overId);
    }

    if (!sourceColumn || !destinationColumn || sourceColumn === destinationColumn) return;

    const draggedOrder = filteredOrders[sourceColumn]?.find((order) => order.id === activeId);
    const assignedBy = (draggedOrder?.expertReview as { assignedBy?: string })?.assignedBy;
    if (assignedBy && assignedBy !== expert?.id && expert?.role !== 'ADMIN') {
      toast.error('Commande déjà prise par un autre expert');
      return;
    }

    if (destinationColumn === 'paid') {
      toast.error('Impossible de revenir en « Nouvelles »', {
        description: 'Le statut PAID est géré uniquement après paiement.',
      });
      return;
    }
    if (destinationColumn === 'validation') {
      toast.info('La validation est alimentée automatiquement', {
        description: 'Lancez la production : la lecture apparaîtra ici une fois prête.',
      });
      return;
    }
    if (destinationColumn === 'completed') {
      toast.info('Finalisation dans le Studio', {
        description: 'Ouvrez la lecture, vérifiez le contenu, puis scellez-la depuis le Studio.',
      });
      return;
    }
    if (destinationColumn !== 'processing' || !['paid', 'validation'].includes(sourceColumn)) {
      toast.error('Transition non autorisée');
      return;
    }

    moveOrder(activeId, sourceColumn, destinationColumn);

    try {
      await expertApi.post(`/expert/orders/${activeId}/generate`);
      toast.success('Production ajoutée à la file', {
        description: 'Elle continue côté serveur indépendamment de cette page.',
      });
    } catch (error) {
      moveOrder(activeId, destinationColumn, sourceColumn);
      toast.error('Erreur lors du lancement');
      console.error(error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-desk-border">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-desk-text">Board</h1>
          <p className="text-sm text-desk-muted mt-0.5 hidden sm:block">
            Assignez, lancez et suivez les dossiers sans bloquer votre navigation
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-desk-card border border-desk-border overflow-x-auto max-w-full">
            <button
              onClick={() => setLevelFilter(null)}
              className={`px-2.5 sm:px-3 py-1.5 min-h-[36px] rounded-md text-sm transition-colors flex-shrink-0 ${
                levelFilter === null
                  ? 'bg-amber-500 text-slate-900'
                  : 'text-desk-muted hover:text-desk-text'
              }`}
            >
              Tous
            </button>
            {[1, 2, 3, 4].map((level) => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-2.5 sm:px-3 py-1.5 min-h-[36px] rounded-md text-sm transition-colors flex-shrink-0 ${
                  levelFilter === level
                    ? 'bg-amber-500 text-slate-900'
                    : 'text-desk-muted hover:text-desk-text'
                }`}
              >
                N{level}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchOrders()}
            disabled={isLoading}
            title="Rafraîchir"
            aria-label="Rafraîchir"
            className="p-2 min-w-[40px] min-h-[40px] rounded-lg hover:bg-desk-hover text-desk-muted hover:text-desk-text transition-colors flex items-center justify-center flex-shrink-0"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-3 sm:p-6 snap-x snap-mandatory sm:snap-none">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 sm:gap-4 h-full min-w-max">
            {KANBAN_COLUMNS.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                orders={filteredOrders[column.id]}
                isLoading={isLoading}
                currentExpertId={expert?.id}
                orderViewers={orderViewers}
                onClaim={handleClaim}
                onGenerate={handleGenerate}
                generatingOrderId={generatingOrderId}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeOrder && <OrderCard order={activeOrder} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
