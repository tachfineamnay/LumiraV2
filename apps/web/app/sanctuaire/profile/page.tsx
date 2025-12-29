"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    User,
    Mail,
    Phone,
    Calendar,
    Clock,
    MapPin,
    Target,
    Info,
    Camera,
    Hand,
    Edit3,
    Save,
    X,
    Check,
    Upload
} from "lucide-react";
import { GlassCard } from "../../../components/ui/GlassCard";
import { LevelBadge } from "../../../components/ui/LevelBadge";
import { useSanctuaire } from "../../../context/SanctuaireContext";
import { useAuth } from "../../../context/AuthContext";

// =============================================================================
// TYPES
// =============================================================================

interface ProfileData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    birthDate: string;
    birthTime: string;
    birthPlace: string;
    spiritualObjective: string;
    additionalInfo: string;
    facePhoto?: string;
    palmPhoto?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ProfilePage() {
    const { levelMetadata, isLoading } = useSanctuaire();
    const { user } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Mock profile data
    const [profile, setProfile] = useState<ProfileData>({
        firstName: user?.name?.split(" ")[0] || "Prénom",
        lastName: user?.name?.split(" ").slice(1).join(" ") || "Nom",
        email: user?.email || "email@example.com",
        phone: "Non renseigné",
        birthDate: "11/11/1983",
        birthTime: "11:11",
        birthPlace: "Paris, France",
        spiritualObjective: "Découvrir ma mission de vie",
        additionalInfo: "Je suis en quête de sens et de guidance spirituelle.",
        facePhoto: undefined,
        palmPhoto: undefined,
    });

    const displayLevel = (levelMetadata?.level || 1) as 1 | 2 | 3 | 4;
    const profileComplete = profile.birthDate && profile.birthTime;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-playfair italic text-gradient-dawn mb-2">
                            Mon Profil Spirituel
                        </h1>
                        <div className="flex items-center gap-3 text-star-dim text-sm">
                            <Check className={`w-4 h-4 ${profileComplete ? "text-emerald-400" : "text-dawn-gold"}`} />
                            <span>{profileComplete ? "Profil complété" : "Profil incomplet"}</span>
                            <span className="text-star-dim/40">•</span>
                            <span>Soumis le 21/10/2025</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 ${isEditing
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                                : "bg-dawn-gold/20 text-dawn-gold border border-dawn-gold/30 hover:bg-dawn-gold/30"
                            }`}
                    >
                        {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                        {isEditing ? "Annuler" : "Modifier"}
                    </button>
                </div>
            </motion.div>

            {/* Content Grid */}
            <div className="space-y-6">
                {/* Personal Information */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <GlassCard className="p-6">
                        <h2 className="text-lg font-playfair italic text-dawn-amber mb-6 flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Informations Personnelles
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Prénom */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-star-dim uppercase tracking-wider mb-2">
                                    <User className="w-3 h-3" /> Prénom
                                </label>
                                <div className="p-3 rounded-xl bg-cosmos-twilight/50 border border-white/5 text-star-silver">
                                    {profile.firstName}
                                </div>
                            </div>

                            {/* Nom */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-star-dim uppercase tracking-wider mb-2">
                                    <User className="w-3 h-3" /> Nom
                                </label>
                                <div className="p-3 rounded-xl bg-cosmos-twilight/50 border border-white/5 text-star-silver">
                                    {profile.lastName}
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-star-dim uppercase tracking-wider mb-2">
                                    <Mail className="w-3 h-3" /> Email
                                </label>
                                <div className="p-3 rounded-xl bg-cosmos-twilight/50 border border-white/5 text-star-silver">
                                    {profile.email}
                                </div>
                            </div>

                            {/* Téléphone */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-star-dim uppercase tracking-wider mb-2">
                                    <Phone className="w-3 h-3" /> Téléphone
                                </label>
                                <div className="p-3 rounded-xl bg-cosmos-twilight/50 border border-white/5 text-star-dim">
                                    {profile.phone}
                                </div>
                            </div>

                            {/* Date de naissance */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-star-dim uppercase tracking-wider mb-2">
                                    <Calendar className="w-3 h-3" /> Date de naissance
                                </label>
                                <div className="p-3 rounded-xl bg-cosmos-twilight/50 border border-white/5 text-star-silver">
                                    {profile.birthDate}
                                </div>
                            </div>

                            {/* Heure de naissance */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-star-dim uppercase tracking-wider mb-2">
                                    <Clock className="w-3 h-3" /> Heure de naissance
                                </label>
                                <div className="p-3 rounded-xl bg-cosmos-twilight/50 border border-white/5 text-star-silver">
                                    {profile.birthTime}
                                </div>
                            </div>

                            {/* Objectif spirituel */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-star-dim uppercase tracking-wider mb-2">
                                    <Target className="w-3 h-3" /> Objectif spirituel
                                </label>
                                <div className="p-3 rounded-xl bg-cosmos-twilight/50 border border-white/5 text-star-silver">
                                    {profile.spiritualObjective}
                                </div>
                            </div>

                            {/* Informations complémentaires */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-star-dim uppercase tracking-wider mb-2">
                                    <Info className="w-3 h-3" /> Informations complémentaires
                                </label>
                                <div className="p-3 rounded-xl bg-cosmos-twilight/50 border border-white/5 text-star-silver">
                                    {profile.additionalInfo}
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Photos Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <GlassCard className="p-6">
                        <h2 className="text-lg font-playfair italic text-dawn-amber mb-6 flex items-center gap-2">
                            <Camera className="w-5 h-5" />
                            Photos Uploadées
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Photo de visage */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-star-dim uppercase tracking-wider mb-3">
                                    <Camera className="w-3 h-3" /> Photo de visage
                                </label>
                                <div
                                    className="aspect-[4/3] rounded-xl bg-cosmos-twilight/50 border border-dashed border-dawn-gold/30 flex flex-col items-center justify-center cursor-pointer hover:bg-cosmos-twilight/70 transition-colors"
                                    onClick={() => profile.facePhoto && setLightboxImage(profile.facePhoto)}
                                >
                                    <Camera className="w-10 h-10 text-dawn-gold/50 mb-3" />
                                    <span className="text-sm text-dawn-gold/80">Photo de visage</span>
                                    <span className="text-xs text-star-dim mt-1">Uploadée avec succès</span>
                                </div>
                            </div>

                            {/* Photo de paume */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-star-dim uppercase tracking-wider mb-3">
                                    <Hand className="w-3 h-3" /> Photo de paume
                                </label>
                                <div
                                    className="aspect-[4/3] rounded-xl bg-cosmos-twilight/50 border border-dashed border-cosmos-cyan/30 flex flex-col items-center justify-center cursor-pointer hover:bg-cosmos-twilight/70 transition-colors"
                                >
                                    <Hand className="w-10 h-10 text-cosmos-cyan/50 mb-3" />
                                    <span className="text-sm text-cosmos-cyan/80">Photo de paume</span>
                                    <span className="text-xs text-star-dim mt-1">Uploadée avec succès</span>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <GlassCard className="p-6">
                        <h2 className="text-lg font-playfair italic text-dawn-amber mb-6 flex items-center gap-2">
                            <Target className="w-5 h-5" />
                            Actions Rapides
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button className="p-4 rounded-xl bg-cosmos-twilight/50 border border-white/5 hover:border-dawn-gold/20 hover:bg-cosmos-twilight/70 transition-all text-left group">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-cosmos-cyan/20 flex items-center justify-center">
                                        <User className="w-4 h-4 text-cosmos-cyan" />
                                    </div>
                                    <span className="text-star-white font-medium group-hover:text-dawn-gold transition-colors">Mes Lectures</span>
                                </div>
                                <span className="text-xs text-star-dim">Consulter l'historique</span>
                            </button>

                            <button className="p-4 rounded-xl bg-gradient-to-r from-dawn-gold/20 to-dawn-amber/10 border border-dawn-gold/20 hover:border-dawn-gold/40 transition-all text-left group">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-dawn-gold/20 flex items-center justify-center">
                                        <Upload className="w-4 h-4 text-dawn-gold" />
                                    </div>
                                    <span className="text-dawn-gold font-medium">Nouvelle Lecture</span>
                                </div>
                                <span className="text-xs text-dawn-gold/60">Commander maintenant</span>
                            </button>

                            <button className="p-4 rounded-xl bg-cosmos-twilight/50 border border-white/5 hover:border-dawn-gold/20 hover:bg-cosmos-twilight/70 transition-all text-left group">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                        <MapPin className="w-4 h-4 text-purple-400" />
                                    </div>
                                    <span className="text-star-white font-medium group-hover:text-dawn-gold transition-colors">Retour Accueil</span>
                                </div>
                                <span className="text-xs text-star-dim">Tableau de bord</span>
                            </button>
                        </div>
                    </GlassCard>
                </motion.div>
            </div>

            {/* Lightbox */}
            <AnimatePresence>
                {lightboxImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                        onClick={() => setLightboxImage(null)}
                    >
                        <button className="absolute top-4 right-4 text-white/60 hover:text-white">
                            <X className="w-8 h-8" />
                        </button>
                        <img src={lightboxImage} alt="Photo" className="max-w-full max-h-full rounded-lg" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
