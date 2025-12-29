"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SanctuaireMandalaNav } from "../../components/sanctuary/SanctuaireMandalaNav";
import { CosmicNotification } from "../../components/sanctuary/CosmicNotification";
import { GlassCard } from "../../components/ui/GlassCard";
import { LockedCard } from "../../components/ui/LockedCard";
import { LevelBadge } from "../../components/ui/LevelBadge";
import { useSanctuaire } from "../../context/SanctuaireContext";
import {
    Star,
    User,
    Eye,
    Crown,
    FileText,
    ChevronRight,
    Map,
    Loader2,
    Edit3,
    Calendar,
    Clock,
    Mail,
    Phone,
    Target,
    Info,
    Image as ImageIcon,
    Hand
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
}

const dashboardCards: DashboardCard[] = [
    {
        title: "Mon Profil",
        description: "Gestion de votre identité spirituelle",
        icon: User,
        route: "/sanctuaire/profile",
        requiredLevel: 1,
        requiredCapability: "sanctuaire.sphere.profile"
    },
    {
        title: "Mes Lectures",
        description: "Accédez à vos lectures Oracle personnalisées",
        icon: Eye,
        route: "/sanctuaire/draws",
        requiredLevel: 1,
        requiredCapability: "sanctuaire.sphere.readings"
    },
    {
        title: "Rituels & Pratiques",
        description: "Accédez aux rituels personnalisés et pratiques avancées",
        icon: Map,
        route: "/sanctuaire/rituals",
        requiredLevel: 2,
        requiredCapability: "sanctuaire.sphere.rituals"
    },
    {
        title: "Mandala Sacré",
        description: "Accédez à votre Mandala personnalisé en haute définition",
        icon: Crown,
        route: "/sanctuaire/mandala",
        requiredLevel: 2,
        requiredCapability: "sanctuaire.sphere.mandala"
    },
    {
        title: "Synthèse Profonde",
        description: "Accédez à l'analyse synthétique complète de votre parcours",
        icon: FileText,
        route: "/sanctuaire/synthesis",
        requiredLevel: 3,
        requiredCapability: "sanctuaire.sphere.synthesis"
    },
    {
        title: "Guidance Oracle",
        description: "Accédez à la guidance personnalisée et au mentorat exclusif",
        icon: Star,
        route: "/sanctuaire/chat",
        requiredLevel: 4,
        requiredCapability: "sanctuaire.sphere.guidance"
    },
];

// =============================================================================
// LEVEL TO PRODUCT MAPPING
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
    const { highestLevel, hasCapability, isLoading, levelMetadata } = useSanctuaire();

    // Display level (show 1 as minimum for UI consistency)
    const displayLevel = Math.max(1, highestLevel) as 1 | 2 | 3 | 4;

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-cosmic-gold animate-spin" />
                    <p className="text-cosmic-ethereal/60 text-sm tracking-widest uppercase">
                        Chargement de votre sanctuaire...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center">

            {/* 🏛️ WELCOME MESSAGE */}
            <div className="text-center mb-8 relative z-10">
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl md:text-5xl font-playfair italic text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-amber-100 mb-4 drop-shadow-md"
                >
                    Votre Sanctuaire Personnel
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-cosmic-ethereal/70 tracking-[0.15em] uppercase text-xs font-medium"
                >
                    Explorez votre univers intérieur à travers le mandala sacré
                </motion.p>
            </div>

            {/* 🪐 STATIC MANDALA NAVIGATION */}
            <section className="relative w-full flex justify-center items-center py-6 mb-6">
                <SanctuaireMandalaNav />
            </section>

            {/* 🔔 NOTIFICATION AREA */}
            <div className="w-full max-w-3xl mx-auto mb-12 relative z-20">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {dashboardCards.map((card, i) => {
                        const Icon = card.icon;
                        const hasAccess = hasCapability(card.requiredCapability);
                        const levelInfo = getLevelInfo(card.requiredLevel);
                        const isIntegral = card.requiredLevel === 4;

                        if (!hasAccess) {
                            return (
                                <motion.div
                                    key={card.title}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                >
                                    <LockedCard
                                        level={levelInfo.name}
                                        title={card.title}
                                        message={card.description}
                                        action={{
                                            label: isIntegral ? "Niveau Intégral" : `${card.requiredLevel === 2 ? "Passer au niveau Mystique" : card.requiredLevel === 3 ? "Accéder au niveau Profond" : "Débloquer l'accès"}`,
                                            productId: levelInfo.productId,
                                            comingSoon: isIntegral,
                                        }}
                                    />
                                </motion.div>
                            );
                        }

                        return (
                            <motion.div
                                key={card.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                            >
                                <Link href={card.route}>
                                    <GlassCard className="h-full min-h-[180px] flex flex-col justify-between group hover:bg-white/5 transition-all duration-500 border-white/5 hover:border-cosmic-gold/30 cursor-pointer">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cosmic-gold/10 to-amber-900/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-cosmic-gold/20">
                                                    <Icon className="w-6 h-6 text-cosmic-gold" />
                                                </div>
                                            </div>

                                            <h3 className="text-lg font-playfair italic text-cosmic-divine mb-1 group-hover:text-amber-200 transition-colors">
                                                {card.title}
                                            </h3>
                                            <p className="text-cosmic-ethereal/60 text-sm leading-relaxed">
                                                {card.description}
                                            </p>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-white/5 flex justify-end items-center">
                                            <span className="flex items-center gap-2 text-cosmic-gold text-xs font-bold uppercase tracking-widest">
                                                Accéder
                                                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                            </span>
                                        </div>
                                    </GlassCard>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
