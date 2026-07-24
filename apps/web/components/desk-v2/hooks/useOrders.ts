'use client';

import { useCallback, useEffect, useState } from 'react';
import expertApi from '@/lib/expertApi';
import type { KanbanColumnId, Order, OrderStatus } from '../types';

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
  const { autoFetch = true, pollInterval = 30_000 } = options;
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
      const results = await Promise.allSettled([
        expertApi.get('/expert/orders/paid'),
        expertApi.get('/expert/orders/processing'),
        expertApi.get('/expert/orders/validation'),
        expertApi.get('/expert/orders/history?limit=50'),
      ]);

      const extractData = (result: PromiseSettledResult<{ data: { data?: Order[] } }>) => {
        if (result.status === 'fulfilled') return result.value.data.data || [];
        console.warn('[useOrders] Endpoint failed:', result.reason);
        return [];
      };

      const paid = extractData(results[0] as PromiseSettledResult<{ data: { data?: Order[] } }>);
      const running = extractData(results[1] as PromiseSettledResult<{ data: { data?: Order[] } }>);
      const validation = extractData(results[2] as PromiseSettledResult<{ data: { data?: Order[] } }>);
      const history = extractData(results[3] as PromiseSettledResult<{ data: { data?: Order[] } }>);
      const failed = history.filter((order) => order.status === 'FAILED');
      const completed = history.filter((order) =>
        ['COMPLETED', 'REFUNDED'].includes(order.status),
      );

      setOrders({
        paid,
        processing: [...running, ...failed],
        validation,
        completed,
      });
      setError(null);
    } catch (requestError) {
      console.error('[useOrders] Fetch error:', requestError);
      setError('Erreur de chargement des commandes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const moveOrder = useCallback(
    (orderId: string, fromColumn: KanbanColumnId, toColumn: KanbanColumnId) => {
      setOrders((previous) => {
        const order = previous[fromColumn].find((candidate) => candidate.id === orderId);
        if (!order) return previous;
        return {
          ...previous,
          [fromColumn]: previous[fromColumn].filter((candidate) => candidate.id !== orderId),
          [toColumn]: [order, ...previous[toColumn]],
        };
      });
    },
    [],
  );

  const updateOrder = useCallback((orderId: string, updates: Partial<Order>) => {
    setOrders((previous) => {
      const result = { ...previous };
      for (const column of Object.keys(result) as KanbanColumnId[]) {
        result[column] = result[column].map((order) =>
          order.id === orderId ? { ...order, ...updates } : order,
        );
      }
      return result;
    });
  }, []);

  const addOrder = useCallback((order: Order) => {
    const column = getColumnForStatus(order.status);
    if (!column) return;
    setOrders((previous) => ({ ...previous, [column]: [order, ...previous[column]] }));
  }, []);

  const removeOrder = useCallback((orderId: string) => {
    setOrders((previous) => {
      const result = { ...previous };
      for (const column of Object.keys(result) as KanbanColumnId[]) {
        result[column] = result[column].filter((order) => order.id !== orderId);
      }
      return result;
    });
  }, []);

  useEffect(() => {
    if (autoFetch) void fetchOrders();
  }, [autoFetch, fetchOrders]);

  useEffect(() => {
    if (!pollInterval || pollInterval <= 0) return;
    const interval = window.setInterval(() => void fetchOrders(), pollInterval);
    return () => window.clearInterval(interval);
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
    case 'FAILED':
      return 'processing';
    case 'AWAITING_VALIDATION':
      return 'validation';
    case 'COMPLETED':
    case 'REFUNDED':
      return 'completed';
    default:
      return null;
  }
}
