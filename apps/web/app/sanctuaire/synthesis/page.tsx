"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    Loader2,
    Sparkles,
    RefreshCw,
    AlertTriangle,
    Sun,
    Moon,
    ArrowUp,
    Home,
} from "lucide-react";
import { GlassCard } from "../../../components/ui/GlassCard";
import { InsightCard } from "../../../components/insights/InsightCard";
import { InsightModal } from "../../../components/insights/InsightModal";
import { SoulMirror, ArchetypeCard, SynthesisContent } from "../../../components/sanctuary/synthesis";
import { useSanctuaire } from "../../../context/SanctuaireContext";
import { useInsights, type CategoryWithInsight } from "../../../hooks/useInsights";

// =============================================================================
// TYPES
// =============================================================================

interface SpiritualPathAPIResponse {
    id: string;
    archetype: string;
    synthesis: string;
    keyBlockage?: string;
    keywords?: string[];
    emotionalState?: string;
    lifeMission?: string;
    startedAt: string;
}

interface UserProfileAPIResponse {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profile?: {
        birthDate?: string;
        birthTime?: string;
        birthPlace?: string;
        facePhotoUrl?: string;
        palmPhotoUrl?: string;
        sunSign?: string;
        moonSign?: string;
        risingSign?: string;
    };
}

// =============================================================================
// AWAITING STATE COMPONENT
// =============================================================================

function AwaitingAnalysisState() {
    return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
            >
                {/* Mystical Loader */}
                <div className="relative w-24 h-24 mx-auto">
                    <motion.div
                        className="absolute inset-0 rounded-full border-2 border-amber-400/30"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ repeat: Infinity, duration: 3 }}
                    />
                    <motion.div
                        className="absolute inset-2 rounded-full border-2 border-amber-400/50"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
                    />
                    <div className="absolute inset-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
                    </div>
                </div>

                <div>
                    <h1 className="text-2xl md:text-3xl font-playfair italic text-amber-200 mb-3">
                        Analyse en Préparation
                    </h1>
                    <p className="text-slate-400 leading-relaxed max-w-md mx-auto">
                        Votre essence spirituelle est en cours de révélation par l&apos;Oracle.
                        Cette synthèse sera disponible après la génération de votre lecture personnalisée.
                    </p>
                </div>

                <div className="pt-4">
                    <Link href="/sanctuaire">
                        <button className="px-6 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50 transition-all inline-flex items-center gap-2">
                            <Home className="w-4 h-4" />
                            Retour au Sanctuaire
                        </button>
                    </Link>
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
                    <h1 className="text-2xl font-playfair italic text-slate-200 mb-3">
                        Erreur de chargement
                    </h1>
                    <p className="text-slate-500">{error}</p>
                </div>

                <button
                    onClick={onRetry}
                    className="px-6 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 hover:bg-slate-700/50 transition-all inline-flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Réessayer
                </button>
            </motion.div>
        </div>
    );
}

// =============================================================================
// ASTRO DATA CARD
// =============================================================================

function AstroCard({
    label,
    value,
    icon: Icon,
    delay,
}: {
    label: string;
    value?: string;
    icon: typeof Sun;
    delay: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4 text-center"
        >
            <Icon className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <span className="text-xs uppercase tracking-wider text-slate-500 block mb-1">
                {label}
            </span>
            <span className="text-sm font-medium text-white">
                {value || "Non renseigné"}
            </span>
        </motion.div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SynthesisPage() {
    const { hasCapability, isLoading: entitlementsLoading, highestLevel } = useSanctuaire();
    const { categories, isLoading: insightsLoading, error: insightsError, refetch } = useInsights();

    // Local state for spiritual path and user profile
    const [spiritualPath, setSpiritualPath] = useState<SpiritualPathAPIResponse | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfileAPIResponse | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [dataError, setDataError] = useState<string | null>(null);

    // Modal state for insights
    const [selectedInsight, setSelectedInsight] = useState<CategoryWithInsight | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { markAsViewed } = useInsights();

    // Fetch spiritual path and user profile
    useEffect(() => {
        const fetchData = async () => {
            const token = localStorage.getItem('sanctuaire_token');
            if (!token) {
                setIsLoadingData(false);
                return;
            }

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

            try {
                // Fetch spiritual path
                const pathRes = await fetch(`${apiUrl}/api/client/spiritual-path`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (pathRes.ok) {
                    const pathData = await pathRes.json();
                    setSpiritualPath(pathData);
                }

                // Fetch user profile
                const profileRes = await fetch(`${apiUrl}/api/client/profile`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    setUserProfile(profileData);
                }
            } catch (err) {
                console.error('Failed to fetch synthesis data:', err);
                setDataError('Erreur lors du chargement');
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, []);

    // Handle explore click
    const handleExplore = (data: CategoryWithInsight) => {
        setSelectedInsight(data);
        setIsModalOpen(true);
        if (data.isNew && data.insight) {
            markAsViewed(data.category);
        }
    };

    // Handle modal close
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setTimeout(() => setSelectedInsight(null), 300);
    };

    // Loading state
    if (entitlementsLoading || isLoadingData) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
            </div>
        );
    }

    // Check access: UNLOCKED for all levels now (Initié includes synthesis_dashboard)
    const hasAccess = highestLevel >= 1 || hasCapability("synthesis_dashboard") || hasCapability("sanctuaire.sphere.synthesis");

    // If no spiritual path yet, show awaiting state (not locked!)
    if (!spiritualPath && hasAccess) {
        return <AwaitingAnalysisState />;
    }

    // Data error state
    if (dataError || insightsError) {
        return <ErrorState error={dataError || insightsError || 'Erreur inconnue'} onRetry={refetch} />;
    }

    // Insights loading state
    if (insightsLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto" />
                    <p className="text-slate-500 text-sm">Chargement de votre essence...</p>
                </div>
            </div>
        );
    }

    // Extract data
    const archetype = spiritualPath?.archetype || "Archétype en Révélation";
    const synthesis = spiritualPath?.synthesis || "";
    const keywords = spiritualPath?.keywords || [];
    const keyBlockage = spiritualPath?.keyBlockage;
    const photoUrl = userProfile?.profile?.facePhotoUrl;
    const profile = userProfile?.profile;
    const userName = userProfile ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim() : undefined;

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
                        <h1 className="text-3xl md:text-4xl font-playfair italic bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                            Votre Essence Spirituelle
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            Découvrez la révélation de votre âme par l&apos;Oracle
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={refetch}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 transition-all text-sm"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actualiser
                        </button>
                        <Link href="/sanctuaire">
                            <button className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-slate-300 hover:border-amber-500/30 transition-all">
                                <Home className="w-5 h-5" />
                                Sanctuaire
                            </button>
                        </Link>
                    </div>
                </div>
            </motion.div>

            {/* Bento Grid Layout */}
            <div className="space-y-6">
                {/* Top Row: The Core */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Card A: The Mirror */}
                    <SoulMirror
                        photoUrl={photoUrl}
                        userName={userName}
                        archetype={archetype}
                    />

                    {/* Card B: The Identity */}
                    <ArchetypeCard
                        archetype={archetype}
                        keywords={keywords}
                        emotionalState={spiritualPath?.emotionalState}
                        keyBlockage={keyBlockage}
                    />
                </div>

                {/* Middle Row: The Narrative */}
                {synthesis && (
                    <SynthesisContent
                        synthesis={synthesis}
                        lifeMission={spiritualPath?.lifeMission}
                    />
                )}

                {/* Bottom Row: Astro Data */}
                {profile && (
                    <div className="grid grid-cols-3 gap-4">
                        <AstroCard label="Soleil" value={profile.sunSign} icon={Sun} delay={0.5} />
                        <AstroCard label="Lune" value={profile.moonSign} icon={Moon} delay={0.6} />
                        <AstroCard label="Ascendant" value={profile.risingSign} icon={ArrowUp} delay={0.7} />
                    </div>
                )}
            </div>

            {/* Insights Section */}
            {categories.length > 0 && categories.some(c => c.insight) && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="mt-12"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <h2 className="text-2xl font-playfair italic text-white">
                            Vos Insights
                        </h2>
                        {newInsightsCount > 0 && (
                            <span className="px-3 py-1 text-xs font-semibold bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">
                                {newInsightsCount} nouveau{newInsightsCount > 1 ? "x" : ""}
                            </span>
                        )}
                    </div>

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
                </motion.div>
            )}

            {/* Empty insights state */}
            {categories.every((c) => !c.insight) && spiritualPath && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-8"
                >
                    <GlassCard className="p-6 text-center max-w-2xl mx-auto">
                        <Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                        <h3 className="text-xl font-playfair italic text-slate-200 mb-2">
                            Insights en cours de génération
                        </h3>
                        <p className="text-slate-500 text-sm">
                            Notre agent IA analyse votre parcours spirituel et prépare
                            des insights personnalisés pour chaque dimension de votre vie.
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
