'use client';

import { useState, useMemo, useEffect } from 'react';
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
  const { orders, isLoading, fetchOrders, moveOrder, updateOrder, addOrder } = useOrders();
  const { expert } = useExpertAuth();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [levelFilter, setLevelFilter] = useState<number | null>(null);

  // Notify on initial load if orders are waiting for validation
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

  // Socket for real-time updates
  const { orderViewers } = useSocket({
    onNewOrder: (order) => {
      addOrder(order);
      toast.success(`Nouvelle commande: ${order.orderNumber}`, {
        description: `${order.user.firstName} - Niveau ${order.level}`,
      });
    },
    onStatusChange: (data) => {
      // Notify when an order enters validation
      if (data.newStatus === 'AWAITING_VALIDATION') {
        toast.info(`Lecture prête à valider: ${data.orderNumber}`, {
          description: 'Une lecture attend votre approbation dans la colonne Validation.',
        });
      }
      fetchOrders();
    },
    onGenerationComplete: (data) => {
      if (data.success) {
        toast.success(`Génération terminée: ${data.orderNumber}`);
      } else {
        toast.error(`Échec génération: ${data.orderNumber}`, {
          description: data.error,
        });
      }
      fetchOrders();
    },
    onOrderClaimed: (data) => {
      // Update the order's expertReview optimistically
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

  // DnD sensors
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

  // Filter orders by level
  const filteredOrders = useMemo(() => {
    if (!levelFilter) return orders;
    return {
      paid: orders.paid.filter((o) => o.level === levelFilter),
      processing: orders.processing.filter((o) => o.level === levelFilter),
      validation: orders.validation.filter((o) => o.level === levelFilter),
      completed: orders.completed.filter((o) => o.level === levelFilter),
    };
  }, [orders, levelFilter]);

  // Find which column an order is in
  const findOrderColumn = (orderId: string): KanbanColumnId | null => {
    for (const [columnId, columnOrders] of Object.entries(filteredOrders)) {
      if (columnOrders.find((o: Order) => o.id === orderId)) {
        return columnId as KanbanColumnId;
      }
    }
    return null;
  };

  // Claim an order
  const handleClaim = async (orderId: string) => {
    try {
      await expertApi.post(`/expert/orders/${orderId}/assign`);
      // Optimistic update will come via socket order:claimed event
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(msg || 'Impossible de prendre la commande');
      console.error(error);
    }
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const column = findOrderColumn(active.id as string);
    if (column) {
      const order = filteredOrders[column].find((o) => o.id === active.id);
      setActiveOrder(order || null);
    }
  };

  const handleDragOver = () => {
    // Optional: Add visual feedback during drag
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveOrder(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Get source and destination columns
    const sourceColumn = findOrderColumn(activeId);
    let destColumn: KanbanColumnId | null = null;

    // Check if dropped on a column
    if (KANBAN_COLUMNS.find((c) => c.id === overId)) {
      destColumn = overId as KanbanColumnId;
    } else {
      // Dropped on another order - find its column
      destColumn = findOrderColumn(overId);
    }

    if (!sourceColumn || !destColumn || sourceColumn === destColumn) return;

    // Block drag if assigned to another expert (unless admin)
    const draggedOrder = filteredOrders[sourceColumn]?.find((o) => o.id === activeId);
    const assignedBy = (draggedOrder?.expertReview as { assignedBy?: string })?.assignedBy;
    if (assignedBy && assignedBy !== expert?.id && expert?.role !== 'ADMIN') {
      toast.error('Commande déjà prise par un autre expert');
      return;
    }

    // PAID is webhook-only and validation/completion require Studio actions.
    if (destColumn === 'paid') {
      toast.error('Impossible de revenir en « Nouvelles »', {
        description: 'Le statut PAID est géré uniquement après paiement.',
      });
      return;
    }
    if (destColumn === 'validation') {
      toast.info('La validation est alimentée automatiquement', {
        description: 'Lancez la génération : la lecture apparaîtra ici une fois prête.',
      });
      return;
    }
    if (destColumn === 'completed') {
      toast.info('Finalisation dans le Studio', {
        description: 'Ouvrez la lecture, vérifiez le contenu, puis scellez-la depuis le Studio.',
      });
      return;
    }
    if (destColumn !== 'processing' || !['paid', 'validation'].includes(sourceColumn)) {
      toast.error('Transition non autorisée');
      return;
    }

    // Optimistic rendering while the server holds the generation lease.
    moveOrder(activeId, sourceColumn, destColumn);

    try {
      await expertApi.post(`/expert/orders/${activeId}/generate`);
      toast.success('Génération lancée');
    } catch (error) {
      // Revert on error
      moveOrder(activeId, destColumn, sourceColumn);
      toast.error('Erreur lors du déplacement');
      console.error(error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-desk-border">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-desk-text">Board</h1>
          <p className="text-sm text-desk-muted mt-0.5 hidden sm:block">
            Gérez vos commandes par glisser-déposer
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Level filter */}
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

          {/* Refresh */}
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

      {/* Board */}
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
              />
            ))}
          </div>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeOrder && <OrderCard order={activeOrder} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
