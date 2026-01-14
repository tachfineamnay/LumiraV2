'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ExpertWorkspace } from '../../../../components/admin/workspace';
import { useOrderGeneration } from '../../../../hooks/useOrderGeneration';
import type { OrderDetails, SpiritualPathData, ChatSessionData } from '../../../../components/admin/workspace/ExpertWorkspace';

export default function WorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const orderId = params.orderId as string;

    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [spiritualPath, setSpiritualPath] = useState<SpiritualPathData | undefined>();
    const [chatSession, setChatSession] = useState<ChatSessionData | undefined>();
    const [loading, setLoading] = useState(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const getToken = () => localStorage.getItem('expert_token');

    const { generate, isGenerating, result: generationResult } = useOrderGeneration({
        onSuccess: () => {
            fetchOrder();
        },
    });

    const fetchOrder = useCallback(async () => {
        const token = getToken();
        if (!token) {
            router.push('/admin/login');
            return;
        }

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                throw new Error('Commande non trouvée');
            }

            const data = await res.json();
            setOrder(data);

            // Fetch spiritual path if user has one
            // TODO: Add endpoint for this
        } catch (error) {
            toast.error('Erreur de chargement de la commande');
            router.push('/admin/orders');
        } finally {
            setLoading(false);
        }
    }, [apiUrl, orderId, router]);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    const handleGenerate = async () => {
        await generate(orderId);
    };

    const handleValidate = async () => {
        const token = getToken();
        try {
            const res = await fetch(`${apiUrl}/api/expert/validate-content`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    orderId,
                    action: 'approve',
                }),
            });

            if (!res.ok) throw new Error('Échec de la validation');

            toast.success('Lecture validée et livrée !');
            fetchOrder();
        } catch (error) {
            toast.error('Erreur lors de la validation');
        }
    };

    const handleReject = async (reason: string) => {
        const token = getToken();
        try {
            const res = await fetch(`${apiUrl}/api/expert/validate-content`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    orderId,
                    action: 'reject',
                    rejectionReason: reason,
                }),
            });

            if (!res.ok) throw new Error('Échec du rejet');

            toast.success('Lecture rejetée pour régénération');
            fetchOrder();
        } catch (error) {
            toast.error('Erreur lors du rejet');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <p className="text-slate-400">Commande non trouvée</p>
            </div>
        );
    }

    return (
        <>
            <Toaster position="top-center" richColors />

            {/* Back Button */}
            <div className="fixed top-4 left-4 z-50">
                <button
                    onClick={() => router.push('/admin/orders')}
                    className="px-4 py-2 rounded-xl bg-slate-800/80 backdrop-blur-sm text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-2 border border-slate-700/50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                </button>
            </div>

            <ExpertWorkspace
                order={order}
                spiritualPath={spiritualPath}
                chatSession={chatSession}
                onGenerate={handleGenerate}
                onValidate={handleValidate}
                onReject={handleReject}
                isGenerating={isGenerating}
                generationResult={generationResult || undefined}
            />
        </>
    );
}
