'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Compass, History, ExternalLink } from 'lucide-react';
import { Button } from '@packages/ui';

export default function SanctuaireDashboard() {
    const stats = [
        { name: 'Lectures Totales', value: '1', icon: Sparkles, color: 'text-indigo-400' },
        { name: 'Chemins Explorés', value: '3', icon: Compass, color: 'text-purple-400' },
        { name: 'Dernière Activité', value: 'Aujourd\'hui', icon: History, color: 'text-emerald-400' },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black tracking-tight text-white">Bonjour, Explorateur</h1>
                <p className="text-slate-400">Voici l&apos;état de votre chemin vibratoire actuel.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.name}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl"
                    >
                        <div className={`p-3 bg-slate-950 border border-slate-800 rounded-2xl w-fit mb-4 ${stat.color}`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">{stat.name}</p>
                        <p className="text-2xl font-black text-white">{stat.value}</p>
                    </motion.div>
                ))}
            </div>

            {/* Featured Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-gradient-to-br from-indigo-900/40 to-slate-950 border border-indigo-500/20 rounded-[2.5rem] p-8 relative overflow-hidden group"
                >
                    <div className="relative z-10">
                        <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-4 inline-block">Dernière Lecture</span>
                        <h3 className="text-2xl font-bold mb-4">Lecture Spirituelle Intégrale</h3>
                        <p className="text-slate-300 mb-8 max-w-sm">Votre thème a été analysé. Les énergies actuelles favorisent la clarté mentale et l&apos;expansion créative.</p>
                        <Button data-testid="download-pdf" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl px-6 py-3 flex items-center gap-2 font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                            Consulter le PDF
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    </div>
                    <Sparkles className="absolute -right-12 -bottom-12 w-64 h-64 text-indigo-500/10 group-hover:rotate-12 transition-transform duration-700" />
                </motion.div>

                <motion.div
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-between"
                >
                    <div>
                        <h3 className="text-2xl font-bold mb-4">Évolution Prochaine</h3>
                        <p className="text-slate-400 mb-6">Passez au niveau <span className="text-purple-400 font-bold">Mystique</span> pour débloquer la guidance audio et les rituels sonores personnalisés.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 w-1/4 shadow-[0_0_10px_rgba(79,70,229,0.5)]" />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 font-bold">
                            <span>INITIÉ</span>
                            <span>INTEGRAL</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
