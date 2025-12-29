"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MandalaNav } from "../../components/sanctuary/MandalaNav";
import { CosmicNotification } from "../../components/sanctuary/CosmicNotification";
import { GlassCard } from "../../components/ui/GlassCard";
import { LockedCard } from "../../components/ui/LockedCard";
import { useSanctuaire } from "../../context/SanctuaireContext";
import {
    User,
    Eye,
    Crown,
    FileText,
    ChevronRight,
    Map,
    Loader2,
    Star,
    Lock,
    Sparkles
} from "lucide-react";

// =============================================================================
// DASHBOARD CARDS CONFIG
// =============================================================================

interface DashboardCard {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    route: string;
    requiredLevel: number;
    requiredCapability: string;
    accentColor: string;
}

const dashboardCards: DashboardCard[] = [
    {
        title: "Mon Profil",
        description: "Gestion de votre identité spirituelle",
        icon: User,
        route: "/sanctuaire/profile",
        requiredLevel: 0, // Always accessible
        requiredCapability: "sanctuaire.sphere.profile",
        accentColor: "from-dawn-gold/20 to-dawn-amber/10",
    },
    {
        title: "Mes Lectures",
        description: "Accédez à vos lectures Oracle personnalisées",
        icon: Eye,
        route: "/sanctuaire/draws",
        requiredLevel: 1,
        requiredCapability: "sanctuaire.sphere.readings",
        accentColor: "from-cosmos-teal/20 to-cosmos-cyan/10",
    },
    {
        title: "Rituels Sacrés",
        description: "Accédez aux rituels personnalisés et pratiques avancées",
        icon: Map,
        route: "/sanctuaire/rituals",
        requiredLevel: 2,
        requiredCapability: "sanctuaire.sphere.rituals",
        accentColor: "from-purple-500/20 to-violet-500/10",
    },
    {
        title: "Mandala Personnel",
        description: "Accédez à votre Mandala personnalisé en haute définition",
        icon: Crown,
        route: "/sanctuaire/mandala",
        requiredLevel: 3,
        requiredCapability: "sanctuaire.sphere.mandala",
        accentColor: "from-dawn-amber/20 to-dawn-orange/10",
    },
    {
        title: "Synthèse Profonde",
        description: "Accédez à l'analyse synthétique complète de votre parcours",
        icon: FileText,
        route: "/sanctuaire/synthesis",
        requiredLevel: 3,
        requiredCapability: "sanctuaire.sphere.synthesis",
        accentColor: "from-cosmos-cyan/20 to-cosmos-mist/10",
    },
    {
        title: "Guidance Sacrée",
        description: "Accédez à la guidance personnalisée et au mentorat exclusif",
        icon: Star,
        route: "/sanctuaire/chat",
        requiredLevel: 4,
        requiredCapability: "sanctuaire.sphere.guidance",
        accentColor: "from-dawn-gold/20 to-dawn-glow/10",
    },
];

// =============================================================================
// LEVEL MAPPING
// =============================================================================

const getLevelInfo = (level: number): { name: "Initié" | "Mystique" | "Profond" | "Intégral"; productId: "initie" | "mystique" | "profond" | "integrale" } => {
    switch (level) {
        case 2: return { name: "Mystique", productId: "mystique" };
        case 3: return { name: "Profond", productId: "profond" };
        case 4: return { name: "Intégral", productId: "integrale" };
        default: return { name: "Initié", productId: "initie" };
    }
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function SanctuaireDashboard() {
    const { highestLevel, hasCapability, isLoading, orderCount } = useSanctuaire();

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-dawn-gold animate-spin" />
                    <p className="text-star-dim text-sm tracking-widest uppercase">
                        Chargement de votre sanctuaire...
                    </p>
                </div>
            </div>
        );
    }

    const hasOrders = orderCount > 0;

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center">

            {/* 🏛️ WELCOME MESSAGE */}
            <div className="text-center mb-6 relative z-10">
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl md:text-5xl font-playfair italic text-gradient-dawn mb-4"
                >
                    Votre Sanctuaire Personnel
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-star-dim tracking-[0.15em] uppercase text-xs font-medium"
                >
                    Explorez votre univers intérieur à travers le mandala sacré
                </motion.p>
            </div>

            {/* 🪐 MANDALA NAVIGATION - Desktop */}
            <section className="relative w-full hidden lg:flex justify-center items-center py-4 mb-6">
                <MandalaNav />
            </section>

            {/* 🔔 ORDER STATUS NOTIFICATION */}
            {hasOrders && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="w-full max-w-3xl mx-auto mb-10 relative z-20"
                >
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
                </motion.div>
            )}

            {/* 🧩 DASHBOARD CARDS - GRID */}
            <div className="w-full relative z-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                    {dashboardCards.map((card, i) => {
                        const Icon = card.icon;
                        const levelInfo = getLevelInfo(card.requiredLevel);
                        const isIntegral = card.requiredLevel === 4;

                        // Profile is always accessible
                        const hasAccess = card.requiredLevel === 0 ||
                            (hasCapability(card.requiredCapability) && highestLevel >= card.requiredLevel);

                        if (!hasAccess) {
                            return (
                                <motion.div
                                    key={card.title}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + i * 0.08 }}
                                >
                                    <div className="h-full min-h-[180px] rounded-2xl bg-cosmos-twilight/30 backdrop-blur-sm border border-white/5 p-5 flex flex-col justify-between relative overflow-hidden">
                                        {/* Locked overlay */}
                                        <div className="absolute inset-0 bg-cosmos-deep/40 backdrop-blur-[2px] z-10" />

                                        <div className="relative z-20">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                                    <Icon className="w-6 h-6 text-star-dim" />
                                                </div>
                                                <Lock className="w-5 h-5 text-dawn-gold/60" />
                                            </div>

                                            <h3 className="text-lg font-playfair italic text-star-silver mb-1">
                                                {card.title}
                                            </h3>
                                            <p className="text-star-dim/60 text-sm">
                                                {card.description}
                                            </p>
                                        </div>

                                        <div className="relative z-20 mt-4 pt-4 border-t border-white/5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="w-3 h-3 text-dawn-gold/60" />
                                                    <span className="text-[10px] text-dawn-gold/80 uppercase tracking-wider">
                                                        Requiert niveau {levelInfo.name}
                                                    </span>
                                                    <Sparkles className="w-3 h-3 text-dawn-gold/60" />
                                                </div>
                                            </div>
                                            <Link href={`/commande?product=${levelInfo.productId}`}>
                                                <button className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-dawn-gold to-dawn-amber text-cosmos-deep text-sm font-semibold hover:shadow-dawn-glow transition-all duration-300">
                                                    {isIntegral ? "Niveau Intégral" : `Débloquer`}
                                                </button>
                                            </Link>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        }

                        return (
                            <motion.div
                                key={card.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + i * 0.08 }}
                            >
                                <Link href={card.route}>
                                    <div className={`h-full min-h-[180px] rounded-2xl bg-gradient-to-br ${card.accentColor} backdrop-blur-sm border border-white/10 p-5 flex flex-col justify-between group hover:border-dawn-gold/30 transition-all duration-500 cursor-pointer hover:shadow-lg hover:shadow-dawn-gold/5`}>
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-white/10 group-hover:border-dawn-gold/30">
                                                    <Icon className="w-6 h-6 text-dawn-gold" />
                                                </div>
                                            </div>

                                            <h3 className="text-lg font-playfair italic text-star-white mb-1 group-hover:text-dawn-amber transition-colors">
                                                {card.title}
                                            </h3>
                                            <p className="text-star-dim text-sm">
                                                {card.description}
                                            </p>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-white/5 flex justify-end items-center">
                                            <span className="flex items-center gap-2 text-dawn-gold text-xs font-bold uppercase tracking-widest">
                                                Accéder
                                                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
