'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Inbox } from 'lucide-react';
import { OrderCard } from './OrderCard';

import { Order } from '../../lib/types';

interface OrderQueueProps {
    orders: Order[];
    title: string;
    loading?: boolean;
    onRefresh?: () => void;
    onView?: (order: Order) => void;
    onTake?: (order: Order) => void;
    onDelete?: (order: Order) => void;
    showTake?: boolean;
    showDelete?: boolean;
    emptyMessage?: string;
}

export function OrderQueue({
    orders,
    title,
    loading = false,
    onRefresh,
    onView,
    onTake,
    onDelete,
    showTake = true,
    showDelete = false,
    emptyMessage = 'Aucune commande',
}: OrderQueueProps) {
    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-white">{title}</h2>
                    <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs font-medium text-white/60">
                        {orders.length}
                    </span>
                </div>
                {onRefresh && (
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                )}
            </div>

            {/* Orders List */}
            <div className="p-4 max-h-[500px] overflow-y-auto space-y-3">
                {loading ? (
                    // Loading skeletons
                    [...Array(3)].map((_, i) => (
                        <div key={i} className="bg-white/5 rounded-xl p-4 animate-pulse">
                            <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                            <div className="h-3 bg-white/5 rounded w-1/2" />
                        </div>
                    ))
                ) : orders.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-12 text-white/40"
                    >
                        <Inbox className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm">{emptyMessage}</p>
                    </motion.div>
                ) : (
                    orders.map((order, index) => (
                        <motion.div
                            key={order.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <OrderCard
                                order={order}
                                onView={onView}
                                onTake={onTake}
                                onDelete={onDelete}
                                showTake={showTake}
                                showDelete={showDelete}
                            />
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
