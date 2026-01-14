'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { StatsCards } from '../../../components/admin/StatsCards';
import { OrderQueue } from '../../../components/admin/OrderQueue';
import { ContentGenerator } from '../../../components/admin/ContentGenerator';

import { Order } from '../../../lib/types';

export default function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [processingOrders, setProcessingOrders] = useState<Order[]>([]);
    const [stats, setStats] = useState({
        pendingOrders: 0,
        processingOrders: 0,
        awaitingValidation: 0,
        completedOrders: 0,
        totalRevenue: 0,
    });
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const getToken = () => localStorage.getItem('expert_token');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const token = getToken();
        if (!token) return;

        try {
            const [ordersRes, processingRes, statsRes] = await Promise.all([
                fetch(`${apiUrl}/api/expert/orders/pending`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${apiUrl}/api/expert/orders/processing`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                fetch(`${apiUrl}/api/expert/stats`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            if (ordersRes.ok) {
                const data = await ordersRes.json();
                setOrders(data.data || []);
            }
            if (processingRes.ok) {
                const data = await processingRes.json();
                setProcessingOrders(data.data || []);
            }
            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data);
            }
        } catch {
            toast.error('Erreur de chargement');
        } finally {
            setLoading(false);
        }
    }, [apiUrl]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleTakeOrder = async (order: Order) => {
        const token = getToken();
        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${order.id}/assign`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) throw new Error('Échec de la prise en charge');

            toast.success(`Commande ${order.orderNumber} assignée !`);

            // Fetch order details and set as selected
            const detailRes = await fetch(`${apiUrl}/api/expert/orders/${order.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (detailRes.ok) {
                const detailedOrder = await detailRes.json();
                setSelectedOrder(detailedOrder);
            }

            fetchData();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Une erreur est survenue';
            toast.error(message);
        }
    };

    const handleViewOrder = async (order: Order) => {
        const token = getToken();
        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${order.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const detailedOrder = await res.json();
                setSelectedOrder(detailedOrder);
            }
        } catch {
            toast.error('Erreur de chargement');
        }
    };

    const handleProcessOrder = async (orderId: string, expertPrompt: string, expertInstructions?: string) => {
        const token = getToken();
        const res = await fetch(`${apiUrl}/api/expert/process-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ orderId, expertPrompt, expertInstructions }),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Échec de l\'envoi');
        }

        setSelectedOrder(null);
        fetchData();
    };

    return (
        <div className="space-y-8">
            <Toaster position="top-center" richColors />

            <div>
                <h1 className="text-2xl font-bold text-white mb-2">Commandes</h1>
                <p className="text-white/60">Gérez les commandes en attente et générez le contenu</p>
            </div>

            {/* Stats */}
            <StatsCards stats={stats} />

            {/* Main Content */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <OrderQueue
                        orders={orders}
                        title="File d'attente"
                        loading={loading}
                        onRefresh={fetchData}
                        onView={handleViewOrder}
                        onTake={handleTakeOrder}
                        showTake={true}
                        emptyMessage="Aucune commande en attente"
                    />
                    <OrderQueue
                        orders={processingOrders}
                        title="En cours de traitement"
                        loading={loading}
                        onRefresh={fetchData}
                        onView={handleViewOrder}
                        showTake={false}
                        showWorkspace={true}
                        emptyMessage="Aucune commande en cours"
                    />
                </div>
                <ContentGenerator
                    selectedOrder={selectedOrder}
                    onProcess={handleProcessOrder}
                />
            </div>
        </div>
    );
}
