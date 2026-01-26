'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshCw,
    FileText,
    User,
    Calendar,
    Euro,
    Sparkles,
    ArrowRight,
    CheckCircle2,
    Clock,
    Loader2,
    Search,
    Filter
} from 'lucide-react';
import { Order } from '../../../lib/types';

const LEVEL_CONFIG: Record<number, { name: string; color: string; bgColor: string }> = {
    1: { name: 'Initié', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    2: { name: 'Mystique', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    3: { name: 'Profond', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
    4: { name: 'Intégral', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
};

export default function ValidationsPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

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

    // Navigate to Studio for co-creation
    const handleOpenStudio = (order: Order) => {
        router.push(`/admin/orders/${order.id}`);
    };

    const filteredOrders = orders.filter(order => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            order.orderNumber?.toLowerCase().includes(query) ||
            order.userName?.toLowerCase().includes(query) ||
            order.userEmail?.toLowerCase().includes(query)
        );
    });

    const formatDate = (date: string) => {
        return new Intl.DateTimeFormat('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    };

    return (
        <div className="space-y-6">
            <Toaster position="top-right" richColors />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">Validations</h1>
                    <p className="text-white/60">
                        Ouvrez le <span className="text-amber-400">Studio de Co-Création</span> pour affiner et sceller le contenu
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-all disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualiser
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par numéro, nom ou email..."
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-amber-400/50 transition-colors"
                />
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/20">
                            <Clock className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">{orders.length}</p>
                            <p className="text-xs text-white/60">En attente de validation</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                            <Sparkles className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">
                                {orders.reduce((sum, o) => sum + (o.amount || 0), 0)}€
                            </p>
                            <p className="text-xs text-white/60">Revenus en attente</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/20">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-white">~15min</p>
                            <p className="text-xs text-white/60">Temps moyen de validation</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-xl bg-white/5 border border-white/10">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-white mb-2">Tout est validé !</h3>
                        <p className="text-white/60">Aucune lecture en attente de validation</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredOrders.map((order, index) => {
                            const level = LEVEL_CONFIG[order.level] || LEVEL_CONFIG[1];
                            return (
                                <motion.div
                                    key={order.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="group"
                                >
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/30 transition-all">
                                        <div className="flex items-center justify-between gap-4">
                                            {/* Left: Order Info */}
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                                                    <FileText className="w-6 h-6 text-amber-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-mono text-sm font-bold text-white">
                                                            {order.orderNumber}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${level.bgColor} ${level.color}`}>
                                                            {level.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-white/50">
                                                        <span className="flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {order.userName || order.userEmail}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            {formatDate(order.createdAt)}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Euro className="w-3 h-3" />
                                                            {order.amount}€
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right: Action Button */}
                                            <button
                                                onClick={() => handleOpenStudio(order)}
                                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900 font-semibold text-sm hover:shadow-lg hover:shadow-amber-500/25 transition-all group-hover:scale-105"
                                            >
                                                <Sparkles className="w-4 h-4" />
                                                Ouvrir le Studio
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
