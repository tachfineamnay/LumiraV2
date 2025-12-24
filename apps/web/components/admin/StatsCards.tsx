'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: number | string;
    icon: LucideIcon;
    color: 'amber' | 'blue' | 'purple' | 'green' | 'rose';
    subtitle?: string;
}

const colorClasses = {
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/30',
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/30',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/30',
    green: 'from-emerald-500 to-emerald-600 shadow-emerald-500/30',
    rose: 'from-rose-500 to-rose-600 shadow-rose-500/30',
};

export function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 relative overflow-hidden"
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-white/60 text-sm font-medium">{title}</p>
                    <p className="text-3xl font-bold text-white mt-2">{value}</p>
                    {subtitle && (
                        <p className="text-white/40 text-xs mt-1">{subtitle}</p>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                </div>
            </div>

            {/* Glow effect */}
            <div className={`absolute -bottom-8 -right-8 w-32 h-32 bg-gradient-to-br ${colorClasses[color]} rounded-full opacity-20 blur-2xl`} />
        </motion.div>
    );
}

interface StatsCardsProps {
    stats: {
        pendingOrders: number;
        processingOrders: number;
        awaitingValidation: number;
        completedOrders: number;
        totalRevenue: number;
        todayOrders?: number;
    };
}

export function StatsCards({ stats }: StatsCardsProps) {
    const { ClipboardList, Loader2, CheckCircle2, Trophy, Euro } = require('lucide-react');

    const cards: StatCardProps[] = [
        {
            title: 'En Attente',
            value: stats.pendingOrders,
            icon: ClipboardList,
            color: 'amber',
            subtitle: 'Commandes à traiter',
        },
        {
            title: 'En Cours',
            value: stats.processingOrders,
            icon: Loader2,
            color: 'blue',
            subtitle: 'Génération en cours',
        },
        {
            title: 'À Valider',
            value: stats.awaitingValidation,
            icon: CheckCircle2,
            color: 'purple',
            subtitle: 'Contenu à vérifier',
        },
        {
            title: 'Complétées',
            value: stats.completedOrders,
            icon: Trophy,
            color: 'green',
            subtitle: 'Lectures livrées',
        },
        {
            title: 'Revenus',
            value: `${(stats.totalRevenue / 100).toFixed(0)}€`,
            icon: Euro,
            color: 'rose',
            subtitle: 'Total généré',
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {cards.map((card, index) => (
                <motion.div
                    key={card.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                >
                    <StatCard {...card} />
                </motion.div>
            ))}
        </div>
    );
}
