"use client";

export const dynamic = 'force-dynamic';

import React from "react";
import { motion } from "framer-motion";
import { Brain, Activity, Heart, Edit2, Save } from "lucide-react";
import { GlassCard } from "../../../../components/ui/GlassCard";
import { useAuth } from "../../../../context/AuthContext";

export default function DiagnosticSettingsPage() {
    const { user } = useAuth();
    // In a real app, these would come from user.profile.diagnosticData
    const data = {
        mind: { positive: "Créativité, Famille", negative: "Stress financier, Doute" },
        body: { side: "Gauche", weak: "Dos", strong: "Mains" },
        rhythm: { style: "Symbolique", pace: "Lent" }
    };

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <div className="space-y-6">
            <div className="mb-8">
                <h2 className="text-2xl font-playfair italic text-white">Diagnostic Holistique</h2>
                <p className="text-stellar-400 text-sm">Modifiez les éléments clés de votre profil spirituel.</p>
            </div>

            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                {/* VIBRATORY CARD */}
                <motion.div variants={item} className="lg:col-span-2">
                    <GlassCard className="h-full p-6 relative group">
                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-stellar-300">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                                <Brain className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-playfair text-white">Profil Vibratoire</h3>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">Ce qui porte</span>
                                <div className="p-4 rounded-xl bg-abyss-900/50 border border-white/5 min-h-[100px] text-sm text-stellar-200">
                                    {data.mind.positive}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <span className="text-xs uppercase tracking-wider text-rose-400 font-semibold">Ce qui pèse</span>
                                <div className="p-4 rounded-xl bg-abyss-900/50 border border-white/5 min-h-[100px] text-sm text-stellar-200">
                                    {data.mind.negative}
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* SOMATIC CARD */}
                <motion.div variants={item}>
                    <GlassCard className="h-full p-6 relative group">
                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-stellar-300">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                                <Activity className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-playfair text-white">Somatique</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 rounded-lg bg-abyss-900/50">
                                <span className="text-sm text-stellar-400">Côté Dominant</span>
                                <span className="text-horizon-400 font-medium">{data.body.side}</span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-stellar-500 uppercase">Point Fort</span>
                                <p className="text-stellar-200">{data.body.strong}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs text-stellar-500 uppercase">Zone Fragile</span>
                                <p className="text-stellar-200">{data.body.weak}</p>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* RHYTHM CARD */}
                <motion.div variants={item}>
                    <GlassCard className="h-full p-6 relative group">
                        <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-stellar-300">
                                <Edit2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400">
                                <Heart className="w-6 h-6" />
                            </div>
                            <h3 className="text-lg font-playfair text-white">Rythme</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-horizon-400/10 to-transparent border border-horizon-400/20 text-center">
                                <span className="block text-xs uppercase tracking-wider text-horizon-400 mb-1">Guidance</span>
                                <span className="text-xl font-playfair text-white">{data.rhythm.style}</span>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* WIZARD RELAUNCH */}
                <motion.div variants={item} className="lg:col-span-2">
                    <button className="w-full p-4 rounded-xl border border-dashed border-white/10 text-stellar-500 hover:bg-white/5 hover:text-white transition-all text-sm uppercase tracking-wider">
                        Relancer le Diagnostic Complet
                    </button>
                </motion.div>
            </motion.div>
        </div>
    );
}
