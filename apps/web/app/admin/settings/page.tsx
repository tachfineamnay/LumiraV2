"use client";

import React from "react";
import { motion } from "framer-motion";
import { Settings, Construction, Sparkles } from "lucide-react";

export default function SettingsPage() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4"
            >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.3)]">
                    <Settings className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-serif italic text-white">Paramètres</h1>
                    <p className="text-sm text-slate-400">Configuration du système Oracle</p>
                </div>
            </motion.div>

            {/* Coming Soon Section */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center justify-center min-h-[400px] space-y-6"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
                    <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center">
                        <Construction className="w-12 h-12 text-amber-400" />
                    </div>
                </div>

                <div className="text-center space-y-2">
                    <h2 className="text-xl font-medium text-white flex items-center justify-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                        Page en reconstruction
                    </h2>
                    <p className="text-slate-400 max-w-md">
                        Les paramètres de configuration sont en cours de refonte pour une meilleure expérience.
                    </p>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-sm text-slate-400">Bientôt disponible</span>
                </div>
            </motion.section>
        </div>
    );
}
