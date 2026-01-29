'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';

interface Notification {
    id: string;
    type: 'new_order' | 'order_paid' | 'validation_needed' | 'system';
    title: string;
    message: string;
    orderId?: string;
    createdAt: Date;
    read: boolean;
}

interface UseNotificationsOptions {
    enabled?: boolean;
    pollingInterval?: number;
    playSound?: boolean;
    showToast?: boolean;
    onNewOrder?: (orderId: string, orderNumber: string) => void;
}

/**
 * Hook pour gérer les notifications en temps réel
 * Polling-based pour le moment, peut être remplacé par WebSocket plus tard
 */
export function useNotifications({
    enabled = true,
    pollingInterval = 15000,
    playSound = true,
    showToast = true,
    onNewOrder,
}: UseNotificationsOptions = {}) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const lastCheckRef = useRef<Date>(new Date());
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio on client side
    useEffect(() => {
        if (typeof window !== 'undefined' && playSound) {
            audioRef.current = new Audio('/sounds/notification.mp3');
            audioRef.current.volume = 0.5;
        }
    }, [playSound]);

    const playNotificationSound = useCallback(() => {
        if (audioRef.current && playSound) {
            audioRef.current.play().catch(() => {
                // Ignore autoplay restrictions
            });
        }
    }, [playSound]);

    const checkForNewOrders = useCallback(async () => {
        const token = localStorage.getItem('expert_token');
        if (!token || !enabled) return;

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/expert/orders/pending?since=${lastCheckRef.current.toISOString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.ok) {
                const data = await response.json();
                const newOrders = data.data || data || [];
                
                if (newOrders.length > 0) {
                    // Process new orders
                    const newNotifications: Notification[] = newOrders.map((order: { id: string; orderNumber: string; userName?: string; userEmail: string }) => ({
                        id: `order-${order.id}`,
                        type: 'new_order' as const,
                        title: 'Nouvelle commande',
                        message: `${order.orderNumber} - ${order.userName || order.userEmail}`,
                        orderId: order.id,
                        createdAt: new Date(),
                        read: false,
                    }));

                    setNotifications(prev => [...newNotifications, ...prev].slice(0, 50));
                    setUnreadCount(prev => prev + newNotifications.length);

                    // Play sound and show toast for first new order
                    if (newNotifications.length > 0) {
                        playNotificationSound();
                        
                        if (showToast) {
                            toast.info(
                                newNotifications.length === 1
                                    ? `🔔 ${newNotifications[0].message}`
                                    : `🔔 ${newNotifications.length} nouvelles commandes !`,
                                {
                                    duration: 5000,
                                    action: newNotifications.length === 1 && newNotifications[0].orderId
                                        ? {
                                            label: 'Voir',
                                            onClick: () => onNewOrder?.(newNotifications[0].orderId!, newNotifications[0].message),
                                        }
                                        : undefined,
                                }
                            );
                        }

                        // Call callback for first new order
                        if (onNewOrder && newNotifications[0].orderId) {
                            // Don't auto-open, just notify
                        }
                    }
                }
            }

            lastCheckRef.current = new Date();
        } catch (error) {
            console.error('Failed to check for new orders:', error);
        }
    }, [enabled, playNotificationSound, showToast, onNewOrder]);

    // Initial check and polling
    useEffect(() => {
        if (!enabled) return;

        // Check immediately
        checkForNewOrders();

        // Set up polling
        const interval = setInterval(checkForNewOrders, pollingInterval);

        return () => clearInterval(interval);
    }, [enabled, pollingInterval, checkForNewOrders]);

    // Request notification permission
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window && enabled) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }, [enabled]);

    const markAsRead = useCallback((notificationId: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
        setUnreadCount(0);
    }, []);

    return {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        checkForNewOrders,
    };
}

export type { Notification };
