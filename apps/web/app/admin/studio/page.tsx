'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Sparkles,
    Play,
    User,
    Calendar,
    Hash,
    FileText,
    ChevronRight,
    RefreshCw,
    Zap,
    Eye,
    ArrowRight,
    Timer,
    Bell,
    Layers,
    Check,
    X,
    MapPin,
    HelpCircle,
    Target,
    ImageIcon,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { StudioLayout } from '../../../components/admin/studio';
import { useNotifications } from '../../../hooks/useNotifications';

// =============================================================================
// TYPES
// =============================================================================

interface OrderInQueue {
    id: string;
    orderNumber: string;
    userName: string | null;
    userEmail: string;
    level: number;
    status: string;
    createdAt: string;
    waitTime: string;
    isUrgent: boolean;
    hasContent: boolean;
    user?: {
        firstName?: string;
        lastName?: string;
        refId?: string;
        profile?: {
            birthDate?: string;
            birthTime?: string;
            birthPlace?: string;
            specificQuestion?: string;
            objective?: string;
            facePhotoUrl?: string;
            palmPhotoUrl?: string;
            highs?: string;
            lows?: string;
        };
    };
    generatedContent?: {
        lecture?: string;
        synthesis?: {
            archetype?: string;
        };
    };
    expertPrompt?: string;
}

type WorkspacePhase = 'empty' | 'context' | 'generating' | 'review';

// =============================================================================
// HELPERS
// =============================================================================

function getWaitTime(createdAt: string): { text: string; isUrgent: boolean } {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours >= 24) {
        const days = Math.floor(diffHours / 24);
        return { text: `${days}j ${diffHours % 24}h`, isUrgent: true };
    }
    if (diffHours >= 6) {
        return { text: `${diffHours}h`, isUrgent: true };
    }
    if (diffHours >= 1) {
        return { text: `${diffHours}h ${diffMins}m`, isUrgent: false };
    }
    return { text: `${diffMins}m`, isUrgent: false };
}

function getLevelName(level: number): string {
    const names: Record<number, string> = { 1: 'Initié', 2: 'Mystique', 3: 'Profond', 4: 'Intégral' };
    return names[level] || 'Initié';
}

function getLevelColor(level: number): string {
    const colors: Record<number, string> = {
        1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        2: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        3: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        4: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    };
    return colors[level] || colors[1];
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function StudioPage() {
    const router = useRouter();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const getToken = () => localStorage.getItem('expert_token');

    // Queue state
    const [pendingOrders, setPendingOrders] = useState<OrderInQueue[]>([]);
    const [validationOrders, setValidationOrders] = useState<OrderInQueue[]>([]);
    const [recentCompleted, setRecentCompleted] = useState<OrderInQueue[]>([]);
    const [isLoadingQueue, setIsLoadingQueue] = useState(true);

    // Workspace state
    const [activeOrder, setActiveOrder] = useState<OrderInQueue | null>(null);
    const [phase, setPhase] = useState<WorkspacePhase>('empty');
    const [expertInstructions, setExpertInstructions] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);

    // Batch state
    const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
    const [isBatchMode, setIsBatchMode] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentOrder: string } | null>(null);

    // Auto-refresh
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // ==========================================================================
    // DATA FETCHING
    // ==========================================================================

    const fetchQueue = useCallback(async (showLoader = false) => {
        const token = getToken();
        if (!token) {
            router.push('/admin/login');
            return;
        }

        if (showLoader) setIsLoadingQueue(true);


        try {
            const [pendingRes, validationRes, historyRes] = await Promise.all([
                fetch(`${apiUrl}/api/expert/orders/pending`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${apiUrl}/api/expert/orders/validation`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${apiUrl}/api/expert/orders/history?limit=5`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            if (pendingRes.ok) {
                const data = await pendingRes.json();
                const orders = (data.data || data || []).map((o: OrderInQueue) => {
                    const wait = getWaitTime(o.createdAt);
                    return { ...o, waitTime: wait.text, isUrgent: wait.isUrgent, hasContent: false };
                });
                setPendingOrders(orders);
            }

            if (validationRes.ok) {
                const data = await validationRes.json();
                const orders = (data.data || data || []).map((o: OrderInQueue) => {
                    const wait = getWaitTime(o.createdAt);
                    return { ...o, waitTime: wait.text, isUrgent: wait.isUrgent, hasContent: true };
                });
                setValidationOrders(orders);
            }

            if (historyRes.ok) {
                const data = await historyRes.json();
                setRecentCompleted((data.data || data || []).slice(0, 5));
            }
        } catch (err) {
            console.error('Failed to fetch queue:', err);
        } finally {
            setIsLoadingQueue(false);
        }
    }, [apiUrl, router]);

    const fetchOrderDetails = useCallback(async (orderId: string): Promise<OrderInQueue | null> => {
        const token = getToken();
        if (!token) return null;

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (err) {
            console.error('Failed to fetch order details:', err);
        }
        return null;
    }, [apiUrl]);

    // Initial load + auto-refresh
    useEffect(() => {
        fetchQueue(true);
        refreshIntervalRef.current = setInterval(() => fetchQueue(false), 30000);
        return () => {
            if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
        };
    }, [fetchQueue]);

    // Notifications - auto-refresh queue when new order arrives
    useNotifications({
        enabled: true,
        pollingInterval: 15000,
        showToast: true,
        onNewOrder: () => fetchQueue(false),
    });

    // ==========================================================================
    // ORDER SELECTION
    // ==========================================================================

    const handleSelectOrder = async (order: OrderInQueue) => {
        // Fetch full details
        const details = await fetchOrderDetails(order.id);
        if (!details) {
            toast.error('Impossible de charger la commande');
            return;
        }

        setActiveOrder(details);
        setExpertInstructions(details.expertPrompt || '');

        // Determine phase
        if (details.status === 'AWAITING_VALIDATION' || details.generatedContent?.lecture) {
            setPhase('review');
        } else {
            setPhase('context');
        }
    };

    const handleCloseWorkspace = () => {
        setActiveOrder(null);
        setPhase('empty');
        setExpertInstructions('');
    };

    // ==========================================================================
    // GENERATION
    // ==========================================================================

    const handleGenerate = async () => {
        if (!activeOrder) return;
        const token = getToken();
        if (!token) return;

        setIsGenerating(true);
        setPhase('generating');
        setGenerationProgress(0);

        const progressInterval = setInterval(() => {
            setGenerationProgress(prev => Math.min(prev + Math.random() * 15, 90));
        }, 1000);

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${activeOrder.id}/generate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ expertPrompt: expertInstructions || undefined }),
            });

            clearInterval(progressInterval);
            setGenerationProgress(100);

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || 'Erreur lors de la génération');
            }

            toast.success('Génération terminée !');

            // Refresh order and queue
            const updated = await fetchOrderDetails(activeOrder.id);
            if (updated) {
                setActiveOrder(updated);
                setPhase('review');
            }
            fetchQueue(false);
        } catch (err) {
            clearInterval(progressInterval);
            toast.error('Échec de la génération', {
                description: err instanceof Error ? err.message : 'Veuillez réessayer',
            });
            setPhase('context');
        } finally {
            setIsGenerating(false);
        }
    };

    // ==========================================================================
    // BATCH PROCESSING
    // ==========================================================================

    const handleBatchToggle = (orderId: string) => {
        setSelectedForBatch(prev => {
            const next = new Set(prev);
            if (next.has(orderId)) {
                next.delete(orderId);
            } else {
                next.add(orderId);
            }
            return next;
        });
    };

    const handleBatchGenerate = async () => {
        if (selectedForBatch.size === 0) return;
        const token = getToken();
        if (!token) return;

        const orderIds = Array.from(selectedForBatch);
        setBatchProgress({ current: 0, total: orderIds.length, currentOrder: '' });

        for (let i = 0; i < orderIds.length; i++) {
            const orderId = orderIds[i];
            const order = pendingOrders.find(o => o.id === orderId);
            setBatchProgress({ current: i + 1, total: orderIds.length, currentOrder: order?.orderNumber || orderId });

            try {
                await fetch(`${apiUrl}/api/expert/orders/${orderId}/generate`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({}),
                });
            } catch (err) {
                console.error(`Batch generation failed for ${orderId}:`, err);
            }
        }

        toast.success(`${orderIds.length} commandes générées !`);
        setBatchProgress(null);
        setSelectedForBatch(new Set());
        setIsBatchMode(false);
        fetchQueue(false);
    };

    // ==========================================================================
    // AI REQUEST & SEAL
    // ==========================================================================

    const handleAIRequest = async (instruction: string, currentContent: string): Promise<string> => {
        if (!activeOrder) throw new Error('No active order');
        const token = getToken();

        const res = await fetch(`${apiUrl}/api/expert/orders/${activeOrder.id}/refine`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ instruction, currentContent }),
        });

        if (!res.ok) throw new Error('Erreur lors du raffinement');

        const data = await res.json();
        if (data.updatedContent) {
            return `${data.message}\n\n---CONTENT_UPDATE---\n${data.updatedContent}`;
        }
        return data.message || "Contenu mis à jour.";
    };

    const handleSeal = async (finalContent: string) => {
        if (!activeOrder) return;
        const token = getToken();

        const res = await fetch(`${apiUrl}/api/expert/orders/${activeOrder.id}/finalize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ finalContent }),
        });

        if (!res.ok) throw new Error('Échec de la validation');

        toast.success('Lecture scellée !', {
            description: 'Le client a été notifié.',
        });

        handleCloseWorkspace();
        fetchQueue(false);
    };

    // ==========================================================================
    // RENDER HELPERS
    // ==========================================================================

    const renderQueueItem = (order: OrderInQueue, showBatchCheckbox = false) => {
        const isActive = activeOrder?.id === order.id;
        const isSelected = selectedForBatch.has(order.id);
        const clientName = order.user?.firstName 
            ? `${order.user.firstName} ${order.user.lastName || ''}`.trim()
            : order.userName || order.userEmail.split('@')[0];

        return (
            <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                    "group relative p-3 rounded-xl border cursor-pointer transition-all",
                    isActive
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-slate-800/30 border-white/5 hover:bg-slate-800/50 hover:border-white/10"
                )}
                onClick={() => !isBatchMode && handleSelectOrder(order)}
            >
                {showBatchCheckbox && isBatchMode && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleBatchToggle(order.id); }}
                        className={cn(
                            "absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected
                                ? "bg-amber-500 border-amber-500 text-black"
                                : "bg-slate-800 border-slate-600 hover:border-amber-500"
                        )}
                    >
                        {isSelected && <Check className="w-4 h-4" />}
                    </button>
                )}

                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-amber-400">{order.orderNumber}</span>
                            {order.isUrgent && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400 font-bold">
                                    URGENT
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-white truncate mt-0.5">{clientName}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border", getLevelColor(order.level))}>
                            {getLevelName(order.level)}
                        </span>
                        <span className={cn("text-[10px] flex items-center gap-1", order.isUrgent ? "text-red-400" : "text-slate-500")}>
                            <Timer className="w-3 h-3" />
                            {order.waitTime}
                        </span>
                    </div>
                </div>

                {!isBatchMode && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                )}
            </motion.div>
        );
    };

    // ==========================================================================
    // RENDER
    // ==========================================================================

    if (isLoadingQueue && pendingOrders.length === 0) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Chargement du Studio...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
            <Toaster position="top-right" richColors />

            {/* ===== LEFT SIDEBAR: QUEUE ===== */}
            <aside className="w-80 lg:w-96 border-r border-white/5 bg-slate-900/30 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-white/5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Layers className="w-5 h-5 text-amber-400" />
                            File d'attente
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchQueue(false)}
                                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                title="Rafraîchir"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsBatchMode(!isBatchMode)}
                                className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    isBatchMode ? "bg-amber-500/20 text-amber-400" : "hover:bg-slate-800 text-slate-400 hover:text-white"
                                )}
                                title="Mode batch"
                            >
                                <Zap className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Batch actions */}
                    <AnimatePresence>
                        {isBatchMode && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="flex items-center gap-2 pt-2">
                                    <span className="text-xs text-slate-400">
                                        {selectedForBatch.size} sélectionné{selectedForBatch.size > 1 ? 's' : ''}
                                    </span>
                                    <div className="flex-1" />
                                    <button
                                        onClick={() => { setSelectedForBatch(new Set()); setIsBatchMode(false); }}
                                        className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleBatchGenerate}
                                        disabled={selectedForBatch.size === 0 || !!batchProgress}
                                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold disabled:opacity-50"
                                    >
                                        {batchProgress ? `${batchProgress.current}/${batchProgress.total}` : 'Générer tout'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Queue sections */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Pending */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                En attente ({pendingOrders.length})
                            </span>
                        </div>
                        <div className="space-y-2">
                            {pendingOrders.length === 0 ? (
                                <p className="text-sm text-slate-500 italic p-3">Aucune commande en attente</p>
                            ) : (
                                pendingOrders.map(order => renderQueueItem(order, true))
                            )}
                        </div>
                    </div>

                    {/* Validation */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-purple-400" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                À valider ({validationOrders.length})
                            </span>
                        </div>
                        <div className="space-y-2">
                            {validationOrders.length === 0 ? (
                                <p className="text-sm text-slate-500 italic p-3">Aucune commande à valider</p>
                            ) : (
                                validationOrders.map(order => renderQueueItem(order, false))
                            )}
                        </div>
                    </div>

                    {/* Recent completed */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Récent
                            </span>
                        </div>
                        <div className="space-y-2">
                            {recentCompleted.map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => handleSelectOrder(order)}
                                    className="p-2 rounded-lg bg-slate-800/20 border border-white/5 cursor-pointer hover:bg-slate-800/40 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs text-slate-500">{order.orderNumber}</span>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </aside>

            {/* ===== MAIN WORKSPACE ===== */}
            <main className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* Empty state */}
                    {phase === 'empty' && (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-full flex items-center justify-center"
                        >
                            <div className="text-center max-w-md">
                                <div className="w-20 h-20 rounded-2xl bg-slate-800/50 border border-white/5 flex items-center justify-center mx-auto mb-6">
                                    <FileText className="w-10 h-10 text-slate-600" />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Espace de travail</h2>
                                <p className="text-slate-400 mb-6">
                                    Sélectionnez une commande dans la file d'attente pour commencer.
                                </p>
                                {pendingOrders.length > 0 && (
                                    <button
                                        onClick={() => handleSelectOrder(pendingOrders[0])}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                                    >
                                        <ArrowRight className="w-4 h-4" />
                                        Prendre la prochaine commande
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Context phase */}
                    {phase === 'context' && activeOrder && (
                        <motion.div
                            key="context"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="h-full overflow-y-auto"
                        >
                            {/* Header */}
                            <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-sm border-b border-white/5 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={handleCloseWorkspace}
                                            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-amber-400">{activeOrder.orderNumber}</span>
                                                <span className={cn("px-2 py-0.5 rounded text-xs font-medium border", getLevelColor(activeOrder.level))}>
                                                    {getLevelName(activeOrder.level)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-400">
                                                {activeOrder.user?.firstName} {activeOrder.user?.lastName} • {activeOrder.userEmail}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Client context */}
                                <div className="lg:col-span-2 space-y-4">
                                    <div className="bg-slate-800/30 rounded-xl border border-white/5 p-6">
                                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                            <User className="w-5 h-5 text-amber-400" />
                                            Contexte Client
                                        </h3>

                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="text-xs text-slate-500 uppercase tracking-wider">Naissance</label>
                                                <p className="text-white mt-1">{activeOrder.user?.profile?.birthDate || 'Non renseigné'}</p>
                                                {activeOrder.user?.profile?.birthTime && (
                                                    <p className="text-sm text-slate-400">{activeOrder.user.profile.birthTime}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" /> Lieu
                                                </label>
                                                <p className="text-white mt-1">{activeOrder.user?.profile?.birthPlace || 'Non renseigné'}</p>
                                            </div>
                                        </div>

                                        {activeOrder.user?.profile?.specificQuestion && (
                                            <div className="mb-4">
                                                <label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                                                    <HelpCircle className="w-3 h-3" /> Question
                                                </label>
                                                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                                    <p className="text-white italic">"{activeOrder.user.profile.specificQuestion}"</p>
                                                </div>
                                            </div>
                                        )}

                                        {activeOrder.user?.profile?.objective && (
                                            <div className="mb-4">
                                                <label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                                                    <Target className="w-3 h-3" /> Objectif
                                                </label>
                                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                    <p className="text-white">{activeOrder.user.profile.objective}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            {activeOrder.user?.profile?.highs && (
                                                <div>
                                                    <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Moments de grâce</label>
                                                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                                        <p className="text-sm text-slate-300">{activeOrder.user.profile.highs}</p>
                                                    </div>
                                                </div>
                                            )}
                                            {activeOrder.user?.profile?.lows && (
                                                <div>
                                                    <label className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Épreuves</label>
                                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                                        <p className="text-sm text-slate-300">{activeOrder.user.profile.lows}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {(activeOrder.user?.profile?.facePhotoUrl || activeOrder.user?.profile?.palmPhotoUrl) && (
                                            <div className="mt-4">
                                                <label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                                                    <ImageIcon className="w-3 h-3" /> Photos
                                                </label>
                                                <div className="flex gap-3">
                                                    {activeOrder.user?.profile?.facePhotoUrl && (
                                                        <div className="w-20 h-20 rounded-lg bg-slate-800 border border-white/10 overflow-hidden">
                                                            <img src={activeOrder.user.profile.facePhotoUrl} alt="Visage" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    {activeOrder.user?.profile?.palmPhotoUrl && (
                                                        <div className="w-20 h-20 rounded-lg bg-slate-800 border border-white/10 overflow-hidden">
                                                            <img src={activeOrder.user.profile.palmPhotoUrl} alt="Paume" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Instructions + Generate */}
                                <div className="space-y-4">
                                    <div className="bg-slate-800/30 rounded-xl border border-white/5 p-6 sticky top-24">
                                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-amber-400" />
                                            Instructions IA
                                        </h3>
                                        <textarea
                                            value={expertInstructions}
                                            onChange={(e) => setExpertInstructions(e.target.value)}
                                            placeholder="Ex: Insiste sur les relations familiales..."
                                            className="w-full h-32 p-3 rounded-lg bg-slate-900/50 border border-white/10 text-white placeholder-slate-500 resize-none focus:outline-none focus:border-amber-500/30"
                                        />
                                        <p className="text-xs text-slate-500 mt-2">
                                            Optionnel : ajoutez des indications spécifiques pour personnaliser la lecture.
                                        </p>

                                        <button
                                            onClick={handleGenerate}
                                            disabled={isGenerating}
                                            className="w-full mt-4 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold flex items-center justify-center gap-2 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 transition-all"
                                        >
                                            <Play className="w-5 h-5" />
                                            Lancer la génération
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Generating phase */}
                    {phase === 'generating' && activeOrder && (
                        <motion.div
                            key="generating"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="h-full flex items-center justify-center"
                        >
                            <div className="text-center max-w-md">
                                <div className="relative w-32 h-32 mx-auto mb-8">
                                    <div className="absolute inset-0 rounded-full border-4 border-amber-500/20" />
                                    <motion.div
                                        className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                                    />
                                    <div className="absolute inset-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                                        <Sparkles className="w-12 h-12 text-amber-400 animate-pulse" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Génération en cours...</h2>
                                <p className="text-slate-400 mb-6">
                                    L'Oracle compose la lecture pour {activeOrder.user?.firstName || activeOrder.userName}
                                </p>
                                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${generationProgress}%` }}
                                    />
                                </div>
                                <p className="text-sm text-slate-500 mt-2">
                                    {generationProgress < 30 && 'Analyse du profil...'}
                                    {generationProgress >= 30 && generationProgress < 60 && 'Génération de la lecture...'}
                                    {generationProgress >= 60 && generationProgress < 90 && 'Création du parcours...'}
                                    {generationProgress >= 90 && 'Finalisation...'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Review phase */}
                    {phase === 'review' && activeOrder && (
                        <motion.div
                            key="review"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="h-full"
                        >
                            <StudioLayout
                                orderId={activeOrder.id}
                                orderNumber={activeOrder.orderNumber}
                                clientName={activeOrder.user?.firstName ? `${activeOrder.user.firstName} ${activeOrder.user.lastName || ''}` : activeOrder.userName || activeOrder.userEmail}
                                clientRefId={activeOrder.user?.refId}
                                initialContent={activeOrder.generatedContent?.lecture || ''}
                                onSeal={handleSeal}
                                onAIRequest={handleAIRequest}
                                onClose={handleCloseWorkspace}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
