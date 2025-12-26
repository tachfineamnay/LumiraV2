"use client";

import React from "react";
import { motion } from "framer-motion";
import { MandalaNav } from "../../components/sanctuary/MandalaNav";
import { GlassCard } from "../../components/ui/GlassCard";
import { LockedCard } from "../../components/ui/LockedCard";
import { LevelBadge } from "../../components/ui/LevelBadge";
import {
    Star,
    User,
    Eye,
    Crown,
    FileText,
    ChevronRight,
} from "lucide-react";

export default function SanctuaireDashboard() {
    // Simulated user level (1 = Initié, 2 = Mystique, etc.)
    const userLevel = 1;

    const dashboardCards = [
        { title: "Mon Profil", icon: User, route: "/sanctuaire/profile", requiredLevel: 1 },
        { title: "Mes Lectures", icon: Eye, route: "/sanctuaire/draws", requiredLevel: 1 },
        { title: "Rituels", icon: Star, route: "/sanctuaire/rituals", requiredLevel: 2 },
        { title: "Mandala", icon: Crown, route: "/sanctuaire/mandala", requiredLevel: 3 },
        { title: "Synthèse", icon: FileText, route: "/sanctuaire/synthesis", requiredLevel: 3 },
        { title: "Guidance", icon: Star, route: "/sanctuaire/guidance", requiredLevel: 4 },
    ];

    return (
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col items-center">

            {/* 🏛️ WELCOME MESSAGE */}
            <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                    <LevelBadge level={userLevel as 1 | 2 | 3 | 4} />
                </div>
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl md:text-5xl font-playfair italic text-cosmic-divine mb-4"
                >
                    Votre Sanctuaire Personnel
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-cosmic-ethereal/60 tracking-widest uppercase text-xs"
                >
                    Explorez votre univers intérieur à travers le mandala sacré
                </motion.p>
            </div>

            {/* 🌀 CENTRAL MANDALA NAV */}
            <section className="relative mb-24 flex justify-center items-center h-[450px]">
                <MandalaNav />
            </section>

            {/* 🧩 DASHBOARD CARDS - 3 COLUMN GRID */}
            <div className="w-full">
                <h2 className="text-xl font-playfair italic text-cosmic-divine mb-6">
                    Vos Espaces
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dashboardCards.map((card, i) => {
                        const Icon = card.icon;
                        const isLocked = userLevel < card.requiredLevel;

                        if (isLocked) {
                            return (
                                <motion.div
                                    key={card.title}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                >
                                    <LockedCard
                                        level={card.requiredLevel === 2 ? "Mystique" : card.requiredLevel === 3 ? "Profond" : "Intégral"}
                                        title={card.title}
                                        message="Ce contenu est réservé aux niveaux supérieurs."
                                        onUnlock={() => console.log("Upgrade modal")}
                                    />
                                </motion.div>
                            );
                        }

                        return (
                            <motion.div
                                key={card.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <GlassCard className="h-48 flex flex-col justify-between">
                                    <div>
                                        <div className="w-12 h-12 rounded-xl bg-cosmic-gold/10 flex items-center justify-center mb-4">
                                            <Icon className="w-6 h-6 text-cosmic-gold" />
                                        </div>
                                        <h3 className="text-lg font-playfair italic text-cosmic-divine">
                                            {card.title}
                                        </h3>
                                    </div>
                                    <button className="flex items-center gap-2 text-cosmic-gold text-sm font-bold uppercase tracking-widest group">
                                        Accéder
                                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </button>
                                </GlassCard>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
