"use client";

import React from "react";
import { motion } from "framer-motion";
import {
    Sparkles,
    Heart,
    Compass,
    Palette,
    Cloud,
    Briefcase,
    Activity,
    Wallet,
    ChevronRight,
    Loader2,
} from "lucide-react";
import { GlassCard } from "../ui/GlassCard";
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

// Color mapping for categories
const CATEGORY_COLORS: Record<InsightCategory, string> = {
    SPIRITUEL: "from-horizon-400/20 to-horizon-500/10 border-horizon-400/20",
    RELATIONS: "from-rose-400/20 to-rose-500/10 border-rose-400/20",
    MISSION: "from-blue-400/20 to-blue-500/10 border-blue-400/20",
    CREATIVITE: "from-orange-400/20 to-orange-500/10 border-orange-400/20",
    EMOTIONS: "from-violet-400/20 to-violet-500/10 border-violet-400/20",
    TRAVAIL: "from-emerald-400/20 to-emerald-500/10 border-emerald-400/20",
    SANTE: "from-green-400/20 to-green-500/10 border-green-400/20",
    FINANCE: "from-amber-400/20 to-amber-500/10 border-amber-400/20",
};

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

interface InsightCardProps {
    data: CategoryWithInsight;
    index: number;
    onExplore: (data: CategoryWithInsight) => void;
}

export function InsightCard({ data, index, onExplore }: InsightCardProps) {
    const Icon = CATEGORY_ICONS[data.category];
    const colorClasses = CATEGORY_COLORS[data.category];
    const iconColor = CATEGORY_ICON_COLORS[data.category];

    const hasInsight = data.insight !== null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
        >
            <GlassCard className="p-6 h-full flex flex-col" hover={hasInsight}>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                        <div
                            className={cn(
                                "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center border flex-shrink-0",
                                colorClasses
                            )}
                        >
                            <Icon className={cn("w-6 h-6", iconColor)} />
                        </div>
                        <div>
                            <h3 className="text-lg font-playfair italic text-stellar-100">
                                {data.metadata.label}
                            </h3>
                            <p className="text-xs text-stellar-500 mt-0.5">
                                {data.metadata.description}
                            </p>
                        </div>
                    </div>

                    {/* Badge "Nouveau" */}
                    {hasInsight && data.isNew && (
                        <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider bg-horizon-400/20 text-horizon-300 rounded-full border border-horizon-400/30">
                            Nouveau
                        </span>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1">
                    {hasInsight ? (
                        <>
                            <p className="text-stellar-400 text-sm leading-relaxed line-clamp-3">
                                {data.insight!.short}
                            </p>
                            <p className="text-xs text-stellar-600 mt-3">
                                Généré le{" "}
                                {new Date(data.insight!.createdAt).toLocaleDateString("fr-FR", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                })}
                            </p>
                        </>
                    ) : (
                        <div className="flex items-center gap-3 text-stellar-500 py-4">
                            <Loader2 className="w-5 h-5 animate-spin text-horizon-400" />
                            <p className="text-sm italic">
                                L'Oracle analyse vos énergies dans cette dimension...
                            </p>
                        </div>
                    )}
                </div>

                {/* Action Button */}
                {hasInsight && (
                    <button
                        onClick={() => onExplore(data)}
                        className={cn(
                            "mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
                            "bg-gradient-to-r from-white/5 to-white/[0.02] border border-white/10",
                            "text-stellar-300 text-sm font-medium",
                            "hover:bg-white/10 hover:border-white/20 transition-all duration-300 group"
                        )}
                    >
                        Explorer
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                )}
            </GlassCard>
        </motion.div>
    );
}
