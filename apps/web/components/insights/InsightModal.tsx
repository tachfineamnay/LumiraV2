"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Sparkles,
    Heart,
    Compass,
    Palette,
    Cloud,
    Briefcase,
    Activity,
    Wallet,
    Wand2,
    Calendar,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { CategoryWithInsight, InsightCategory } from "../../hooks/useInsights";

// Icon mapping for categories
const CATEGORY_ICONS: Record<InsightCategory, React.ComponentType<{ className?: string }>> = {
    SPIRITUEL: Sparkles,
    RELATIONS: Heart,
    MISSION: Compass,
    CREATIVITE: Palette,
    EMOTIONS: Cloud,
    TRAVAIL: Briefcase,
    SANTE: Activity,
    FINANCE: Wallet,
};

// Color mapping for icon colors
const CATEGORY_ICON_COLORS: Record<InsightCategory, string> = {
    SPIRITUEL: "text-horizon-400",
    RELATIONS: "text-rose-400",
    MISSION: "text-blue-400",
    CREATIVITE: "text-orange-400",
    EMOTIONS: "text-violet-400",
    TRAVAIL: "text-emerald-400",
    SANTE: "text-green-400",
    FINANCE: "text-amber-400",
};

// Background gradient colors for header
const CATEGORY_GRADIENTS: Record<InsightCategory, string> = {
    SPIRITUEL: "from-horizon-400/10 to-transparent",
    RELATIONS: "from-rose-400/10 to-transparent",
    MISSION: "from-blue-400/10 to-transparent",
    CREATIVITE: "from-orange-400/10 to-transparent",
    EMOTIONS: "from-violet-400/10 to-transparent",
    TRAVAIL: "from-emerald-400/10 to-transparent",
    SANTE: "from-green-400/10 to-transparent",
    FINANCE: "from-amber-400/10 to-transparent",
};

interface InsightModalProps {
    data: CategoryWithInsight | null;
    isOpen: boolean;
    onClose: () => void;
    onCreateRitual?: (category: InsightCategory) => void;
}

export function InsightModal({ data, isOpen, onClose, onCreateRitual }: InsightModalProps) {
    if (!data || !data.insight) return null;

    const Icon = CATEGORY_ICONS[data.category];
    const iconColor = CATEGORY_ICON_COLORS[data.category];
    const gradientClass = CATEGORY_GRADIENTS[data.category];

    const handleCreateRitual = () => {
        if (onCreateRitual) {
            onCreateRitual(data.category);
        }
        // For now, show a toast or placeholder
        alert("🔮 Fonctionnalité à venir : Création de rituels personnalisés");
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-abyss-800/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 
                       z-50 w-auto md:w-[600px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] 
                       overflow-hidden rounded-2xl bg-abyss-600/95 backdrop-blur-xl 
                       border border-white/[0.08] shadow-abyss flex flex-col"
                    >
                        {/* Header */}
                        <div className={cn("p-6 border-b border-white/[0.06] bg-gradient-to-br", gradientClass)}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-abyss-500/50 flex items-center justify-center border border-white/[0.08]">
                                        <Icon className={cn("w-7 h-7", iconColor)} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-playfair italic text-stellar-100">
                                            {data.metadata.label}
                                        </h2>
                                        <p className="text-sm text-stellar-500 mt-1">
                                            {data.metadata.description}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl hover:bg-white/5 text-stellar-500 hover:text-stellar-300 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Date */}
                            <div className="flex items-center gap-2 mt-4 text-xs text-stellar-500">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>
                                    Mis à jour le{" "}
                                    {new Date(data.insight.updatedAt).toLocaleDateString("fr-FR", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                    })}
                                </span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="prose prose-invert prose-sm max-w-none">
                                <p className="text-stellar-300 leading-relaxed whitespace-pre-wrap">
                                    {data.insight.full}
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/[0.06] flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleCreateRitual}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl",
                                    "bg-gradient-to-r from-horizon-400/20 to-horizon-500/10",
                                    "border border-horizon-400/30 text-horizon-300",
                                    "hover:bg-horizon-400/30 hover:border-horizon-400/50",
                                    "transition-all duration-300 font-medium"
                                )}
                            >
                                <Wand2 className="w-5 h-5" />
                                Créer un rituel
                            </button>

                            <button
                                onClick={onClose}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl",
                                    "bg-white/5 border border-white/10",
                                    "text-stellar-400 hover:bg-white/10 hover:text-stellar-300",
                                    "transition-all duration-300"
                                )}
                            >
                                Fermer
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
