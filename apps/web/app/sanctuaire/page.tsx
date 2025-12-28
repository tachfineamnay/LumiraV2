"use client";

import React from "react";
import { motion } from "framer-motion";
import { SanctuarySolarSystem } from "../../components/sanctuary/SanctuarySolarSystem";
import { CosmicNotification } from "../../components/sanctuary/CosmicNotification";
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
    Map
} from "lucide-react";

export default function SanctuaireDashboard() {
    // Simulated user level (1 = Initié, 2 = Mystique, etc.)
    const userLevel = 1;

    const dashboardCards = [
        { title: "Mon Profil", description: "Votre identité spirituelle", icon: User, route: "/sanctuaire/profile", requiredLevel: 1 },
        { title: "Mes Lectures", description: "Historique de vos révélations", icon: Eye, route: "/sanctuaire/draws", requiredLevel: 1 },
        { title: "Rituels & Pratiques", description: "Exercices pour l'âme", icon: Map, route: "/sanctuaire/rituals", requiredLevel: 2 },
        { title: "Mandala Sacré", description: "Votre essence visualisée", icon: Crown, route: "/sanctuaire/mandala", requiredLevel: 3 },
        { title: "Synthèse Profonde", description: "Analyse complète de votre chemin", icon: FileText, route: "/sanctuaire/synthesis", requiredLevel: 3 },
        { title: "Guidance Oracle", description: "Mentorat spirituel direct", icon: Star, route: "/sanctuaire/chat", requiredLevel: 4 },
    ];

    return (
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col items-center min-h-screen">

            {/* 🏛️ WELCOME MESSAGE */}
            <div className="text-center mb-0 relative z-10">
                <div className="flex justify-center mb-6">
                    <LevelBadge level={userLevel as 1 | 2 | 3 | 4} />
                </div>
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl md:text-6xl font-playfair italic text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-100 mb-6 drop-shadow-md"
                >
                    Votre Sanctuaire Personnel
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-cosmic-ethereal/70 tracking-[0.2em] uppercase text-xs md:text-sm font-medium"
                >
                    Explorez votre univers intérieur à travers les sphères sacrées
                </motion.p>
            </div>

            {/* 🪐 SOLAR SYSTEM NAVIGATION (Hero Section) */}
            <section className="relative w-full flex justify-center items-center py-10 scale-90 md:scale-100">
                <SanctuarySolarSystem />
            </section>

            {/* 🔔 NOTIFICATION AREA */}
            <div className="w-full max-w-3xl mx-auto mb-20 relative z-20">
                <CosmicNotification
                    title="Votre demande a été transmise avec succès"
                    message="L'Oracle travaille sur votre révélation personnalisée. Vous serez notifié par email et via l'application dès qu'elle sera prête."
                    delay="24h"
                    status="En cours d'analyse"
                    actionLabel="Suivre ma commande"
                    secondaryActionLabel="Nouvelle lecture"
                    onAction={() => console.log('Suivre')}
                    onSecondaryAction={() => console.log('Nouvelle')}
                />
            </div>

            {/* 🧩 DASHBOARD CARDS - GRID */}
            <div className="w-full relative z-10">
                <div className="flex items-center gap-4 mb-10">
                    <div className="h-px bg-gradient-to-r from-transparent via-cosmic-gold/50 to-transparent flex-1" />
                    <h2 className="text-2xl font-playfair italic text-cosmic-divine text-center">
                        Vos Espaces Sacrés
                    </h2>
                    <div className="h-px bg-gradient-to-r from-transparent via-cosmic-gold/50 to-transparent flex-1" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
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
                                        message={`Accédez à ${card.title.toLowerCase()} et aux rituels avancés.`}
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
                                <GlassCard className="h-full min-h-[220px] flex flex-col justify-between group hover:bg-white/5 transition-all duration-500 border-white/5 hover:border-cosmic-gold/30">
                                    <div>
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cosmic-gold/10 to-amber-900/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-cosmic-gold/20">
                                                <Icon className="w-7 h-7 text-cosmic-gold" />
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <Star className="w-4 h-4 text-cosmic-gold animate-pulse" />
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-playfair italic text-cosmic-divine mb-2 group-hover:text-amber-200 transition-colors">
                                            {card.title}
                                        </h3>
                                        <p className="text-cosmic-ethereal/60 text-sm leading-relaxed">
                                            {card.description}
                                        </p>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-cosmic-ethereal/40 group-hover:text-cosmic-gold/60 transition-colors">
                                            Disponible
                                        </span>
                                        <button className="flex items-center gap-2 text-cosmic-gold text-xs font-bold uppercase tracking-widest group/btn">
                                            Accéder
                                            <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                                        </button>
                                    </div>
                                </GlassCard>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
