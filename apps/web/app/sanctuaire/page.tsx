"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MandalaNav } from "../../components/ui/MandalaNav";
import { GlassCard } from "../../components/ui/GlassCard";
import {
    Star,
    Book,
    Layers,
    MessageCircle,
    User,
    Lock,
    ChevronRight,
    Sparkles,
    Download,
    Play
} from "lucide-react";
import { RoyalButton } from "../../components/ui/RoyalButton";

export default function SanctuaireDashboard() {
    const portals = [
        {
            title: "Chemin Spirituel",
            desc: "L'analyse complète de votre structure vibratoire.",
            icon: Star,
            color: "amber",
            locked: false,
            action: "Consulter",
        },
        {
            title: "Lectures & Tirages",
            desc: "Vos messages stellaires du moment.",
            icon: Book,
            color: "emerald",
            locked: false,
            action: "Explorer",
        },
        {
            title: "Synthèse Alpha",
            desc: "La réunion de toutes vos dimensions.",
            icon: Layers,
            color: "purple",
            locked: true,
            action: "Débloquer",
        },
        {
            title: "Espace Oral",
            desc: "Conversations avec votre expert Lumira.",
            icon: MessageCircle,
            color: "cyan",
            locked: false,
            action: "Entrer",
        },
        {
            title: "Rituels Sonores",
            desc: "Fréquences sacrées pour votre alignement.",
            icon: Sparkles,
            color: "indigo",
            locked: true,
            action: "Débloquer",
        },
        {
            title: "Archives Célestes",
            desc: "Historique de vos transmutations.",
            icon: History,
            color: "rose",
            locked: false,
            action: "Voir",
        },
    ];

    return (
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col items-center">

            {/* 🏛️ WELCOME MESSAGE */}
            <div className="text-center mb-16">
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl md:text-5xl font-serif italic text-purple-400 mb-4"
                >
                    Votre Sanctuaire Personnel
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-ethereal/60 tracking-widest uppercase text-xs"
                >
                    Explorez votre univers intérieur à travers le mandala sacré
                </motion.p>
            </div>

            {/* 🌀 CENTRAL MANDALA NAV */}
            <section className="relative mb-32 flex justify-center items-center h-[500px]">
                <MandalaNav />
            </section>

            {/* 🧩 DASHBOARD CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
                {portals.map((portal, i) => (
                    <motion.div
                        key={portal.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        viewport={{ once: true }}
                    >
                        <GlassCard className={`relative h-full flex flex-col ${portal.locked ? 'opacity-60' : ''}`}>
                            <div className={`w-12 h-12 rounded-xl bg-${portal.color}-500/10 flex items-center justify-center mb-6`}>
                                <portal.icon className={`w-6 h-6 text-${portal.color}-400`} />
                            </div>

                            <h3 className="text-xl font-serif italic text-divine mb-3">{portal.title}</h3>
                            <p className="text-ethereal/50 text-sm mb-8 flex-grow">{portal.desc}</p>

                            <div className="mt-auto">
                                {portal.locked ? (
                                    <div className="flex flex-col gap-4">
                                        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-widest">
                                            <Lock className="w-3 h-3" />
                                            Contenu Verrouillé
                                        </div>
                                        <RoyalButton
                                            label="Débloquer l'accès"
                                            variant="secondary"
                                            className="w-full !border-amber-400/30 !text-amber-400"
                                        />
                                    </div>
                                ) : (
                                    <button className="flex items-center gap-2 text-gold-light hover:text-gold transition-colors text-sm font-bold uppercase tracking-widest group">
                                        {portal.action}
                                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </button>
                                )}
                            </div>

                            {/* Locked Overlay */}
                            {portal.locked && (
                                <div className="absolute inset-0 bg-void/40 backdrop-blur-[2px] rounded-2xl pointer-events-none" />
                            )}
                        </GlassCard>
                    </motion.div>
                ))}
            </div>

        </div>
    );
}

import { History } from "lucide-react";
