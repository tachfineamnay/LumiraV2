'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { SocketEvents, DeskStats, Order } from '../types';

interface UseSocketOptions {
  autoConnect?: boolean;
  onNewOrder?: (order: Order) => void;
  onStatusChange?: (data: SocketEvents['order:status-changed']) => void;
  onGenerationComplete?: (data: SocketEvents['order:generation-complete']) => void;
  onOrderClaimed?: (data: SocketEvents['order:claimed']) => void;
  onStatsUpdate?: (stats: DeskStats) => void;
}

export interface OrderViewer {
  expertId: string;
  expertEmail: string;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    autoConnect = true,
    onNewOrder,
    onStatusChange,
    onGenerationComplete,
    onOrderClaimed,
    onStatsUpdate,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [orderViewers, setOrderViewers] = useState<Record<string, OrderViewer[]>>({});

  // Store callbacks in refs to avoid reconnection loops
  const callbacksRef = useRef({
    onNewOrder,
    onStatusChange,
    onGenerationComplete,
    onOrderClaimed,
    onStatsUpdate,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onNewOrder,
      onStatusChange,
      onGenerationComplete,
      onOrderClaimed,
      onStatsUpdate,
    };
  }, [onNewOrder, onStatusChange, onGenerationComplete, onOrderClaimed, onStatsUpdate]);

  const connect = useCallback(() => {
    // Prevent multiple connections
    if (socketRef.current?.connected) {
      return;
    }

    const token = localStorage.getItem('expert_token');
    if (!token) {
      console.warn('[Socket] No expert token found');
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    socketRef.current = io(`${apiUrl}/expert`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('[Socket] ✅ Connected');
      setIsConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] ❌ Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setIsConnected(false);
    });

    socket.on('online-count', (data: { count: number }) => {
      setOnlineCount(data.count);
    });

    socket.on('order:new', (order) => {
      console.log('[Socket] 📦 New order:', order.orderNumber);
      callbacksRef.current.onNewOrder?.(order);
    });

    socket.on('order:status-changed', (data) => {
      console.log('[Socket] 🔄 Status changed:', data.orderNumber, data.newStatus);
      callbacksRef.current.onStatusChange?.(data);
    });

    socket.on('order:generation-complete', (data) => {
      console.log('[Socket] 🤖 Generation complete:', data.orderNumber, data.success);
      callbacksRef.current.onGenerationComplete?.(data);
    });

    socket.on('order:claimed', (data) => {
      console.log('[Socket] 🙋 Order claimed:', data.orderNumber, 'by', data.expertName);
      callbacksRef.current.onOrderClaimed?.(data);
    });

    socket.on('order:viewer-joined', (data: SocketEvents['order:viewer-joined']) => {
      setOrderViewers(prev => {
        const viewers = prev[data.orderId] || [];
        if (viewers.some(v => v.expertId === data.expertId)) return prev;
        return { ...prev, [data.orderId]: [...viewers, { expertId: data.expertId, expertEmail: data.expertEmail }] };
      });
    });

    socket.on('order:viewer-left', (data: SocketEvents['order:viewer-left']) => {
      setOrderViewers(prev => {
        const viewers = prev[data.orderId];
        if (!viewers) return prev;
        const filtered = viewers.filter(v => v.expertId !== data.expertId);
        if (filtered.length === 0) {
          const next = { ...prev };
          delete next[data.orderId];
          return next;
        }
        return { ...prev, [data.orderId]: filtered };
      });
    });

    socket.on('stats:update', (stats) => {
      callbacksRef.current.onStatsUpdate?.(stats);
    });

    socket.on('pong', (data: { timestamp: number }) => {
      setLatency(Date.now() - data.timestamp);
    });

    // Start ping interval
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
    };
  }, []); // No dependencies - callbacks are accessed via ref

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const focusOrder = useCallback((orderId: string) => {
    socketRef.current?.emit('order:focus', { orderId });
  }, []);

  const blurOrder = useCallback((orderId: string) => {
    socketRef.current?.emit('order:blur', { orderId });
  }, []);

  const sendCursor = useCallback((orderId: string, position: number, selection?: { from: number; to: number }) => {
    socketRef.current?.emit('editor:cursor', { orderId, position, selection });
  }, []);

  useEffect(() => {
    if (autoConnect) {
      const cleanup = connect();
      return () => {
        cleanup?.();
        disconnect();
      };
    }
  }, [autoConnect]); // Removed connect/disconnect from deps - they're stable now

  return {
    isConnected,
    onlineCount,
    latency,
    orderViewers,
    connect,
    disconnect,
    focusOrder,
    blurOrder,
    sendCursor,
    socket: socketRef.current,
  };
}
