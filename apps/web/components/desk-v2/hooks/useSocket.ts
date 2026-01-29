'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { SocketEvents, DeskStats, Order } from '../types';

interface UseSocketOptions {
  autoConnect?: boolean;
  onNewOrder?: (order: Order) => void;
  onStatusChange?: (data: SocketEvents['order:status-changed']) => void;
  onGenerationComplete?: (data: SocketEvents['order:generation-complete']) => void;
  onStatsUpdate?: (stats: DeskStats) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    autoConnect = true,
    onNewOrder,
    onStatusChange,
    onGenerationComplete,
    onStatsUpdate,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);

  const connect = useCallback(() => {
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
      onNewOrder?.(order);
    });

    socket.on('order:status-changed', (data) => {
      console.log('[Socket] 🔄 Status changed:', data.orderNumber, data.newStatus);
      onStatusChange?.(data);
    });

    socket.on('order:generation-complete', (data) => {
      console.log('[Socket] 🤖 Generation complete:', data.orderNumber, data.success);
      onGenerationComplete?.(data);
    });

    socket.on('stats:update', (stats) => {
      onStatsUpdate?.(stats);
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
  }, [onNewOrder, onStatusChange, onGenerationComplete, onStatsUpdate]);

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
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    onlineCount,
    latency,
    connect,
    disconnect,
    focusOrder,
    blurOrder,
    sendCursor,
    socket: socketRef.current,
  };
}
