'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    FileText,
    User,
    Calendar,
    Hash,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import { StudioLayout } from '../../../../components/admin/studio';

interface OrderDetail {
    id: string;
    orderNumber: string;
    userName: string | null;
    userEmail: string;
    level: number;
    amount: number;
    status: string;
    createdAt: string;
    formData?: Record<string, unknown>;
    generatedContent?: {
        lecture?: string;
        audio?: string;
        mandala?: string;
        rituals?: string[];
        generatedAt?: string;
    };
    user?: {
        id?: string;
        refId?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        profile?: {
            birthDate?: string;
            birthTime?: string;
            birthPlace?: string;
            specificQuestion?: string;
            objective?: string;
        };
    };
}

export default function OrderStudioPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = params.id as string;

    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const getToken = () => localStorage.getItem('expert_token');

    const fetchOrder = useCallback(async () => {
        const token = getToken();
        if (!token) {
            router.push('/admin');
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                throw new Error('Commande non trouvée');
            }

            const data = await res.json();
            setOrder(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur de chargement');
            toast.error('Impossible de charger la commande');
        } finally {
            setLoading(false);
        }
    }, [orderId, apiUrl, router]);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    // Handle AI request for content refinement
    const handleAIRequest = async (prompt: string, currentContent: string): Promise<string> => {
        const token = getToken();

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}/refine`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt,
                    currentContent,
                }),
            });

            if (!res.ok) {
                throw new Error('Erreur lors du raffinement');
            }

            const data = await res.json();

            // Return both the chat response and optionally the updated content
            if (data.updatedContent) {
                return `${data.message}\n\n---CONTENT_UPDATE---\n${data.updatedContent}`;
            }

            return data.message || "J'ai bien reçu votre demande. Le contenu a été mis à jour.";
        } catch (err) {
            console.error('AI request failed:', err);
            throw err;
        }
    };

    // Handle sealing/validating the order
    const handleSeal = async (content: string) => {
        const token = getToken();

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}/validate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content,
                    approval: 'APPROVED',
                }),
            });

            if (!res.ok) {
                throw new Error('Échec de la validation');
            }

            toast.success('Lecture scellée avec succès !', {
                description: 'Le client sera notifié automatiquement.',
            });

            // Redirect back to orders list after short delay
            setTimeout(() => {
                router.push('/admin/orders');
            }, 1500);
        } catch (err) {
            toast.error('Erreur lors du scellement', {
                description: err instanceof Error ? err.message : 'Veuillez réessayer',
            });
            throw err;
        }
    };

    // Format initial content from order
    const getInitialContent = (): string => {
        if (!order) return '';

        const lecture = order.generatedContent?.lecture;
        if (lecture) {
            return lecture;
        }

        // Fallback placeholder
        return `# Lecture Spirituelle pour ${order.user?.firstName || order.userName || 'Client'}

## Introduction

*Le contenu sera généré ici...*

---

> "Votre chemin spirituel commence maintenant."

`;
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-void flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto mb-4" />
                    <p className="text-divine/60">Chargement du Studio...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !order) {
        return (
            <div className="min-h-screen bg-void flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center max-w-md"
                >
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-divine mb-2">
                        Commande introuvable
                    </h2>
                    <p className="text-divine/60 mb-6">
                        {error || 'Cette commande n\'existe pas ou vous n\'avez pas les droits d\'accès.'}
                    </p>
                    <button
                        onClick={() => router.push('/admin/orders')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 text-gold hover:bg-gold/30 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour aux commandes
                    </button>
                </motion.div>
            </div>
        );
    }

    const clientName = order.user?.firstName
        ? `${order.user.firstName} ${order.user.lastName || ''}`
        : order.userName || order.userEmail;

    const getStatusBadge = (status: string) => {
        const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
            PENDING: { color: 'bg-amber-500/20 text-amber-400', icon: <Clock className="w-3.5 h-3.5" />, label: 'En attente' },
            PROCESSING: { color: 'bg-blue-500/20 text-blue-400', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: 'En cours' },
            AWAITING_VALIDATION: { color: 'bg-purple-500/20 text-purple-400', icon: <FileText className="w-3.5 h-3.5" />, label: 'À valider' },
            COMPLETED: { color: 'bg-emerald-500/20 text-emerald-400', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Terminée' },
        };

        const config = statusConfig[status] || statusConfig.PENDING;

        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
                {config.icon}
                {config.label}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-void">
            <Toaster position="top-right" richColors />

            {/* Header */}
            <header className="border-b border-gold/20 bg-void-dark/50 backdrop-blur-sm sticky top-0 z-40">
                <div className="max-w-[1800px] mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        {/* Left: Back + Order Info */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push('/admin/orders')}
                                className="p-2 rounded-lg text-divine/60 hover:text-divine hover:bg-gold/10 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-gold/20 to-amber-500/20">
                                    <FileText className="w-5 h-5 text-gold" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="font-semibold text-divine">
                                            {order.orderNumber}
                                        </h1>
                                        {getStatusBadge(order.status)}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-divine/50">
                                        <span className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {clientName}
                                        </span>
                                        {order.user?.refId && (
                                            <span className="flex items-center gap-1 font-mono">
                                                <Hash className="w-3 h-3" />
                                                {order.user.refId}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Level Badge */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-divine/50">Niveau</span>
                            <span className="px-3 py-1 rounded-full bg-gold/20 text-gold text-sm font-medium">
                                {order.level === 1 && 'Initié'}
                                {order.level === 2 && 'Mystique'}
                                {order.level === 3 && 'Profond'}
                                {order.level === 4 && 'Intégral'}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Studio Content */}
            <main className="max-w-[1800px] mx-auto p-4">
                <StudioLayout
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    clientName={clientName}
                    clientRefId={order.user?.refId}
                    initialContent={getInitialContent()}
                    onSeal={handleSeal}
                    onAIRequest={handleAIRequest}
                />
            </main>
        </div>
    );
}
