'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { SocketEvents, DeskStats } from '../types';

interface UseSocketOptions {
  autoConnect?: boolean;
  onNewOrder?: (data: SocketEvents['order:new']) => void;
  onIntakeReady?: (data: SocketEvents['order:intake-ready']) => void;
  onStatusChange?: (data: SocketEvents['order:status-changed']) => void;
  onGenerationComplete?: (data: SocketEvents['order:generation-complete']) => void;
  onOrderClaimed?: (data: SocketEvents['order:claimed']) => void;
  onStatsUpdate?: (stats: DeskStats) => void;
}

export interface OrderViewer {
  expertId: string;
  expertEmail: string;
}

interface SharedSocketState {
  isConnected: boolean;
  onlineCount: number;
  latency: number | null;
  orderViewers: Record<string, OrderViewer[]>;
}

type SocketCallbacks = Omit<UseSocketOptions, 'autoConnect'>;

interface SocketSubscriber {
  update: (state: SharedSocketState) => void;
  callbacks: { current: SocketCallbacks };
}

const INITIAL_STATE: SharedSocketState = {
  isConnected: false,
  onlineCount: 0,
  latency: null,
  orderViewers: {},
};

let sharedSocket: Socket | null = null;
let sharedState: SharedSocketState = INITIAL_STATE;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
let activeConsumers = 0;
const subscribers = new Set<SocketSubscriber>();

function publish(patch: Partial<SharedSocketState>) {
  sharedState = { ...sharedState, ...patch };
  subscribers.forEach((subscriber) => subscriber.update(sharedState));
}

function notify<K extends keyof SocketCallbacks>(
  callback: K,
  payload: Parameters<NonNullable<SocketCallbacks[K]>>[0],
) {
  subscribers.forEach((subscriber) => {
    const handler = subscriber.callbacks.current[callback] as
      | ((value: typeof payload) => void)
      | undefined;
    handler?.(payload);
  });
}

function ensureSocket(): Socket | null {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  if (sharedSocket) {
    if (!sharedSocket.connected) sharedSocket.connect();
    return sharedSocket;
  }

  const token = localStorage.getItem('expert_token');
  if (!token) {
    console.warn('[Socket] No expert token found');
    return null;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const socket = io(`${apiUrl}/expert`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
  sharedSocket = socket;

  socket.on('connect', () => {
    console.log('[Socket] ✅ Connected');
    publish({ isConnected: true });
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] ❌ Disconnected:', reason);
    publish({ isConnected: false });
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
    publish({ isConnected: false });
  });

  socket.on('online-count', (data: { count: number }) => {
    publish({ onlineCount: data.count });
  });

  socket.on('order:new', (data: SocketEvents['order:new']) => {
    console.log('[Socket] 📦 New order:', data.orderNumber);
    notify('onNewOrder', data);
  });

  socket.on('order:intake-ready', (data: SocketEvents['order:intake-ready']) => {
    notify('onIntakeReady', data);
  });

  socket.on('order:status-changed', (data: SocketEvents['order:status-changed']) => {
    console.log('[Socket] 🔄 Status changed:', data.orderNumber, data.newStatus);
    notify('onStatusChange', data);
  });

  socket.on('order:generation-complete', (data: SocketEvents['order:generation-complete']) => {
    console.log('[Socket] 🤖 Generation complete:', data.orderNumber, data.success);
    notify('onGenerationComplete', data);
  });

  socket.on('order:claimed', (data: SocketEvents['order:claimed']) => {
    console.log('[Socket] 🙋 Order claimed:', data.orderNumber, 'by', data.expertName);
    notify('onOrderClaimed', data);
  });

  socket.on('order:viewer-joined', (data: SocketEvents['order:viewer-joined']) => {
    const viewers = sharedState.orderViewers[data.orderId] || [];
    if (viewers.some((viewer) => viewer.expertId === data.expertId)) return;
    publish({
      orderViewers: {
        ...sharedState.orderViewers,
        [data.orderId]: [
          ...viewers,
          { expertId: data.expertId, expertEmail: data.expertEmail },
        ],
      },
    });
  });

  socket.on('order:viewer-left', (data: SocketEvents['order:viewer-left']) => {
    const viewers = sharedState.orderViewers[data.orderId];
    if (!viewers) return;
    const filtered = viewers.filter((viewer) => viewer.expertId !== data.expertId);
    const orderViewers = { ...sharedState.orderViewers };
    if (filtered.length === 0) delete orderViewers[data.orderId];
    else orderViewers[data.orderId] = filtered;
    publish({ orderViewers });
  });

  socket.on('stats:update', (stats: DeskStats) => {
    notify('onStatsUpdate', stats);
  });

  socket.on('pong', (data: { timestamp: number }) => {
    publish({ latency: Date.now() - data.timestamp });
  });

  pingInterval = setInterval(() => {
    if (socket.connected) socket.emit('ping');
  }, 30_000);

  return socket;
}

function destroySocket() {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  publish(INITIAL_STATE);
}

function acquireSocket() {
  activeConsumers += 1;
  ensureSocket();
}

function releaseSocket() {
  activeConsumers = Math.max(0, activeConsumers - 1);
  if (activeConsumers > 0) return;
  disconnectTimer = setTimeout(() => {
    if (activeConsumers === 0) destroySocket();
  }, 1_000);
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    autoConnect = true,
    onNewOrder,
    onIntakeReady,
    onStatusChange,
    onGenerationComplete,
    onOrderClaimed,
    onStatsUpdate,
  } = options;
  const [state, setState] = useState<SharedSocketState>(sharedState);
  const callbacksRef = useRef<SocketCallbacks>({
    onNewOrder,
    onIntakeReady,
    onStatusChange,
    onGenerationComplete,
    onOrderClaimed,
    onStatsUpdate,
  });

  useEffect(() => {
    callbacksRef.current = {
      onNewOrder,
      onIntakeReady,
      onStatusChange,
      onGenerationComplete,
      onOrderClaimed,
      onStatsUpdate,
    };
  }, [
    onNewOrder,
    onIntakeReady,
    onStatusChange,
    onGenerationComplete,
    onOrderClaimed,
    onStatsUpdate,
  ]);

  useEffect(() => {
    const subscriber: SocketSubscriber = {
      update: setState,
      callbacks: callbacksRef,
    };
    subscribers.add(subscriber);
    setState(sharedState);
    if (autoConnect) acquireSocket();

    return () => {
      subscribers.delete(subscriber);
      if (autoConnect) releaseSocket();
    };
  }, [autoConnect]);

  const connect = useCallback(() => {
    ensureSocket();
  }, []);

  const disconnect = useCallback(() => {
    destroySocket();
  }, []);

  const focusOrder = useCallback((orderId: string) => {
    sharedSocket?.emit('order:focus', { orderId });
  }, []);

  const blurOrder = useCallback((orderId: string) => {
    sharedSocket?.emit('order:blur', { orderId });
  }, []);

  const sendCursor = useCallback(
    (orderId: string, position: number, selection?: { from: number; to: number }) => {
      sharedSocket?.emit('editor:cursor', { orderId, position, selection });
    },
    [],
  );

  return {
    ...state,
    connect,
    disconnect,
    focusOrder,
    blurOrder,
    sendCursor,
    socket: sharedSocket,
  };
}
