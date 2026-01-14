"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
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
    X,
    Check,
    Upload,
    Loader2,
    Save,
} from "lucide-react";
import Link from "next/link";
import { GlassCard } from "../../../components/ui/GlassCard";
import { LevelBadge } from "../../../components/ui/LevelBadge";
import { SmartPhotoUploader } from "../../../components/onboarding/SmartPhotoUploader";
import { useSanctuaire } from "../../../context/SanctuaireContext";
import { useSanctuaireAuth } from "../../../context/SanctuaireAuthContext";

// =============================================================================
// COMPONENT
// =============================================================================

export default function ProfilePage() {
    const { levelMetadata } = useSanctuaire();
    const { user, profile, refetchData } = useSanctuaireAuth();

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // Editable state for photos
    const [facePhoto, setFacePhoto] = useState<string | null>(null);
    const [palmPhoto, setPalmPhoto] = useState<string | null>(null);
    const [photosChanged, setPhotosChanged] = useState(false);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Get token from localStorage
    const getToken = useCallback(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("sanctuaire_token");
        }
        return null;
    }, []);

    // Initialize photos from profile
    React.useEffect(() => {
        if (profile) {
            setFacePhoto(profile.facePhotoUrl || null);
            setPalmPhoto(profile.palmPhotoUrl || null);
        }
    }, [profile]);

    // Handle photo save
    const handleSavePhotos = async () => {
        const token = getToken();
        if (!token) return;

        setIsSaving(true);
        try {
            await axios.patch(
                `${API_URL}/api/users/profile`,
                {
                    facePhotoUrl: facePhoto,
                    palmPhotoUrl: palmPhoto,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            await refetchData();
            setIsEditing(false);
            setPhotosChanged(false);
        } catch (error) {
            console.error("Failed to save photos:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Cancel editing
    const handleCancelEdit = () => {
        setFacePhoto(profile?.facePhotoUrl || null);
        setPalmPhoto(profile?.palmPhotoUrl || null);
        setIsEditing(false);
        setPhotosChanged(false);
    };

    // Handle photo changes
    const handleFacePhotoChange = (photo: string | null) => {
        setFacePhoto(photo);
        setPhotosChanged(true);
    };

    const handlePalmPhotoChange = (photo: string | null) => {
        setPalmPhoto(photo);
        setPhotosChanged(true);
    };

    // Format date for display
    const formatDate = (dateStr: string | null | undefined): string => {
        if (!dateStr) return "Non renseigné";
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            });
        } catch {
            return dateStr;
        }
    };

    const displayLevel = (levelMetadata?.level || 1) as 1 | 2 | 3 | 4;
    const profileComplete = !!(profile?.birthDate && (profile?.facePhotoUrl || profile?.palmPhotoUrl || profile?.profileCompleted));

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
                        <h1 className="text-3xl md:text-4xl font-playfair italic text-gradient-gold mb-2">
                            Mon Profil Spirituel
                        </h1>
                        <div className="flex items-center gap-3 text-stellar-500 text-sm">
                            <LevelBadge level={displayLevel} />
                            <Check className={`w-4 h-4 ${profileComplete ? "text-emerald-400" : "text-horizon-400"}`} />
                            <span>{profileComplete ? "Profil complété" : "Profil incomplet"}</span>
                        </div>
                    </div>

                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCancelEdit}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-all"
                            >
                                <X className="w-4 h-4" />
                                Annuler
                            </button>
                            {photosChanged && (
                                <button
                                    onClick={handleSavePhotos}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Enregistrer
                                </button>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-horizon-400/20 text-horizon-300 border border-horizon-400/30 hover:bg-horizon-400/30 transition-all"
                        >
                            <Edit3 className="w-4 h-4" />
                            Modifier les photos
                        </button>
                    )}
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
                        <h2 className="text-lg font-playfair italic text-horizon-300 mb-6 flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Informations Personnelles
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Prénom */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-2">
                                    <User className="w-3 h-3" /> Prénom
                                </label>
                                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/5 text-stellar-200">
                                    {user?.firstName || "Non renseigné"}
                                </div>
                            </div>

                            {/* Nom */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-2">
                                    <User className="w-3 h-3" /> Nom
                                </label>
                                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/5 text-stellar-200">
                                    {user?.lastName || "Non renseigné"}
                                </div>
                            </div>

                            {/* Email */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-2">
                                    <Mail className="w-3 h-3" /> Email
                                </label>
                                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/5 text-stellar-200">
                                    {user?.email || "Non renseigné"}
                                </div>
                            </div>

                            {/* Téléphone */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-2">
                                    <Phone className="w-3 h-3" /> Téléphone
                                </label>
                                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/5 text-stellar-400">
                                    {user?.phone || "Non renseigné"}
                                </div>
                            </div>

                            {/* Date de naissance */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-2">
                                    <Calendar className="w-3 h-3" /> Date de naissance
                                </label>
                                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/5 text-stellar-200">
                                    {formatDate(profile?.birthDate)}
                                </div>
                            </div>

                            {/* Heure de naissance */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-2">
                                    <Clock className="w-3 h-3" /> Heure de naissance
                                </label>
                                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/5 text-stellar-200">
                                    {profile?.birthTime || "Non renseigné"}
                                </div>
                            </div>

                            {/* Lieu de naissance */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-2">
                                    <MapPin className="w-3 h-3" /> Lieu de naissance
                                </label>
                                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/5 text-stellar-200">
                                    {profile?.birthPlace || "Non renseigné"}
                                </div>
                            </div>

                            {/* Question spirituelle */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-2">
                                    <Target className="w-3 h-3" /> Question spirituelle
                                </label>
                                <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/5 text-stellar-200">
                                    {profile?.specificQuestion || "Non renseigné"}
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
                        <h2 className="text-lg font-playfair italic text-horizon-300 mb-6 flex items-center gap-2">
                            <Camera className="w-5 h-5" />
                            Photos Uploadées
                            {isEditing && (
                                <span className="ml-2 text-xs text-stellar-500 font-normal">
                                    (Mode édition)
                                </span>
                            )}
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Photo de visage */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-3">
                                    <Camera className="w-3 h-3" /> Photo de visage
                                </label>

                                {isEditing ? (
                                    <SmartPhotoUploader
                                        label="Photo de visage"
                                        description="Pour la lecture physiognomonique"
                                        value={facePhoto || undefined}
                                        onChange={handleFacePhotoChange}
                                    />
                                ) : facePhoto ? (
                                    <div
                                        className="aspect-[4/3] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
                                        onClick={() => setLightboxImage(facePhoto)}
                                    >
                                        <img
                                            src={facePhoto}
                                            alt="Photo de visage"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-abyss-800/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                                            <span className="text-xs text-stellar-200">Cliquez pour agrandir</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="aspect-[4/3] rounded-xl bg-abyss-500/30 border border-dashed border-horizon-400/30 flex flex-col items-center justify-center">
                                        <Camera className="w-10 h-10 text-horizon-400/50 mb-3" />
                                        <span className="text-sm text-stellar-500">Aucune photo</span>
                                        <span className="text-xs text-stellar-600 mt-1">
                                            Cliquez sur &quot;Modifier&quot; pour ajouter
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Photo de paume */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-3">
                                    <Hand className="w-3 h-3" /> Photo de paume
                                </label>

                                {isEditing ? (
                                    <SmartPhotoUploader
                                        label="Photo de paume"
                                        description="Pour la lecture palmaire"
                                        value={palmPhoto || undefined}
                                        onChange={handlePalmPhotoChange}
                                    />
                                ) : palmPhoto ? (
                                    <div
                                        className="aspect-[4/3] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
                                        onClick={() => setLightboxImage(palmPhoto)}
                                    >
                                        <img
                                            src={palmPhoto}
                                            alt="Photo de paume"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-abyss-800/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                                            <span className="text-xs text-stellar-200">Cliquez pour agrandir</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="aspect-[4/3] rounded-xl bg-abyss-500/30 border border-dashed border-serenity-400/30 flex flex-col items-center justify-center">
                                        <Hand className="w-10 h-10 text-serenity-400/50 mb-3" />
                                        <span className="text-sm text-stellar-500">Aucune photo</span>
                                        <span className="text-xs text-stellar-600 mt-1">
                                            Cliquez sur &quot;Modifier&quot; pour ajouter
                                        </span>
                                    </div>
                                )}
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
                        <h2 className="text-lg font-playfair italic text-horizon-300 mb-6 flex items-center gap-2">
                            <Target className="w-5 h-5" />
                            Actions Rapides
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Link href="/sanctuaire/draws">
                                <button className="w-full p-4 rounded-xl bg-abyss-500/30 border border-white/5 hover:border-horizon-400/20 hover:bg-abyss-400/30 transition-all text-left group">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-serenity-400/20 flex items-center justify-center">
                                            <User className="w-4 h-4 text-serenity-300" />
                                        </div>
                                        <span className="text-stellar-200 font-medium group-hover:text-horizon-300 transition-colors">Mes Lectures</span>
                                    </div>
                                    <span className="text-xs text-stellar-500">Consulter l&apos;historique</span>
                                </button>
                            </Link>

                            <Link href="/commande">
                                <button className="w-full p-4 rounded-xl bg-gradient-to-r from-horizon-400/20 to-horizon-500/10 border border-horizon-400/20 hover:border-horizon-400/40 transition-all text-left group">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-horizon-400/20 flex items-center justify-center">
                                            <Upload className="w-4 h-4 text-horizon-300" />
                                        </div>
                                        <span className="text-horizon-300 font-medium">Nouvelle Lecture</span>
                                    </div>
                                    <span className="text-xs text-horizon-400/60">Commander maintenant</span>
                                </button>
                            </Link>

                            <Link href="/sanctuaire">
                                <button className="w-full p-4 rounded-xl bg-abyss-500/30 border border-white/5 hover:border-horizon-400/20 hover:bg-abyss-400/30 transition-all text-left group">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                            <MapPin className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <span className="text-stellar-200 font-medium group-hover:text-horizon-300 transition-colors">Retour Accueil</span>
                                    </div>
                                    <span className="text-xs text-stellar-500">Tableau de bord</span>
                                </button>
                            </Link>
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
                        <button
                            className="absolute top-4 right-4 text-white/60 hover:text-white"
                            aria-label="Fermer"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        <img src={lightboxImage} alt="Photo" className="max-w-full max-h-full rounded-lg" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
