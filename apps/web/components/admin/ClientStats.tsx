'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Euro, Star, TrendingUp } from 'lucide-react';

interface ClientStats {
    totalOrders: number;
    completedOrders: number;
    totalSpent: number;
    favoriteLevel: string | null;
    lastOrderAt: string | null;
}

interface ClientStatsProps {
    stats: ClientStats | null;
    loading?: boolean;
}

export function ClientStats({ stats, loading = false }: ClientStatsProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-4 animate-pulse">
                        <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
                        <div className="h-6 bg-white/10 rounded w-3/4" />
                    </div>
                ))}
            </div>
        );
    }

    if (!stats) {
        return null;
    }

    const statCards = [
        {
            title: 'Commandes',
            value: stats.totalOrders,
            subtitle: `${stats.completedOrders} complétées`,
            icon: ShoppingBag,
            color: 'from-blue-500 to-blue-600',
        },
        {
            title: 'Dépensé',
            value: `${(stats.totalSpent / 100).toFixed(0)}€`,
            subtitle: 'Total',
            icon: Euro,
            color: 'from-emerald-500 to-emerald-600',
        },
        {
            title: 'Niveau Favori',
            value: stats.favoriteLevel || 'N/A',
            subtitle: 'Le plus commandé',
            icon: Star,
            color: 'from-amber-500 to-amber-600',
        },
        {
            title: 'Dernière Cmd',
            value: stats.lastOrderAt
                ? new Date(stats.lastOrderAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                : 'N/A',
            subtitle: stats.lastOrderAt
                ? new Date(stats.lastOrderAt).toLocaleDateString('fr-FR', { year: 'numeric' })
                : '',
            icon: TrendingUp,
            color: 'from-purple-500 to-purple-600',
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3">
            {statCards.map((stat, index) => (
                <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 relative overflow-hidden"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-white/50 text-xs font-medium">{stat.title}</p>
                            <p className="text-xl font-bold text-white mt-1">{stat.value}</p>
                            {stat.subtitle && (
                                <p className="text-white/40 text-xs mt-0.5">{stat.subtitle}</p>
                            )}
                        </div>
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                            <stat.icon className="w-4 h-4 text-white" />
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
