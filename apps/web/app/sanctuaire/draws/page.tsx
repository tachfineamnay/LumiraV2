"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    Book,
    FileText,
    Headphones,
    Crown,
    Calendar,
    Clock,
    MapPin,
    Target,
    Star,
    Check,
    Loader2,
    Lock,
    Plus
} from "lucide-react";
import { GlassCard } from "../../../components/ui/GlassCard";
import { useSanctuaire } from "../../../context/SanctuaireContext";

// =============================================================================
// TYPES
// =============================================================================

interface Reading {
    id: string;
    title: string;
    date: string;
    question: string;
    objective: string;
    birthData: { date: string; time: string; place: string };
    assets: {
        pdf: { status: "available" | "generating" | "locked"; url?: string };
        audio: { status: "available" | "generating" | "locked"; url?: string };
        mandala: { status: "available" | "generating" | "locked"; url?: string };
    };
    status: "paid" | "processing" | "validation" | "delivered";
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_READINGS: Reading[] = [
    {
        id: "1",
        title: "Lecture Spirituelle Intégrale",
        date: "22 Déc 2024",
        question: "Quel est le sens profond de ma vie ?",
        objective: "Découvrir ma mission de vie",
        birthData: { date: "11/11/1983", time: "11:11", place: "Paris, France" },
        assets: {
            pdf: { status: "available", url: "#" },
            audio: { status: "available", url: "#" },
            mandala: { status: "locked" },
        },
        status: "delivered",
    },
    {
        id: "2",
        title: "Tirage des Énergies",
        date: "20 Déc 2024",
        question: "Comment améliorer mes relations ?",
        objective: "Harmoniser mes énergies relationnelles",
        birthData: { date: "11/11/1983", time: "11:11", place: "Paris, France" },
        assets: {
            pdf: { status: "generating" },
            audio: { status: "locked" },
            mandala: { status: "locked" },
        },
        status: "processing",
    },
];

// =============================================================================
// LEVEL PROGRESS BAR
// =============================================================================

function LevelProgressBar({ currentLevel }: { currentLevel: number }) {
    const levels = [
        { level: 1, name: "Initié", icon: Star },
        { level: 2, name: "Mystique", icon: Star },
        { level: 3, name: "Profond", icon: Star },
        { level: 4, name: "Intégral", icon: Crown },
    ];

    return (
        <div className="flex items-center gap-2">
            {levels.map((l, i) => (
                <React.Fragment key={l.level}>
                    <div className={`flex items-center gap-1.5 ${currentLevel >= l.level ? "text-dawn-gold" : "text-star-dim/40"}`}>
                        <l.icon className={`w-4 h-4 ${currentLevel >= l.level ? "fill-dawn-gold" : ""}`} />
                        <span className="text-xs font-medium hidden sm:inline">{l.name}</span>
                    </div>
                    {i < levels.length - 1 && (
                        <div className={`w-6 h-0.5 ${currentLevel > l.level ? "bg-dawn-gold" : "bg-star-dim/20"}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

// =============================================================================
// STATUS TIMELINE
// =============================================================================

function StatusTimeline({ status }: { status: Reading["status"] }) {
    const steps = [
        { key: "paid", label: "Payé" },
        { key: "processing", label: "En cours" },
        { key: "validation", label: "Validation" },
        { key: "delivered", label: "Livré" },
    ];

    const currentIndex = steps.findIndex(s => s.key === status);

    return (
        <div className="flex items-center gap-1">
            {steps.map((step, i) => (
                <React.Fragment key={step.key}>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${i <= currentIndex
                            ? "bg-dawn-gold/20 text-dawn-gold"
                            : "bg-white/5 text-star-dim/40"
                        }`}>
                        {i < currentIndex && <Check className="w-3 h-3" />}
                        {i === currentIndex && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span className="hidden sm:inline">{step.label}</span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`w-4 h-0.5 ${i < currentIndex ? "bg-dawn-gold" : "bg-star-dim/20"}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

// =============================================================================
// ASSET TAB
// =============================================================================

function AssetTab({
    icon: Icon,
    label,
    status,
    isActive,
    onClick,
    requiredLevel
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    status: "available" | "generating" | "locked";
    isActive: boolean;
    onClick: () => void;
    requiredLevel?: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                    ? "bg-dawn-gold/20 text-dawn-gold border border-dawn-gold/30"
                    : status === "locked"
                        ? "bg-white/5 text-star-dim/40 border border-white/5 cursor-not-allowed"
                        : "bg-white/5 text-star-silver border border-white/10 hover:bg-white/10"
                }`}
            disabled={status === "locked"}
        >
            {status === "locked" ? <Lock className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
            <span>{label}</span>
            {status === "generating" && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
            {status === "locked" && requiredLevel != null && (
                <span className="ml-auto text-[10px] text-star-dim/50 uppercase tracking-widest">
                    Niv. {requiredLevel}+
                </span>
            )}
        </button>
    );
}

// =============================================================================
// UPGRADE CARD
// =============================================================================

function UpgradeCard({
    level,
    name,
    price,
    features,
    isComingSoon
}: {
    level: number;
    name: string;
    price: string;
    features: string[];
    isComingSoon?: boolean;
}) {
    return (
        <div className={`p-5 rounded-2xl border ${isComingSoon ? "bg-white/5 border-white/10" : "bg-gradient-to-br from-dawn-gold/10 to-dawn-amber/5 border-dawn-gold/20"}`}>
            <div className="flex items-center justify-between mb-3">
                <span className={`text-sm font-bold ${isComingSoon ? "text-star-dim" : "text-dawn-gold"}`}>
                    Niveau {level} — {name}
                </span>
                <span className={`text-lg font-bold ${isComingSoon ? "text-star-dim" : "text-star-white"}`}>
                    {price}
                </span>
            </div>
            <ul className="space-y-2 mb-4">
                {features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-star-dim">
                        <Check className={`w-3 h-3 ${isComingSoon ? "text-star-dim/40" : "text-dawn-gold"}`} />
                        {f}
                    </li>
                ))}
            </ul>
            <button
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${isComingSoon
                        ? "bg-white/5 text-star-dim cursor-not-allowed"
                        : "bg-gradient-to-r from-dawn-gold to-dawn-amber text-cosmos-deep hover:shadow-dawn-glow"
                    }`}
                disabled={isComingSoon}
            >
                {isComingSoon ? "Bientôt disponible" : "Débloquer"}
            </button>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DrawsPage() {
    const { highestLevel, isLoading } = useSanctuaire();
    const [selectedReading, setSelectedReading] = useState(MOCK_READINGS[0]);
    const [activeTab, setActiveTab] = useState<"pdf" | "audio" | "mandala">("pdf");

    const currentLevel = Math.max(1, highestLevel) as 1 | 2 | 3 | 4;

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-12 h-12 text-dawn-gold animate-spin" />
            </div>
        );
    }

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
                        <h1 className="text-3xl md:text-4xl font-playfair italic text-gradient-dawn mb-2">
                            Mes Lectures & Tirages
                        </h1>
                        <p className="text-star-dim text-sm">
                            Bienvenue, accédez à vos révélations personnalisées
                        </p>
                    </div>
                    <Link href="/commande">
                        <button className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-dawn-gold to-dawn-amber text-cosmos-deep font-semibold hover:shadow-dawn-glow transition-all">
                            <Plus className="w-5 h-5" />
                            Nouvelle lecture
                        </button>
                    </Link>
                </div>
            </motion.div>

            {/* Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Reading Selector Pills */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {MOCK_READINGS.map((reading) => (
                                <button
                                    key={reading.id}
                                    onClick={() => setSelectedReading(reading)}
                                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedReading.id === reading.id
                                            ? "bg-dawn-gold/20 text-dawn-gold border border-dawn-gold/30"
                                            : "bg-white/5 text-star-dim border border-white/10 hover:bg-white/10"
                                        }`}
                                >
                                    {reading.title}
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Reading Context */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <GlassCard className="p-6">
                            <h2 className="text-lg font-playfair italic text-dawn-amber mb-4 flex items-center gap-2">
                                <Book className="w-5 h-5" />
                                Contexte de la lecture
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-cosmos-twilight/50">
                                    <label className="text-xs text-star-dim uppercase tracking-wider mb-1 block">
                                        <Target className="w-3 h-3 inline mr-1" /> Question posée
                                    </label>
                                    <p className="text-star-silver text-sm">{selectedReading.question}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-cosmos-twilight/50">
                                    <label className="text-xs text-star-dim uppercase tracking-wider mb-1 block">
                                        <Star className="w-3 h-3 inline mr-1" /> Objectif spirituel
                                    </label>
                                    <p className="text-star-silver text-sm">{selectedReading.objective}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-cosmos-twilight/50 md:col-span-2">
                                    <label className="text-xs text-star-dim uppercase tracking-wider mb-1 block">Données de naissance</label>
                                    <div className="flex flex-wrap gap-4 text-sm text-star-silver">
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-dawn-gold" /> {selectedReading.birthData.date}</span>
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-dawn-gold" /> {selectedReading.birthData.time}</span>
                                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-dawn-gold" /> {selectedReading.birthData.place}</span>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>

                    {/* Assets Tabs */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <GlassCard className="p-6">
                            <div className="flex flex-wrap gap-2 mb-6">
                                <AssetTab
                                    icon={FileText}
                                    label="PDF"
                                    status={selectedReading.assets.pdf.status}
                                    isActive={activeTab === "pdf"}
                                    onClick={() => setActiveTab("pdf")}
                                />
                                <AssetTab
                                    icon={Headphones}
                                    label="Audio"
                                    status={selectedReading.assets.audio.status}
                                    isActive={activeTab === "audio"}
                                    onClick={() => setActiveTab("audio")}
                                    requiredLevel={2}
                                />
                                <AssetTab
                                    icon={Crown}
                                    label="Mandala"
                                    status={selectedReading.assets.mandala.status}
                                    isActive={activeTab === "mandala"}
                                    onClick={() => setActiveTab("mandala")}
                                    requiredLevel={3}
                                />
                            </div>

                            {/* Tab Content */}
                            <div className="p-6 rounded-xl bg-cosmos-twilight/50 border border-white/5 min-h-[150px] flex items-center justify-center">
                                {selectedReading.assets[activeTab].status === "available" && (
                                    <button className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-dawn-gold to-dawn-amber text-cosmos-deep font-semibold hover:shadow-dawn-glow transition-all">
                                        {activeTab === "pdf" && <FileText className="w-5 h-5" />}
                                        {activeTab === "audio" && <Headphones className="w-5 h-5" />}
                                        {activeTab === "mandala" && <Crown className="w-5 h-5" />}
                                        {activeTab === "pdf" ? "Voir le PDF" : activeTab === "audio" ? "Écouter" : "Voir le Mandala"}
                                    </button>
                                )}
                                {selectedReading.assets[activeTab].status === "generating" && (
                                    <div className="text-center">
                                        <Loader2 className="w-8 h-8 text-dawn-gold animate-spin mx-auto mb-3" />
                                        <p className="text-star-dim">Génération en cours...</p>
                                    </div>
                                )}
                                {selectedReading.assets[activeTab].status === "locked" && (
                                    <div className="text-center">
                                        <Lock className="w-8 h-8 text-star-dim/40 mx-auto mb-3" />
                                        <p className="text-star-dim">Niveau supérieur requis</p>
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </motion.div>

                    {/* Progress & Status */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                        <GlassCard className="p-6">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                <div>
                                    <label className="text-xs text-star-dim uppercase tracking-wider mb-2 block">Niveau actuel</label>
                                    <LevelProgressBar currentLevel={currentLevel} />
                                </div>
                                <div>
                                    <label className="text-xs text-star-dim uppercase tracking-wider mb-2 block">Statut de la lecture</label>
                                    <StatusTimeline status={selectedReading.status} />
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                </div>

                {/* Upgrade Sidebar */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-star-dim uppercase tracking-wider">Évoluez</h3>
                    <UpgradeCard
                        level={2}
                        name="Mystique"
                        price="49€"
                        features={["Accès Audio", "Rituels personnalisés"]}
                    />
                    <UpgradeCard
                        level={3}
                        name="Profond"
                        price="99€"
                        features={["Mandala HD", "Synthèse complète"]}
                    />
                    <UpgradeCard
                        level={4}
                        name="Intégral"
                        price="199€"
                        features={["Guidance 30 jours", "Mentorat exclusif"]}
                        isComingSoon
                    />
                </div>
            </div>
        </div>
    );
}
