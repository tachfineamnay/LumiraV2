"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    Layers,
    Loader2,
    Lock,
    Sparkles,
    RefreshCw,
    AlertTriangle,
} from "lucide-react";
import { GlassCard } from "../../../components/ui/GlassCard";
import { InsightCard } from "../../../components/insights/InsightCard";
import { InsightModal } from "../../../components/insights/InsightModal";
import { useSanctuaire } from "../../../context/SanctuaireContext";
import { useInsights, type CategoryWithInsight } from "../../../hooks/useInsights";

// =============================================================================
// LOCKED STATE COMPONENT
// =============================================================================

function LockedState() {
    return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
            >
                <div className="w-20 h-20 mx-auto rounded-2xl bg-abyss-500/50 flex items-center justify-center border border-white/[0.1]">
                    <Lock className="w-10 h-10 text-stellar-500" />
                </div>

                <div>
                    <h1 className="text-2xl md:text-3xl font-playfair italic text-stellar-200 mb-3">
                        Synthèse & Insights
                    </h1>
                    <p className="text-stellar-500 leading-relaxed">
                        Accédez à vos insights spirituels personnalisés générés par l&apos;Oracle.
                        Cette section exclusive est réservée aux membres du niveau{" "}
                        <span className="text-horizon-400 font-medium">Profond</span> et supérieur.
                    </p>
                </div>

                <div className="pt-4">
                    <Link href="/commande?product=profond">
                        <button className="px-8 py-3 rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-800 font-semibold hover:shadow-gold-glow transition-all inline-flex items-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            Débloquer le niveau Profond
                        </button>
                    </Link>
                    <p className="text-xs text-stellar-600 mt-3">
                        Accès immédiat après votre commande
                    </p>
                </div>
            </motion.div>
        </div>
    );
}

// =============================================================================
// ERROR STATE COMPONENT
// =============================================================================

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
            >
                <div className="w-20 h-20 mx-auto rounded-2xl bg-rose-500/20 flex items-center justify-center border border-rose-400/30">
                    <AlertTriangle className="w-10 h-10 text-rose-400" />
                </div>

                <div>
                    <h1 className="text-2xl font-playfair italic text-stellar-200 mb-3">
                        Erreur de chargement
                    </h1>
                    <p className="text-stellar-500">{error}</p>
                </div>

                <button
                    onClick={onRetry}
                    className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-stellar-300 hover:bg-white/10 transition-all inline-flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Réessayer
                </button>
            </motion.div>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SynthesisPage() {
    const { highestLevel, hasCapability, isLoading: entitlementsLoading } = useSanctuaire();
    const { categories, isLoading: insightsLoading, error, refetch } = useInsights();

    // Modal state
    const [selectedInsight, setSelectedInsight] = useState<CategoryWithInsight | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Use insights hook for marking as viewed
    const { markAsViewed } = useInsights();

    // Handle explore click
    const handleExplore = (data: CategoryWithInsight) => {
        setSelectedInsight(data);
        setIsModalOpen(true);

        // Mark as viewed when opening
        if (data.isNew && data.insight) {
            markAsViewed(data.category);
        }
    };

    // Handle modal close
    const handleCloseModal = () => {
        setIsModalOpen(false);
        // Delay clearing selected insight for exit animation
        setTimeout(() => setSelectedInsight(null), 300);
    };

    // Loading state
    if (entitlementsLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
            </div>
        );
    }

    // Check access: requires level 3 (Profond) or higher
    const hasAccess = highestLevel >= 3 || hasCapability("sanctuaire.sphere.synthesis");

    if (!hasAccess) {
        return <LockedState />;
    }

    // Error state
    if (error) {
        return <ErrorState error={error} onRetry={refetch} />;
    }

    // Insights loading state
    if (insightsLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-horizon-400 animate-spin mx-auto" />
                    <p className="text-stellar-500 text-sm">Chargement de vos insights...</p>
                </div>
            </div>
        );
    }

    // Count new insights
    const newInsightsCount = categories.filter((c) => c.isNew).length;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            {/* Hero Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl md:text-4xl font-playfair italic text-gradient-gold">
                                Vos Insights Spirituels
                            </h1>
                            {newInsightsCount > 0 && (
                                <span className="px-3 py-1 text-xs font-semibold bg-horizon-400/20 text-horizon-300 rounded-full border border-horizon-400/30">
                                    {newInsightsCount} nouveau{newInsightsCount > 1 ? "x" : ""}
                                </span>
                            )}
                        </div>
                        <p className="text-stellar-500 text-sm">
                            Découvrez les enseignements extraits de votre lecture Oracle, organisés en 8 dimensions de vie
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={refetch}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-stellar-400 hover:bg-white/10 hover:text-stellar-300 transition-all text-sm"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actualiser
                        </button>
                        <Link href="/sanctuaire">
                            <button className="flex items-center gap-2 px-5 py-3 rounded-xl bg-abyss-500/50 border border-white/[0.1] text-stellar-300 hover:border-horizon-400/30 transition-all">
                                <Layers className="w-5 h-5" />
                                Retour au Sanctuaire
                            </button>
                        </Link>
                    </div>
                </div>
            </motion.div>

            {/* Insights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categories.map((category, index) => (
                    <InsightCard
                        key={category.category}
                        data={category}
                        index={index}
                        onExplore={handleExplore}
                    />
                ))}
            </div>

            {/* Empty state info */}
            {categories.every((c) => !c.insight) && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8"
                >
                    <GlassCard className="p-6 text-center max-w-2xl mx-auto">
                        <Sparkles className="w-12 h-12 text-horizon-400 mx-auto mb-4" />
                        <h3 className="text-xl font-playfair italic text-stellar-200 mb-2">
                            Vos insights sont en cours de génération
                        </h3>
                        <p className="text-stellar-500 text-sm">
                            Après la livraison de votre lecture Oracle, notre agent IA analysera
                            votre parcours spirituel et générera des insights personnalisés pour
                            chaque dimension de votre vie. Revenez bientôt !
                        </p>
                    </GlassCard>
                </motion.div>
            )}

            {/* Insight Modal */}
            <InsightModal
                data={selectedInsight}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
            />
        </div>
    );
}
