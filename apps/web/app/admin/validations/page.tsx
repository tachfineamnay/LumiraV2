'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { OrderQueue } from '../../../components/admin/OrderQueue';
import { ContentValidator } from '../../../components/admin/ContentValidator';

interface Order {
    id: string;
    orderNumber: string;
    userName: string | null;
    userEmail: string;
    level: number;
    amount: number;
    status: string;
    createdAt: string;
    generatedContent?: {
        lecture?: string;
        audio?: string;
        mandala?: string;
        rituals?: string[];
    };
    revisionCount?: number;
}

export default function ValidationsPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const getToken = () => localStorage.getItem('expert_token');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const token = getToken();
        if (!token) return;

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/validation`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setOrders(data.data || []);
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

    const handleValidate = async (orderId: string, action: 'approve' | 'reject', notes?: string, reason?: string) => {
        const token = getToken();
        const res = await fetch(`${apiUrl}/api/expert/validate-content`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                orderId,
                action,
                validationNotes: notes,
                rejectionReason: reason,
            }),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Échec de la validation');
        }

        setSelectedOrder(null);
        fetchData();
    };

    return (
        <div className="space-y-8">
            <Toaster position="top-center" richColors />

            <div>
                <h1 className="text-2xl font-bold text-white mb-2">Validations</h1>
                <p className="text-white/60">Vérifiez et approuvez le contenu généré avant livraison</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <OrderQueue
                    orders={orders}
                    title="En attente de validation"
                    loading={loading}
                    onRefresh={fetchData}
                    onView={handleViewOrder}
                    showTake={false}
                    emptyMessage="Aucun contenu à valider"
                />
                <ContentValidator
                    selectedOrder={selectedOrder}
                    onValidate={handleValidate}
                />
            </div>
        </div>
    );
}
