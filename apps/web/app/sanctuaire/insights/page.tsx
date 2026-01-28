'use client';

export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { InsightCard } from '../../../components/insights/InsightCard';
import { InsightModal } from '../../../components/insights/InsightModal';
import { useInsights, type CategoryWithInsight } from '../../../hooks/useInsights';

export default function InsightsPage() {
    const { categories, isLoading, error, markAsViewed } = useInsights();
    const [selectedInsight, setSelectedInsight] = useState<CategoryWithInsight | null>(null);

    const handleExplore = (data: CategoryWithInsight) => {
        setSelectedInsight(data);
        if (data.isNew && data.insight) {
            markAsViewed(data.category);
        }
    };

    const handleCloseModal = () => {
        setSelectedInsight(null);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                    <span className="text-4xl">⚠️</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">
                    Erreur de chargement
                </h2>
                <p className="text-slate-400 max-w-md">
                    {error}
                </p>
            </div>
        );
    }

    // Check if user has any insights
    const hasAnyInsight = categories.some(cat => cat.insight !== null);

    if (!hasAnyInsight) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center mb-6"
                >
                    <Sparkles className="w-12 h-12 text-amber-400" />
                </motion.div>
                <motion.h2
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl font-bold text-white mb-4"
                >
                    Vos Insights Spirituels
                </motion.h2>
                <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-400 max-w-md mb-8"
                >
                    Vos insights personnalisés seront générés après la finalisation de votre première lecture spirituelle.
                    Chaque insight révèle une facette unique de votre voyage intérieur.
                </motion.p>
                <motion.a
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    href="/sanctuaire"
                    className="px-6 py-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                >
                    Retour au Sanctuaire
                </motion.a>
            </div>
        );
    }

    return (
        <div className="py-8 px-4">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
            >
                <h1 className="text-3xl md:text-4xl font-playfair italic text-white mb-3">
                    Vos Insights Spirituels
                </h1>
                <p className="text-slate-400 max-w-2xl mx-auto">
                    Explorez les différentes dimensions de votre être révélées par votre lecture.
                    Chaque carte représente un aspect unique de votre voyage intérieur.
                </p>
            </motion.div>

            {/* Grid of Insight Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                {categories.map((cat, index) => (
                    <InsightCard
                        key={cat.category}
                        data={cat}
                        index={index}
                        onExplore={handleExplore}
                    />
                ))}
            </div>

            {/* Modal for expanded insight */}
            <InsightModal
                data={selectedInsight}
                isOpen={!!selectedInsight}
                onClose={handleCloseModal}
            />
        </div>
    );
}
