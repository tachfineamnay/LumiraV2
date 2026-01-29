'use client';

import { useState, useMemo } from 'react';
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
  DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { OrderCard } from './OrderCard';
import { useOrders } from '../hooks/useOrders';
import { useSocket } from '../hooks/useSocket';
import { KANBAN_COLUMNS, Order, KanbanColumnId } from '../types';
import api from '@/lib/api';
import { toast } from 'sonner';
import { RefreshCw, Filter, SlidersHorizontal } from 'lucide-react';

export function KanbanBoard() {
  const { orders, isLoading, fetchOrders, moveOrder, updateOrder, addOrder } = useOrders();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [levelFilter, setLevelFilter] = useState<number | null>(null);

  // Socket for real-time updates
  useSocket({
    onNewOrder: (order) => {
      addOrder(order);
      toast.success(`Nouvelle commande: ${order.orderNumber}`, {
        description: `${order.user.firstName} - Niveau ${order.level}`,
      });
    },
    onStatusChange: (data) => {
      // Refresh to get updated order
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
    })
  );

  // Filter orders by level
  const filteredOrders = useMemo(() => {
    if (!levelFilter) return orders;
    return {
      paid: orders.paid.filter(o => o.level === levelFilter),
      processing: orders.processing.filter(o => o.level === levelFilter),
      validation: orders.validation.filter(o => o.level === levelFilter),
      completed: orders.completed.filter(o => o.level === levelFilter),
    };
  }, [orders, levelFilter]);

  // Find which column an order is in
  const findOrderColumn = (orderId: string): KanbanColumnId | null => {
    for (const [columnId, columnOrders] of Object.entries(filteredOrders)) {
      if (columnOrders.find(o => o.id === orderId)) {
        return columnId as KanbanColumnId;
      }
    }
    return null;
  };

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const column = findOrderColumn(active.id as string);
    if (column) {
      const order = filteredOrders[column].find(o => o.id === active.id);
      setActiveOrder(order || null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
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
    if (KANBAN_COLUMNS.find(c => c.id === overId)) {
      destColumn = overId as KanbanColumnId;
    } else {
      // Dropped on another order - find its column
      destColumn = findOrderColumn(overId);
    }

    if (!sourceColumn || !destColumn || sourceColumn === destColumn) return;

    // Optimistic update
    moveOrder(activeId, sourceColumn, destColumn);

    // Get the new status based on destination column
    const newStatus = getStatusForColumn(destColumn);
    if (!newStatus) return;

    try {
      // Call API to update status
      if (destColumn === 'processing') {
        await api.post(`/api/expert/orders/${activeId}/generate`);
        toast.success('Génération lancée');
      } else if (destColumn === 'completed') {
        await api.post(`/api/expert/orders/${activeId}/finalize`);
        toast.success('Commande scellée');
      } else {
        // Just update status
        await api.patch(`/api/expert/orders/${activeId}/status`, { status: newStatus });
      }
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
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5">
        <div>
          <h1 className="text-xl font-semibold text-white">Board</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Gérez vos commandes par glisser-déposer
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Level filter */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-800/50 border border-white/5">
            <button
              onClick={() => setLevelFilter(null)}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                levelFilter === null ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tous
            </button>
            {[1, 2, 3, 4].map(level => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  levelFilter === level ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-white'
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
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full min-w-max">
            {KANBAN_COLUMNS.map(column => (
              <KanbanColumn
                key={column.id}
                column={column}
                orders={filteredOrders[column.id]}
                isLoading={isLoading}
              />
            ))}
          </div>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeOrder && (
              <OrderCard order={activeOrder} isDragging />
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function getStatusForColumn(column: KanbanColumnId): string | null {
  switch (column) {
    case 'paid':
      return 'PAID';
    case 'processing':
      return 'PROCESSING';
    case 'validation':
      return 'AWAITING_VALIDATION';
    case 'completed':
      return 'COMPLETED';
    default:
      return null;
  }
}
