'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { User, Calendar, Euro, Eye, Trash2, ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Order } from '../../lib/types';

interface OrderCardProps {
    order: Order;
    onView?: (order: Order) => void;
    onTake?: (order: Order) => void;
    onDelete?: (order: Order) => void;
    showTake?: boolean;
    showDelete?: boolean;
    showWorkspace?: boolean;
}

const levelNames: Record<number, { name: string; color: string }> = {
    1: { name: 'Initié', color: 'from-emerald-500 to-emerald-600' },
    2: { name: 'Mystique', color: 'from-blue-500 to-blue-600' },
    3: { name: 'Profond', color: 'from-purple-500 to-purple-600' },
    4: { name: 'Intégrale', color: 'from-amber-500 to-amber-600' },
};

const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    PAID: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    PROCESSING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    AWAITING_VALIDATION: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    COMPLETED: 'bg-green-500/20 text-green-400 border-green-500/30',
    FAILED: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

export function OrderCard({ order, onView, onTake, onDelete, showTake = true, showDelete = false, showWorkspace = false }: OrderCardProps) {
    const router = useRouter();
    const level = levelNames[order.level] || levelNames[1];
    const statusClass = statusColors[order.status] || statusColors.PENDING;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const handleOpenWorkspace = () => {
        router.push(`/admin/workspace/${order.id}`);
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.01 }}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all group"
        >
            <div className="flex items-start justify-between mb-3">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-white font-bold">{order.orderNumber}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusClass}`}>
                            {order.status.replace('_', ' ')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-white/60 text-sm">
                        <User className="w-3.5 h-3.5" />
                        <span>{order.userName || order.userEmail}</span>
                    </div>
                </div>
                <div className={`px-3 py-1 bg-gradient-to-r ${level.color} rounded-lg text-white text-xs font-bold shadow-lg`}>
                    {level.name}
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-white/50 text-xs">
                    <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(order.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                        <Euro className="w-3.5 h-3.5" />
                        {(order.amount / 100).toFixed(0)}€
                    </span>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {showWorkspace && (
                        <button
                            onClick={handleOpenWorkspace}
                            className="px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-amber-400 text-xs font-medium flex items-center gap-1.5 transition-all border border-amber-500/30"
                            title="Ouvrir Soul Cockpit"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Soul Cockpit
                        </button>
                    )}
                    {onView && (
                        <button
                            onClick={() => onView(order)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                            title="Voir détails"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                    )}
                    {showTake && onTake && (
                        <button
                            onClick={() => onTake(order)}
                            className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-medium flex items-center gap-1 transition-all"
                        >
                            Prendre
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {showDelete && onDelete && (
                        <button
                            onClick={() => onDelete(order)}
                            className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                            title="Supprimer"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

