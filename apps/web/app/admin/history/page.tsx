'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast, Toaster } from 'sonner';
import { motion } from 'framer-motion';
import { RefreshCw, RotateCcw, Eye, Calendar, Euro, User, FileText } from 'lucide-react';

import { Order } from '../../../lib/types';

const levelNames: Record<number, { name: string; color: string }> = {
    1: { name: 'Initié', color: 'from-emerald-500 to-emerald-600' },
    2: { name: 'Mystique', color: 'from-blue-500 to-blue-600' },
    3: { name: 'Profond', color: 'from-purple-500 to-purple-600' },
    4: { name: 'Intégrale', color: 'from-amber-500 to-amber-600' },
};

export default function HistoryPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [regenerating, setRegenerating] = useState<string | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const getToken = () => localStorage.getItem('expert_token');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const token = getToken();
        if (!token) return;

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/history`, {
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

    const handleRegenerate = async (orderId: string) => {
        const token = getToken();
        setRegenerating(orderId);

        try {
            const res = await fetch(`${apiUrl}/api/expert/regenerate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ orderId }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Échec de la régénération');
            }

            toast.success('Régénération lancée !');
            fetchData();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Échec de la régénération';
            toast.error(message);
        } finally {
            setRegenerating(null);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-8">
            <Toaster position="top-center" richColors />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Historique</h1>
                    <p className="text-white/60">Consultez les commandes terminées et régénérez si nécessaire</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Orders List */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10">
                        <h2 className="text-lg font-bold text-white">Commandes Complétées</h2>
                        <p className="text-white/50 text-sm">{orders.length} commandes</p>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto p-4 space-y-3">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="bg-white/5 rounded-xl p-4 animate-pulse">
                                    <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                                    <div className="h-3 bg-white/5 rounded w-1/2" />
                                </div>
                            ))
                        ) : orders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-white/40">
                                <FileText className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-sm">Aucune commande dans l&apos;historique</p>
                            </div>
                        ) : (
                            orders.map((order, index) => {
                                const level = levelNames[order.level] || levelNames[1];
                                return (
                                    <motion.div
                                        key={order.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedOrder?.id === order.id
                                            ? 'bg-white/10 border-amber-500/30'
                                            : 'bg-white/5 border-transparent hover:border-white/10'
                                            }`}
                                        onClick={() => handleViewOrder(order)}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <span className="font-mono text-white font-bold">{order.orderNumber}</span>
                                                <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${order.status === 'COMPLETED'
                                                    ? 'bg-emerald-500/20 text-emerald-400'
                                                    : 'bg-rose-500/20 text-rose-400'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <span className={`px-2 py-0.5 bg-gradient-to-r ${level.color} rounded text-white text-xs font-bold`}>
                                                {level.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-white/50 text-xs">
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {order.userName || order.userEmail}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(order.createdAt)}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Order Details */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
                    {selectedOrder ? (
                        <>
                            <div className="p-4 border-b border-white/10 bg-white/5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-mono text-white font-bold text-lg">{selectedOrder.orderNumber}</span>
                                    <span className={`px-3 py-1 bg-gradient-to-r ${levelNames[selectedOrder.level]?.color} rounded-lg text-white text-xs font-bold`}>
                                        {levelNames[selectedOrder.level]?.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 text-white/60 text-sm">
                                    <span className="flex items-center gap-1">
                                        <User className="w-4 h-4" />
                                        {selectedOrder.userName || selectedOrder.userEmail}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Euro className="w-4 h-4" />
                                        {(selectedOrder.amount / 100).toFixed(0)}€
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 max-h-[400px] overflow-y-auto">
                                {selectedOrder.generatedContent ? (
                                    <div className="space-y-4">
                                        {selectedOrder.generatedContent.lecture && (
                                            <div className="bg-white/5 rounded-xl p-4">
                                                <h4 className="text-xs font-bold text-amber-400 uppercase mb-2">Lecture</h4>
                                                <p className="text-white/80 text-sm whitespace-pre-wrap">
                                                    {selectedOrder.generatedContent.lecture}
                                                </p>
                                            </div>
                                        )}
                                        {selectedOrder.deliveredAt && (
                                            <p className="text-xs text-white/40">
                                                Livré le {formatDate(selectedOrder.deliveredAt)}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-white/40 italic">Aucun contenu généré</p>
                                )}
                            </div>

                            <div className="p-4 border-t border-white/10">
                                <button
                                    onClick={() => handleRegenerate(selectedOrder.id)}
                                    disabled={regenerating === selectedOrder.id}
                                    className="w-full py-3 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className={`w-5 h-5 ${regenerating === selectedOrder.id ? 'animate-spin' : ''}`} />
                                    Régénérer la Lecture
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-white/40">
                            <Eye className="w-12 h-12 mb-4 opacity-50" />
                            <p className="text-sm">Sélectionnez une commande pour voir les détails</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
