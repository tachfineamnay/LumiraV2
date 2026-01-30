'use client';

import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { Order, OrderStatus, KanbanColumnId, KANBAN_COLUMNS } from '../types';

interface UseOrdersOptions {
  autoFetch?: boolean;
  pollInterval?: number | null;
}

interface OrdersState {
  paid: Order[];
  processing: Order[];
  validation: Order[];
  completed: Order[];
}

export function useOrders(options: UseOrdersOptions = {}) {
  const { autoFetch = true, pollInterval = null } = options;

  const [orders, setOrders] = useState<OrdersState>({
    paid: [],
    processing: [],
    validation: [],
    completed: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const [paidRes, processingRes, validationRes, historyRes] = await Promise.all([
        api.get('/expert/orders/pending'),
        api.get('/expert/orders/processing'),
        api.get('/expert/orders/validation'),
        api.get('/expert/orders/history?limit=20'),
      ]);

      setOrders({
        paid: paidRes.data.filter((o: Order) => o.status === 'PAID'),
        processing: processingRes.data,
        validation: validationRes.data,
        completed: historyRes.data,
      });
      setError(null);
    } catch (err) {
      console.error('[useOrders] Fetch error:', err);
      setError('Erreur de chargement des commandes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const moveOrder = useCallback((orderId: string, fromColumn: KanbanColumnId, toColumn: KanbanColumnId) => {
    setOrders(prev => {
      const order = prev[fromColumn].find(o => o.id === orderId);
      if (!order) return prev;

      return {
        ...prev,
        [fromColumn]: prev[fromColumn].filter(o => o.id !== orderId),
        [toColumn]: [order, ...prev[toColumn]],
      };
    });
  }, []);

  const updateOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    setOrders(prev => {
      const result = { ...prev };
      for (const column of Object.keys(result) as KanbanColumnId[]) {
        result[column] = result[column].map(order =>
          order.id === orderId ? { ...order, ...updates } : order
        );
      }
      return result;
    });
  }, []);

  const addOrder = useCallback((order: Order) => {
    const column = getColumnForStatus(order.status);
    if (column) {
      setOrders(prev => ({
        ...prev,
        [column]: [order, ...prev[column]],
      }));
    }
  }, []);

  const removeOrder = useCallback((orderId: string) => {
    setOrders(prev => {
      const result = { ...prev };
      for (const column of Object.keys(result) as KanbanColumnId[]) {
        result[column] = result[column].filter(o => o.id !== orderId);
      }
      return result;
    });
  }, []);

  // Auto fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchOrders();
    }
  }, [autoFetch, fetchOrders]);

  // Polling
  useEffect(() => {
    if (pollInterval && pollInterval > 0) {
      const interval = setInterval(fetchOrders, pollInterval);
      return () => clearInterval(interval);
    }
  }, [pollInterval, fetchOrders]);

  const totalCount = orders.paid.length + orders.processing.length + orders.validation.length;

  return {
    orders,
    isLoading,
    error,
    totalCount,
    fetchOrders,
    moveOrder,
    updateOrder,
    addOrder,
    removeOrder,
  };
}

function getColumnForStatus(status: OrderStatus): KanbanColumnId | null {
  switch (status) {
    case 'PAID':
      return 'paid';
    case 'PROCESSING':
      return 'processing';
    case 'AWAITING_VALIDATION':
      return 'validation';
    case 'COMPLETED':
      return 'completed';
    default:
      return null;
  }
}
