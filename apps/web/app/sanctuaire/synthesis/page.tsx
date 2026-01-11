"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    Layers,
    FileText,
    Download,
    Eye,
    Star,
    Compass,
    Moon,
    Sun,
    Sparkles,
    TrendingUp,
    Heart,
    Loader2,
    Lock,
    ChevronRight,
    Calendar,
    Clock
} from "lucide-react";
import { GlassCard } from "../../../components/ui/GlassCard";
import { useSanctuaire } from "../../../context/SanctuaireContext";

// =============================================================================
// TYPES
// =============================================================================

interface SynthesisSection {
    id: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    content: string;
    keyInsights: string[];
}

interface UserProfile {
    birthDate: string;
    birthTime: string;
    birthPlace: string;
    sunSign: string;
    moonSign: string;
    ascendant: string;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_PROFILE: UserProfile = {
    birthDate: "11 Novembre 1983",
    birthTime: "11:11",
    birthPlace: "Paris, France",
    sunSign: "Scorpion",
    moonSign: "Poissons",
    ascendant: "Vierge",
};

const MOCK_SECTIONS: SynthesisSection[] = [
    {
        id: "essence",
        title: "Votre Essence Spirituelle",
        icon: Sparkles,
        description: "L'énergie fondamentale qui vous anime",
        content: "Votre thème révèle une âme en quête de transformation profonde. Le Soleil en Scorpion confère une intensité émotionnelle remarquable, une capacité à percevoir ce qui est caché, et un désir ardent de renaissance perpétuelle. Vous êtes un chercheur de vérité, attiré par les mystères de l'existence.",
        keyInsights: [
            "Intuition profonde et perception des non-dits",
            "Capacité de régénération après les épreuves",
            "Pouvoir de transformation personnelle"
        ]
    },
    {
        id: "mission",
        title: "Votre Mission de Vie",
        icon: Compass,
        description: "Le chemin que votre âme a choisi de parcourir",
        content: "Votre mission s'articule autour de l'accompagnement des autres dans leurs propres transformations. Vous êtes appelé à être un guide dans l'obscurité, aidant ceux qui traversent des périodes de transition. Votre capacité à voir au-delà des apparences fait de vous un allié précieux.",
        keyInsights: [
            "Guide spirituel pour les âmes en transition",
            "Révélateur de vérités cachées",
            "Catalyseur de transformations profondes"
        ]
    },
    {
        id: "lunar",
        title: "Votre Monde Émotionnel",
        icon: Moon,
        description: "La richesse de votre paysage intérieur",
        content: "La Lune en Poissons vous dote d'une sensibilité extrême et d'une empathie naturelle. Vous absorbez les émotions de votre environnement comme une éponge. Cette caractéristique, bien que parfois éprouvante, vous permet de comprendre intuitivement les besoins des autres.",
        keyInsights: [
            "Empathie profonde et naturelle",
            "Connection forte avec l'inconscient collectif",
            "Créativité nourrie par les émotions"
        ]
    },
    {
        id: "solar",
        title: "Votre Expression Authentique",
        icon: Sun,
        description: "Comment briller dans le monde",
        content: "Votre Soleil vous invite à embrasser pleinement votre nature intense sans craindre de faire peur. Votre authenticité réside dans votre capacité à plonger dans les profondeurs, que ce soit dans vos relations, vos projets ou votre développement personnel.",
        keyInsights: [
            "Authenticité dans l'intensité",
            "Leadership par la profondeur",
            "Rayonnement à travers la vérité"
        ]
    },
    {
        id: "growth",
        title: "Axes de Croissance",
        icon: TrendingUp,
        description: "Les domaines d'évolution prioritaires",
        content: "Votre chemin de croissance passe par l'apprentissage du lâcher-prise et de la légèreté. L'opposition naturelle entre votre intensité Scorpion et la nécessité de détachement crée une tension créatrice qui, bien canalisée, devient votre plus grande force.",
        keyInsights: [
            "Cultiver la légèreté sans perdre la profondeur",
            "Apprendre le détachement émotionnel sain",
            "Transformer l'intensité en sagesse"
        ]
    },
    {
        id: "relationships",
        title: "Vos Relations Karmiques",
        icon: Heart,
        description: "Les liens d'âme qui façonnent votre parcours",
        content: "Vos relations sont marquées par l'intensité et la profondeur. Vous attirez naturellement des partenaires qui vous poussent à grandir, parfois à travers des défis. Ces connexions karmiques sont des miroirs puissants pour votre évolution spirituelle.",
        keyInsights: [
            "Attraction de partenaires transformateurs",
            "Apprentissage par les défis relationnels",
            "Évolution mutuelle dans l'intimité"
        ]
    }
];

// =============================================================================
// SECTION CARD COMPONENT
// =============================================================================

function SynthesisSectionCard({ section, index }: { section: SynthesisSection; index: number }) {
    const Icon = section.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
        >
            <GlassCard className="p-6 h-full">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-horizon-400/20 to-horizon-500/10 flex items-center justify-center border border-horizon-400/20 flex-shrink-0">
                        <Icon className="w-6 h-6 text-horizon-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-playfair italic text-stellar-100 mb-1">
                            {section.title}
                        </h3>
                        <p className="text-xs text-stellar-500 uppercase tracking-wider">
                            {section.description}
                        </p>
                    </div>
                </div>

                <p className="text-stellar-400 text-sm leading-relaxed mb-4">
                    {section.content}
                </p>

                <div className="pt-4 border-t border-white/[0.05]">
                    <p className="text-xs text-horizon-400 uppercase tracking-wider mb-2 font-medium">
                        Points Clés
                    </p>
                    <ul className="space-y-2">
                        {section.keyInsights.map((insight, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-stellar-300">
                                <Star className="w-3 h-3 text-horizon-400 mt-1 flex-shrink-0" />
                                <span>{insight}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </GlassCard>
        </motion.div>
    );
}

// =============================================================================
// PROFILE OVERVIEW COMPONENT
// =============================================================================

function ProfileOverview({ profile }: { profile: UserProfile }) {
    return (
        <GlassCard className="p-6">
            <h2 className="text-lg font-playfair italic text-horizon-300 mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Profil Astrologique
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/[0.05]">
                    <p className="text-xs text-stellar-500 uppercase tracking-wider mb-1">
                        <Sun className="w-3 h-3 inline mr-1" />
                        Soleil
                    </p>
                    <p className="text-stellar-200 font-medium">{profile.sunSign}</p>
                </div>
                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/[0.05]">
                    <p className="text-xs text-stellar-500 uppercase tracking-wider mb-1">
                        <Moon className="w-3 h-3 inline mr-1" />
                        Lune
                    </p>
                    <p className="text-stellar-200 font-medium">{profile.moonSign}</p>
                </div>
                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/[0.05]">
                    <p className="text-xs text-stellar-500 uppercase tracking-wider mb-1">
                        <Compass className="w-3 h-3 inline mr-1" />
                        Ascendant
                    </p>
                    <p className="text-stellar-200 font-medium">{profile.ascendant}</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-stellar-500">
                <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-horizon-400" />
                    {profile.birthDate}
                </span>
                <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-horizon-400" />
                    {profile.birthTime}
                </span>
                <span className="flex items-center gap-1">
                    <Compass className="w-3 h-3 text-horizon-400" />
                    {profile.birthPlace}
                </span>
            </div>
        </GlassCard>
    );
}

// =============================================================================
// DOWNLOAD SECTION COMPONENT
// =============================================================================

function DownloadSection() {
    return (
        <GlassCard className="p-6">
            <h2 className="text-lg font-playfair italic text-horizon-300 mb-4 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Télécharger votre Synthèse
            </h2>

            <div className="space-y-3">
                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-horizon-400/10 to-horizon-500/5 border border-horizon-400/20 hover:border-horizon-400/40 transition-all group">
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-horizon-400" />
                        <div className="text-left">
                            <p className="text-stellar-200 font-medium text-sm">Synthèse Complète PDF</p>
                            <p className="text-stellar-500 text-xs">Document de 24 pages</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-horizon-400 group-hover:translate-x-1 transition-transform" />
                </button>

                <button className="w-full flex items-center justify-between p-4 rounded-xl bg-abyss-500/30 border border-white/[0.05] hover:border-white/[0.1] transition-all group">
                    <div className="flex items-center gap-3">
                        <Layers className="w-5 h-5 text-stellar-400" />
                        <div className="text-left">
                            <p className="text-stellar-300 font-medium text-sm">Résumé Exécutif</p>
                            <p className="text-stellar-500 text-xs">Version condensée - 4 pages</p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stellar-400 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
        </GlassCard>
    );
}

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
                        Synthèse Profonde
                    </h1>
                    <p className="text-stellar-500 leading-relaxed">
                        Accédez à l&apos;analyse synthétique complète de votre parcours spirituel.
                        Cette section exclusive est réservée aux membres du niveau <span className="text-horizon-400 font-medium">Profond</span> et supérieur.
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
// MAIN COMPONENT
// =============================================================================

export default function SynthesisPage() {
    const { highestLevel, hasCapability, isLoading } = useSanctuaire();

    if (isLoading) {
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
                        <h1 className="text-3xl md:text-4xl font-playfair italic text-gradient-gold mb-2">
                            Votre Synthèse Profonde
                        </h1>
                        <p className="text-stellar-500 text-sm">
                            L&apos;analyse complète de votre parcours spirituel et de votre destinée
                        </p>
                    </div>
                    <Link href="/sanctuaire">
                        <button className="flex items-center gap-2 px-5 py-3 rounded-xl bg-abyss-500/50 border border-white/[0.1] text-stellar-300 hover:border-horizon-400/30 transition-all">
                            <Layers className="w-5 h-5" />
                            Retour au Sanctuaire
                        </button>
                    </Link>
                </div>
            </motion.div>

            {/* Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {MOCK_SECTIONS.map((section, index) => (
                        <SynthesisSectionCard
                            key={section.id}
                            section={section}
                            index={index}
                        />
                    ))}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <ProfileOverview profile={MOCK_PROFILE} />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <DownloadSection />
                    </motion.div>

                    {/* Level Badge */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <GlassCard className="p-6 text-center">
                            <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-horizon-400/20 to-horizon-500/10 flex items-center justify-center border border-horizon-400/20 mb-4">
                                <Star className="w-8 h-8 text-horizon-400" />
                            </div>
                            <p className="text-xs text-stellar-500 uppercase tracking-wider mb-1">
                                Votre Niveau
                            </p>
                            <p className="text-lg font-playfair italic text-horizon-300">
                                {highestLevel >= 4 ? "Intégral" : highestLevel >= 3 ? "Profond" : highestLevel >= 2 ? "Mystique" : "Initié"}
                            </p>
                        </GlassCard>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
