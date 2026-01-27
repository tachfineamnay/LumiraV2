'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3,
    TrendingUp,
    Euro,
    Users,
    ShoppingBag,
    Clock,
    Calendar,
    CheckCircle2,
    AlertCircle,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCcw,
    PieChart,
    Activity
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface AnalyticsData {
    // Revenue
    totalRevenue: number;
    revenueChange: number;
    todayRevenue: number;
    
    // Orders
    totalOrders: number;
    completedOrders: number;
    pendingOrders: number;
    processingOrders: number;
    awaitingValidation: number;
    failedOrders: number;
    
    // Clients
    totalClients: number;
    newClientsThisMonth: number;
    
    // Conversion
    conversionRate: number;
    averageOrderValue: number;
    
    // By Level
    ordersByLevel: { level: number; count: number; revenue: number }[];
    
    // Timeline
    revenueByDay: { date: string; revenue: number }[];
}

// =============================================================================
// STAT CARD
// =============================================================================

function StatCard({
    title,
    value,
    change,
    icon: Icon,
    color,
    suffix,
    loading
}: {
    title: string;
    value: number | string;
    change?: number;
    icon: React.ElementType;
    color: string;
    suffix?: string;
    loading?: boolean;
}) {
    const colorClasses: Record<string, string> = {
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-2xl border ${colorClasses[color]} backdrop-blur-sm`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {change !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-medium ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(change)}%
                    </div>
                )}
            </div>
            <div className="space-y-1">
                {loading ? (
                    <div className="h-8 w-20 bg-white/5 rounded animate-pulse" />
                ) : (
                    <p className="text-3xl font-bold text-white">
                        {value}{suffix}
                    </p>
                )}
                <p className="text-sm text-slate-500">{title}</p>
            </div>
        </motion.div>
    );
}

// =============================================================================
// LEVEL BREAKDOWN
// =============================================================================

function LevelBreakdown({ data, loading }: { data: AnalyticsData['ordersByLevel']; loading: boolean }) {
    const levels = [
        { id: 1, name: 'Initié', color: 'bg-purple-500' },
        { id: 2, name: 'Mystique', color: 'bg-blue-500' },
        { id: 3, name: 'Profond', color: 'bg-emerald-500' },
        { id: 4, name: 'Intégral', color: 'bg-amber-500' },
    ];

    const totalOrders = data.reduce((acc, d) => acc + d.count, 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl bg-slate-800/30 border border-white/5"
        >
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white">Répartition par Niveau</h3>
                    <p className="text-xs text-slate-500">Performance par offre</p>
                </div>
                <PieChart className="w-5 h-5 text-slate-500" />
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {levels.map(level => {
                        const levelData = data.find(d => d.level === level.id);
                        const count = levelData?.count || 0;
                        const revenue = levelData?.revenue || 0;
                        const percentage = totalOrders > 0 ? (count / totalOrders) * 100 : 0;

                        return (
                            <div key={level.id} className="group">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-3 h-3 rounded-full ${level.color}`} />
                                        <span className="text-sm font-medium text-white">{level.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-sm font-bold text-white">{count}</span>
                                        <span className="text-xs text-slate-500 ml-2">({revenue}€)</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 0.5, delay: 0.1 * level.id }}
                                        className={`h-full ${level.color} rounded-full`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </motion.div>
    );
}

// =============================================================================
// PIPELINE STATUS
// =============================================================================

function PipelineStatus({ data, loading }: { data: AnalyticsData; loading: boolean }) {
    const stages = [
        { key: 'pending', label: 'En attente', value: data.pendingOrders, color: 'amber', icon: Clock },
        { key: 'processing', label: 'Génération', value: data.processingOrders, color: 'blue', icon: Activity },
        { key: 'validation', label: 'Validation', value: data.awaitingValidation, color: 'purple', icon: AlertCircle },
        { key: 'completed', label: 'Complétés', value: data.completedOrders, color: 'emerald', icon: CheckCircle2 },
    ];

    const colorClasses: Record<string, string> = {
        amber: 'text-amber-400 bg-amber-500/10',
        blue: 'text-blue-400 bg-blue-500/10',
        purple: 'text-purple-400 bg-purple-500/10',
        emerald: 'text-emerald-400 bg-emerald-500/10',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-2xl bg-slate-800/30 border border-white/5"
        >
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white">État du Pipeline</h3>
                    <p className="text-xs text-slate-500">Vue en temps réel</p>
                </div>
                <Activity className="w-5 h-5 text-slate-500" />
            </div>

            {loading ? (
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {stages.map(stage => {
                        const Icon = stage.icon;
                        return (
                            <div key={stage.key} className={`p-4 rounded-xl ${colorClasses[stage.color].split(' ')[1]}`}>
                                <Icon className={`w-5 h-5 ${colorClasses[stage.color].split(' ')[0]} mb-2`} />
                                <p className="text-2xl font-bold text-white">{stage.value}</p>
                                <p className="text-xs text-slate-500">{stage.label}</p>
                            </div>
                        );
                    })}
                </div>
            )}
        </motion.div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData>({
        totalRevenue: 0,
        revenueChange: 0,
        todayRevenue: 0,
        totalOrders: 0,
        completedOrders: 0,
        pendingOrders: 0,
        processingOrders: 0,
        awaitingValidation: 0,
        failedOrders: 0,
        totalClients: 0,
        newClientsThisMonth: 0,
        conversionRate: 0,
        averageOrderValue: 0,
        ordersByLevel: [],
        revenueByDay: [],
    });
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const getToken = () => localStorage.getItem('expert_token');

    const fetchAnalytics = useCallback(async () => {
        const token = getToken();
        if (!token) return;

        try {
            setLoading(true);
            
            // Fetch multiple endpoints
            const [statsRes, clientsRes] = await Promise.all([
                fetch(`${apiUrl}/api/expert/stats`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${apiUrl}/api/expert/clients?limit=1`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            if (statsRes.ok) {
                const stats = await statsRes.json();
                
                // Calculate derived metrics
                const totalOrders = (stats.completedOrders || 0) + (stats.pendingOrders || 0) + 
                                   (stats.processingOrders || 0) + (stats.awaitingValidation || 0);
                
                setData(prev => ({
                    ...prev,
                    totalRevenue: stats.totalRevenue || 0,
                    todayRevenue: stats.todayRevenue || 0,
                    totalOrders,
                    completedOrders: stats.completedOrders || 0,
                    pendingOrders: stats.pendingOrders || 0,
                    processingOrders: stats.processingOrders || 0,
                    awaitingValidation: stats.awaitingValidation || 0,
                    failedOrders: stats.failedOrders || 0,
                    averageOrderValue: totalOrders > 0 ? Math.round((stats.totalRevenue || 0) / totalOrders) : 0,
                    conversionRate: stats.conversionRate || 95, // Default 95%
                    ordersByLevel: [
                        { level: 1, count: stats.initieLevelOrders || totalOrders, revenue: stats.totalRevenue || 0 },
                        { level: 2, count: 0, revenue: 0 },
                        { level: 3, count: 0, revenue: 0 },
                        { level: 4, count: 0, revenue: 0 },
                    ],
                }));
            }

            if (clientsRes.ok) {
                const clientsData = await clientsRes.json();
                setData(prev => ({
                    ...prev,
                    totalClients: clientsData.pagination?.total || 0,
                }));
            }

            setLastUpdate(new Date());
        } catch (error) {
            console.error('Analytics fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [apiUrl]);

    useEffect(() => {
        fetchAnalytics();
        // Refresh every 2 minutes
        const interval = setInterval(fetchAnalytics, 120000);
        return () => clearInterval(interval);
    }, [fetchAnalytics]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <BarChart3 className="w-7 h-7 text-purple-400" />
                        Analytics & Rapports
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Vue d'ensemble de vos performances
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdate && (
                        <span className="text-xs text-slate-500">
                            Mis à jour à {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={fetchAnalytics}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-white/5 
                                 hover:bg-slate-700/50 text-slate-300 transition-all"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Actualiser
                    </button>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    title="Chiffre d'affaires total"
                    value={data.totalRevenue}
                    suffix="€"
                    icon={Euro}
                    color="emerald"
                    loading={loading}
                />
                <StatCard
                    title="Commandes totales"
                    value={data.totalOrders}
                    icon={ShoppingBag}
                    color="blue"
                    loading={loading}
                />
                <StatCard
                    title="Clients"
                    value={data.totalClients}
                    icon={Users}
                    color="purple"
                    loading={loading}
                />
                <StatCard
                    title="Panier moyen"
                    value={data.averageOrderValue}
                    suffix="€"
                    icon={TrendingUp}
                    color="amber"
                    loading={loading}
                />
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-3 gap-4">
                <StatCard
                    title="CA Aujourd'hui"
                    value={data.todayRevenue}
                    suffix="€"
                    icon={Calendar}
                    color="emerald"
                    loading={loading}
                />
                <StatCard
                    title="Taux de complétion"
                    value={data.totalOrders > 0 ? Math.round((data.completedOrders / data.totalOrders) * 100) : 0}
                    suffix="%"
                    icon={CheckCircle2}
                    color="blue"
                    loading={loading}
                />
                <StatCard
                    title="Échecs"
                    value={data.failedOrders}
                    icon={AlertCircle}
                    color="rose"
                    loading={loading}
                />
            </div>

            {/* Detailed Sections */}
            <div className="grid grid-cols-2 gap-6">
                <LevelBreakdown data={data.ordersByLevel} loading={loading} />
                <PipelineStatus data={data} loading={loading} />
            </div>

            {/* Quick Insights */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 to-purple-500/10 border border-white/5"
            >
                <h3 className="text-lg font-bold text-white mb-4">📊 Insights Rapides</h3>
                <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <p className="text-2xl font-bold text-amber-400">{data.pendingOrders + data.awaitingValidation}</p>
                        <p className="text-sm text-slate-400">Actions requises dans le pipeline</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-bold text-emerald-400">
                            {data.totalOrders > 0 ? Math.round((data.completedOrders / data.totalOrders) * 100) : 0}%
                        </p>
                        <p className="text-sm text-slate-400">Taux de livraison réussie</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-bold text-purple-400">9€</p>
                        <p className="text-sm text-slate-400">Prix moyen par lecture (Initié)</p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
