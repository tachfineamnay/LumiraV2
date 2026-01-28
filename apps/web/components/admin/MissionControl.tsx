'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    // Pipeline icons
    CreditCard,
    Cpu,
    Eye,
    CheckCircle2,
    Send,
    // Action icons
    Play,
    RotateCcw,
    Sparkles,
    // UI icons
    ChevronDown,
    Search,
    Euro,
    Loader2,
    TrendingUp,
    X
} from 'lucide-react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

interface Order {
    id: string;
    orderNumber: string;
    userName: string | null;
    userEmail: string;
    userId?: string;
    level: number;
    amount: number;
    status: 'PENDING' | 'PROCESSING' | 'AWAITING_VALIDATION' | 'COMPLETED' | 'FAILED';
    createdAt: string;
    paidAt?: string;
    deliveredAt?: string;
    user?: {
        refId?: string;
        firstName?: string;
        lastName?: string;
    };
}

interface PipelineStats {
    pending: number;
    processing: number;
    validation: number;
    completed: number;
    failed: number;
    todayRevenue: number;
    totalRevenue: number;
}

type PipelineStage = 'PENDING' | 'PROCESSING' | 'AWAITING_VALIDATION' | 'COMPLETED';

// =============================================================================
// CONSTANTS
// =============================================================================

const PIPELINE_STAGES: { key: PipelineStage; label: string; icon: React.ElementType; color: string; bgColor: string }[] = [
    { key: 'PENDING', label: 'Paiement reçu', icon: CreditCard, color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20' },
    { key: 'PROCESSING', label: 'Génération IA', icon: Cpu, color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20' },
    { key: 'AWAITING_VALIDATION', label: 'Validation Expert', icon: Eye, color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20' },
    { key: 'COMPLETED', label: 'Livré', icon: CheckCircle2, color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
];

const LEVEL_NAMES: Record<number, string> = {
    1: 'Initié',
    2: 'Mystique',
    3: 'Profond',
    4: 'Intégral',
};

// =============================================================================
// PIPELINE CARD COMPONENT
// =============================================================================

function PipelineCard({ 
    order, 
    onAction, 
    isSelected,
    onSelect 
}: { 
    order: Order; 
    onAction: (action: string, order: Order) => void;
    isSelected: boolean;
    onSelect: (order: Order) => void;
}) {
    const router = useRouter();
    const timeSince = (date: string) => {
        const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
        if (seconds < 60) return 'à l\'instant';
        if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)}min`;
        if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)}h`;
        return `il y a ${Math.floor(seconds / 86400)}j`;
    };

    const handleOpenStudio = () => {
        router.push(`/admin/orders/${order.id}`);
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ scale: 1.01 }}
            onClick={() => onSelect(order)}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                isSelected 
                    ? 'bg-amber-500/10 border-amber-500/30' 
                    : 'bg-slate-800/50 border-white/5 hover:border-white/10'
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-white">
                    {order.orderNumber}
                </span>
                <span className="text-[10px] text-slate-500">
                    {timeSince(order.createdAt)}
                </span>
            </div>

            {/* Client Info */}
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                    {(order.userName || order.userEmail)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 truncate">
                        {order.userName || order.userEmail.split('@')[0]}
                    </p>
                    {order.user?.refId && (
                        <p className="text-[10px] text-slate-500 font-mono">{order.user.refId}</p>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    order.level === 1 ? 'bg-purple-500/20 text-purple-300' :
                    order.level === 2 ? 'bg-blue-500/20 text-blue-300' :
                    order.level === 3 ? 'bg-emerald-500/20 text-emerald-300' :
                    'bg-amber-500/20 text-amber-300'
                }`}>
                    {LEVEL_NAMES[order.level] || 'Initié'}
                </span>
                <span className="text-xs font-bold text-slate-400">{order.amount}€</span>
            </div>

            {/* Quick Actions (on hover/select) */}
            {isSelected && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 pt-3 border-t border-white/5 flex gap-2"
                >
                    {(order.status === 'PENDING' || order.status === 'PROCESSING') && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOpenStudio(); }}
                            className="flex-1 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-[10px] font-bold hover:bg-blue-500/30 transition-colors flex items-center justify-center gap-1"
                        >
                            <Play className="w-3 h-3" /> Studio IA
                        </button>
                    )}
                    {order.status === 'AWAITING_VALIDATION' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOpenStudio(); }}
                            className="flex-1 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-[10px] font-bold hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-1"
                        >
                            <Sparkles className="w-3 h-3" /> Valider
                        </button>
                    )}
                    {order.status === 'COMPLETED' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAction('resend', order); }}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-1"
                        >
                            <Send className="w-3 h-3" /> Renvoyer
                        </button>
                    )}
                </motion.div>
            )}
        </motion.div>
    );
}

// =============================================================================
// PIPELINE COLUMN COMPONENT
// =============================================================================

function PipelineColumn({ 
    stage, 
    orders, 
    count,
    selectedOrder,
    onSelectOrder,
    onAction,
    isLoading
}: { 
    stage: typeof PIPELINE_STAGES[number];
    orders: Order[];
    count: number;
    selectedOrder: Order | null;
    onSelectOrder: (order: Order) => void;
    onAction: (action: string, order: Order) => void;
    isLoading: boolean;
}) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const Icon = stage.icon;

    return (
        <div className="flex flex-col h-full">
            {/* Column Header */}
            <div 
                className={`p-3 rounded-t-xl border-b-2 ${stage.bgColor} flex items-center justify-between cursor-pointer`}
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${stage.color}`} />
                    <span className="text-xs font-bold text-white">{stage.label}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${stage.bgColor} ${stage.color}`}>
                        {count}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                </div>
            </div>

            {/* Column Content */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="flex-1 overflow-hidden"
                    >
                        <div className="p-2 space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
                                </div>
                            ) : orders.length === 0 ? (
                                <div className="text-center py-8 text-xs text-slate-500">
                                    Aucune commande
                                </div>
                            ) : (
                                orders.map((order) => (
                                    <PipelineCard
                                        key={order.id}
                                        order={order}
                                        isSelected={selectedOrder?.id === order.id}
                                        onSelect={onSelectOrder}
                                        onAction={onAction}
                                    />
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// =============================================================================
// ORDER DETAIL PANEL
// =============================================================================

function OrderDetailPanel({ 
    order, 
    onClose,
    onAction 
}: { 
    order: Order; 
    onClose: () => void;
    onAction: (action: string, order: Order) => void;
}) {
    const router = useRouter();
    const stage = PIPELINE_STAGES.find(s => s.key === order.status);

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-80 bg-slate-900/95 border-l border-white/5 p-4 flex flex-col h-full"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="font-mono text-sm font-bold text-white">{order.orderNumber}</h3>
                    <p className="text-xs text-slate-500">Détails de la commande</p>
                </div>
                <button 
                    onClick={onClose}
                    title="Fermer"
                    className="p-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Status */}
            {stage && (
                <div className={`p-3 rounded-xl ${stage.bgColor} border mb-4`}>
                    <div className="flex items-center gap-2">
                        <stage.icon className={`w-5 h-5 ${stage.color}`} />
                        <div>
                            <p className={`text-sm font-bold ${stage.color}`}>{stage.label}</p>
                            <p className="text-[10px] text-slate-400">Étape actuelle</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Client Info */}
            <div className="space-y-3 mb-6">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Client</h4>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-amber-400">
                        {(order.userName || order.userEmail)[0].toUpperCase()}
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">
                            {order.userName || order.userEmail.split('@')[0]}
                        </p>
                        <p className="text-xs text-slate-500">{order.userEmail}</p>
                        {order.user?.refId && (
                            <p className="text-[10px] font-mono text-amber-400/70">{order.user.refId}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Order Details */}
            <div className="space-y-3 mb-6">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Détails</h4>
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-800/50 border border-white/5">
                        <Euro className="w-4 h-4 text-emerald-400 mb-1" />
                        <p className="text-lg font-bold text-white">{order.amount}€</p>
                        <p className="text-[10px] text-slate-500">Montant</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/50 border border-white/5">
                        <Sparkles className="w-4 h-4 text-purple-400 mb-1" />
                        <p className="text-lg font-bold text-white">{LEVEL_NAMES[order.level]}</p>
                        <p className="text-[10px] text-slate-500">Niveau</p>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3 mb-6 flex-1">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Timeline</h4>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-slate-400">Paiement</span>
                        <span className="ml-auto text-slate-500">
                            {new Date(order.createdAt).toLocaleString('fr-FR', { 
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                            })}
                        </span>
                    </div>
                    {order.status !== 'PENDING' && (
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full bg-blue-400" />
                            <span className="text-slate-400">Génération</span>
                            <span className="ml-auto text-slate-500">En cours...</span>
                        </div>
                    )}
                    {(order.status === 'AWAITING_VALIDATION' || order.status === 'COMPLETED') && (
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full bg-purple-400" />
                            <span className="text-slate-400">Validation</span>
                            <span className="ml-auto text-slate-500">À faire</span>
                        </div>
                    )}
                    {order.status === 'COMPLETED' && order.deliveredAt && (
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-slate-400">Livraison</span>
                            <span className="ml-auto text-slate-500">
                                {new Date(order.deliveredAt).toLocaleString('fr-FR', { 
                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                                })}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
                {(order.status === 'PENDING' || order.status === 'PROCESSING') && (
                    <button
                        onClick={() => router.push(`/admin/orders/${order.id}`)}
                        className="w-full py-3 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <Play className="w-4 h-4" />
                        Ouvrir le Studio IA
                    </button>
                )}
                {order.status === 'AWAITING_VALIDATION' && (
                    <button
                        onClick={() => router.push(`/admin/orders/${order.id}`)}
                        className="w-full py-3 rounded-xl bg-purple-500 text-white text-sm font-bold hover:bg-purple-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-4 h-4" />
                        Valider la lecture
                    </button>
                )}
                {order.status === 'COMPLETED' && (
                    <button
                        onClick={() => onAction('resend', order)}
                        className="w-full py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                    >
                        <Send className="w-4 h-4" />
                        Renvoyer au client
                    </button>
                )}
                <button
                    onClick={() => router.push(`/admin/clients?id=${order.userId}`)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
                >
                    Voir le profil client
                </button>
            </div>
        </motion.div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MissionControlDashboard() {
    const router = useRouter();
    const [orders, setOrders] = useState<Record<PipelineStage, Order[]>>({
        PENDING: [],
        PROCESSING: [],
        AWAITING_VALIDATION: [],
        COMPLETED: [],
    });
    const [stats, setStats] = useState<PipelineStats>({
        pending: 0,
        processing: 0,
        validation: 0,
        completed: 0,
        failed: 0,
        todayRevenue: 0,
        totalRevenue: 0,
    });
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const getToken = () => localStorage.getItem('expert_token');

    // Fetch all pipeline data
    const fetchPipelineData = useCallback(async () => {
        const token = getToken();
        if (!token) {
            router.push('/admin/login');
            return;
        }

        try {
            setLoading(true);
            const [pendingRes, processingRes, validationRes, completedRes, statsRes] = await Promise.all([
                fetch(`${apiUrl}/api/expert/orders/pending?limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${apiUrl}/api/expert/orders/processing?limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${apiUrl}/api/expert/orders/validation?limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${apiUrl}/api/expert/orders?status=COMPLETED&limit=20`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${apiUrl}/api/expert/stats`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            const [pending, processing, validation, completed, statsData] = await Promise.all([
                pendingRes.ok ? pendingRes.json() : { data: [] },
                processingRes.ok ? processingRes.json() : { data: [] },
                validationRes.ok ? validationRes.json() : { data: [] },
                completedRes.ok ? completedRes.json() : { data: [] },
                statsRes.ok ? statsRes.json() : {} as Record<string, number>,
            ]);

            setOrders({
                PENDING: pending.data || [],
                PROCESSING: processing.data || [],
                AWAITING_VALIDATION: validation.data || [],
                COMPLETED: completed.data || [],
            });

            const typedStats = statsData as Record<string, number>;
            setStats({
                pending: typedStats.pendingOrders || 0,
                processing: typedStats.processingOrders || 0,
                validation: typedStats.awaitingValidation || 0,
                completed: typedStats.completedOrders || 0,
                failed: typedStats.failedOrders || 0,
                todayRevenue: typedStats.todayRevenue || 0,
                totalRevenue: typedStats.totalRevenue || 0,
            });
        } catch (err) {
            console.error('Pipeline fetch error:', err);
            toast.error('Erreur de chargement du pipeline');
        } finally {
            setLoading(false);
        }
    }, [apiUrl, router]);

    useEffect(() => {
        fetchPipelineData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchPipelineData, 30000);
        return () => clearInterval(interval);
    }, [fetchPipelineData]);

    // Handle actions
    const handleAction = async (action: string, order: Order) => {
        const token = getToken();
        if (!token) return;

        try {
            if (action === 'generate') {
                const res = await fetch(`${apiUrl}/api/expert/orders/${order.id}/assign`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    toast.success(`Génération lancée pour ${order.orderNumber}`);
                    fetchPipelineData();
                }
            } else if (action === 'resend') {
                toast.success(`Email renvoyé pour ${order.orderNumber}`);
            }
        } catch {
            toast.error('Erreur lors de l\'action');
        }
    };

    // Filter orders by search
    const filterOrders = (orderList: Order[]) => {
        if (!searchQuery) return orderList;
        const query = searchQuery.toLowerCase();
        return orderList.filter(o => 
            o.orderNumber.toLowerCase().includes(query) ||
            o.userName?.toLowerCase().includes(query) ||
            o.userEmail.toLowerCase().includes(query) ||
            o.user?.refId?.toLowerCase().includes(query)
        );
    };

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Mission Control</h1>
                    <p className="text-sm text-slate-500">Pipeline de traitement en temps réel</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher..."
                            className="w-64 pl-10 pr-4 py-2 rounded-xl bg-slate-800/50 border border-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/30"
                        />
                    </div>

                    {/* Quick Stats */}
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-bold text-emerald-400">{stats.totalRevenue}€</span>
                        <span className="text-xs text-slate-500">total</span>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={fetchPipelineData}
                        disabled={loading}
                        title="Actualiser le pipeline"
                        className="p-2 rounded-xl bg-slate-800/50 border border-white/5 hover:bg-slate-700/50 transition-colors"
                    >
                        <RotateCcw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Pipeline Summary */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {PIPELINE_STAGES.map((stage) => {
                    const count = stage.key === 'PENDING' ? stats.pending :
                                  stage.key === 'PROCESSING' ? stats.processing :
                                  stage.key === 'AWAITING_VALIDATION' ? stats.validation :
                                  stats.completed;
                    return (
                        <div key={stage.key} className={`p-4 rounded-xl ${stage.bgColor} border`}>
                            <div className="flex items-center justify-between">
                                <stage.icon className={`w-5 h-5 ${stage.color}`} />
                                <span className={`text-2xl font-bold ${stage.color}`}>{count}</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">{stage.label}</p>
                        </div>
                    );
                })}
            </div>

            {/* Pipeline Grid */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* Pipeline Columns */}
                <div className="flex-1 grid grid-cols-4 gap-4">
                    {PIPELINE_STAGES.map((stage) => (
                        <div key={stage.key} className="bg-slate-800/30 rounded-xl border border-white/5 overflow-hidden">
                            <PipelineColumn
                                stage={stage}
                                orders={filterOrders(orders[stage.key])}
                                count={orders[stage.key].length}
                                selectedOrder={selectedOrder}
                                onSelectOrder={setSelectedOrder}
                                onAction={handleAction}
                                isLoading={loading}
                            />
                        </div>
                    ))}
                </div>

                {/* Detail Panel */}
                <AnimatePresence>
                    {selectedOrder && (
                        <OrderDetailPanel
                            order={selectedOrder}
                            onClose={() => setSelectedOrder(null)}
                            onAction={handleAction}
                        />
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
