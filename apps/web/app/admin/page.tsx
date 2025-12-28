"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    TrendingUp,
    Users,
    ShoppingBag,
    Clock,
    AlertCircle,
    ArrowRight,
    ShieldCheck,
    ChevronRight,
    Loader2
} from "lucide-react";
import { StatsCards } from "../../components/admin/StatsCards";
import { GlassCard } from "../../components/ui/GlassCard";
import { motion } from "framer-motion";

export default function AdminDashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        pendingOrders: 0,
        processingOrders: 0,
        awaitingValidation: 0,
        completedOrders: 0,
        totalRevenue: 0,
        todayOrders: 0,
    });

    const [recentActivity, setRecentActivity] = useState([
        { id: 1, type: "order", text: "Nouvelle commande #LUM-892 par Elena S.", time: "il y a 2 min", status: "pending" },
        { id: 2, type: "validation", text: "Validation requise pour #LUM-887", time: "il y a 15 min", status: "warning" },
        { id: 3, type: "completion", text: "Lecture livrée à Thomas M.", time: "il y a 1h", status: "success" },
        { id: 4, type: "system", text: "Maintenance système effectuée", time: "il y a 4h", status: "info" },
    ]);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const fetchStats = useCallback(async () => {
        const token = localStorage.getItem('expert_token');
        if (!token) {
            router.push('/admin/login');
            return;
        }

        try {
            const res = await fetch(`${apiUrl}/api/expert/stats`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.status === 401) {
                localStorage.removeItem('expert_token');
                router.push('/admin/login');
                return;
            }

            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    }, [apiUrl, router]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return (
        <div className="space-y-10">

            {/* 🏛️ WELCOME & ACTION */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-serif italic text-white mb-2">Tableau de bord</h1>
                    <p className="text-slate-400 text-sm">Vue d'ensemble de l'activité d'Oracle Lumira.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-white/5 rounded-xl text-xs font-bold text-amber-400">
                        <ShieldCheck className="w-4 h-4" />
                        SYSTÈME OPÉRATIONNEL
                    </div>
                </div>
            </div>

            {/* 📊 STATS SECTION */}
            <StatsCards stats={stats} />

            {/* 🧩 MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* RECENT ACTIVITY */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-serif italic text-white">Activité Récente</h3>
                        <button className="text-xs text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 uppercase tracking-widest font-bold">
                            Voir tout <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {recentActivity.map((activity, i) => (
                            <motion.div
                                key={activity.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <GlassCard className="!p-4 border-white/5 hover:border-amber-400/20 transition-all flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activity.status === 'pending' ? 'bg-amber-400/10 text-amber-400' :
                                            activity.status === 'warning' ? 'bg-rose-400/10 text-rose-400' :
                                                'bg-emerald-400/10 text-emerald-400'
                                            }`}>
                                            {activity.type === 'order' ? <ShoppingBag className="w-5 h-5" /> :
                                                activity.type === 'validation' ? <AlertCircle className="w-5 h-5" /> :
                                                    <Clock className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{activity.text}</p>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{activity.time}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 transition-colors" />
                                </GlassCard>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* QUICK STATS / SYSTEM INFO */}
                <div className="space-y-6">
                    <h3 className="text-lg font-serif italic text-white">État des Canaux</h3>
                    <GlassCard className="space-y-6 border-white/5">
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Génération IA (n8n)</span>
                                <span className="text-emerald-400 font-bold">ACTIF</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: "95%" }}
                                    className="h-full bg-emerald-400 shadow-[0_0_10px_#4ade80]"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Paiements (Stripe)</span>
                                <span className="text-emerald-400 font-bold">ACTIF</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: "100%" }}
                                    className="h-full bg-emerald-400 shadow-[0_0_10px_#4ade80]"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Serveur API</span>
                                <span className="text-emerald-400 font-bold">24ms</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: "100%" }}
                                    className="h-full bg-emerald-400 shadow-[0_0_10px_#4ade80]"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/5">
                            <button className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-colors">
                                Lancer Diagnostics
                            </button>
                        </div>
                    </GlassCard>
                </div>

            </div>

        </div>
    );
}

import { ChevronRight } from "lucide-react";
