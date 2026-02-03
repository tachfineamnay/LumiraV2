'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api';

export interface ClientNotification {
    id: string;
    type: 'EXPERT_VALIDATION' | 'ORDER_COMPLETED' | 'CONTENT_READY' | 'SYSTEM';
    title: string;
    message: string;
    metadata?: {
        expertName?: string;
        orderId?: string;
        orderNumber?: string;
        level?: number;
    };
    read: boolean;
    readAt?: string;
    createdAt: string;
}

interface UseClientNotificationsOptions {
    enabled?: boolean;
    pollingInterval?: number;
    showToast?: boolean;
}

/**
 * Hook pour gérer les notifications client dans le Sanctuaire
 * Affiche notamment quand un expert a validé une lecture
 */
export function useClientNotifications({
    enabled = true,
    pollingInterval = 30000, // Check every 30 seconds
    showToast = true,
}: UseClientNotificationsOptions = {}) {
    const [notifications, setNotifications] = useState<ClientNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const lastNotificationIdRef = useRef<string | null>(null);

    const fetchNotifications = useCallback(async (showNewToast = true) => {
        try {
            const { data } = await api.get<{
                notifications: ClientNotification[];
                unreadCount: number;
            }>('/client/notifications?limit=10');

            const newNotifications = data.notifications;
            
            // Check for new notifications (compare with last known)
            if (showNewToast && showToast && lastNotificationIdRef.current && newNotifications.length > 0) {
                const latestNotification = newNotifications[0];
                
                if (latestNotification.id !== lastNotificationIdRef.current && !latestNotification.read) {
                    // New notification arrived!
                    if (latestNotification.type === 'EXPERT_VALIDATION') {
                        toast.success(
                            `👁️ ${latestNotification.title}`,
                            {
                                description: latestNotification.message,
                                duration: 8000,
                                action: {
                                    label: 'Voir ma lecture',
                                    onClick: () => {
                                        window.location.href = '/sanctuaire';
                                    },
                                },
                            }
                        );
                    } else {
                        toast.info(latestNotification.title, {
                            description: latestNotification.message,
                            duration: 5000,
                        });
                    }
                }
            }

            // Update last known notification ID
            if (newNotifications.length > 0) {
                lastNotificationIdRef.current = newNotifications[0].id;
            }

            setNotifications(newNotifications);
            setUnreadCount(data.unreadCount);
            setIsLoading(false);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
            setIsLoading(false);
        }
    }, [showToast]);

    // Initial fetch and polling
    useEffect(() => {
        if (!enabled) return;

        // Initial fetch (don't show toast)
        fetchNotifications(false);

        // Set up polling
        const interval = setInterval(() => {
            fetchNotifications(true);
        }, pollingInterval);

        return () => clearInterval(interval);
    }, [enabled, pollingInterval, fetchNotifications]);

    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            await api.patch(`/client/notifications/${notificationId}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }, []);

    const markAllAsRead = useCallback(async () => {
        try {
            await api.post('/client/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    }, []);

    // Get the most recent expert validation for display in dashboard
    const latestExpertValidation = notifications.find(
        n => n.type === 'EXPERT_VALIDATION'
    );

    // Format relative time
    const getRelativeTime = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'à l\'instant';
        if (diffMins < 60) return `il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
        if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
        if (diffDays === 1) return 'hier';
        if (diffDays < 7) return `il y a ${diffDays} jours`;
        return date.toLocaleDateString('fr-FR');
    };

    return {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        latestExpertValidation,
        getRelativeTime,
        refetch: () => fetchNotifications(false),
    };
}
