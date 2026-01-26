"use client";

export const dynamic = 'force-dynamic';

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
    Camera,
    Hand,
    Edit3,
    X,
    Save,
    Loader2,
    Brain,
    Activity,
    Heart,
    Sparkles,
    Target,
    Shield,
    Zap,
} from "lucide-react";
import Link from "next/link";
import { GlassCard } from "../../../components/ui/GlassCard";
import { LevelBadge } from "../../../components/ui/LevelBadge";
import { SmartPhotoUploader } from "../../../components/onboarding/SmartPhotoUploader";
import { useSanctuaire } from "../../../context/SanctuaireContext";
import { useSanctuaireAuth } from "../../../context/SanctuaireAuthContext";
import { DELIVERY_STYLES } from "../../../lib/holisticSchema";

// =============================================================================
// COMPONENT
// =============================================================================

export default function ProfilePage() {
    const { levelMetadata } = useSanctuaire();
    const { user, profile, refetchData } = useSanctuaireAuth();

    const [isEditingPhotos, setIsEditingPhotos] = useState(false);
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
            setIsEditingPhotos(false);
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
        setIsEditingPhotos(false);
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

    // Get delivery style info
    const getDeliveryStyleInfo = (style: string | null | undefined) => {
        if (!style || !(style in DELIVERY_STYLES)) {
            return { icon: "🎯", title: "Non défini", subtitle: "Pas encore configuré" };
        }
        return DELIVERY_STYLES[style as keyof typeof DELIVERY_STYLES];
    };

    // Get pace label
    const getPaceLabel = (pace: number | null | undefined): string => {
        if (pace === null || pace === undefined) return "Non défini";
        if (pace <= 25) return "Très lent";
        if (pace <= 50) return "Modéré";
        if (pace <= 75) return "Dynamique";
        return "Rapide";
    };

    const displayLevel = (levelMetadata?.level || 1) as 1 | 2 | 3 | 4;
    const profileComplete = profile?.profileCompleted ?? false;
    const deliveryStyle = getDeliveryStyleInfo(profile?.deliveryStyle);

    // Get user initials for avatar
    const getInitials = () => {
        const first = user?.firstName?.[0] || '';
        const last = user?.lastName?.[0] || '';
        return (first + last).toUpperCase() || '?';
    };

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {/* Premium Identity Card Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="card-premium p-6 md:p-8">
                    <div className="flex flex-col md:flex-row md:items-center gap-6">
                        {/* Avatar with Glow */}
                        <div className="relative">
                            <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-horizon-400 to-horizon-600 flex items-center justify-center avatar-glow">
                                <span className="text-3xl md:text-4xl font-playfair italic text-abyss-900 font-bold">
                                    {getInitials()}
                                </span>
                            </div>
                            {/* Status indicator */}
                            <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-abyss-700 flex items-center justify-center ${profileComplete ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                                {profileComplete ? (
                                    <Shield className="w-3 h-3 text-white" />
                                ) : (
                                    <Zap className="w-3 h-3 text-white" />
                                )}
                            </div>
                        </div>

                        {/* User Info */}
                        <div className="flex-1">
                            <h1 className="text-2xl md:text-3xl font-playfair italic text-gradient-gold mb-2">
                                {user?.firstName} {user?.lastName}
                            </h1>
                            <p className="text-stellar-400 text-sm mb-3">{user?.email}</p>
                            <div className="flex flex-wrap items-center gap-3">
                                <LevelBadge level={displayLevel} />
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${profileComplete ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                    {profileComplete ? (
                                        <><Shield className="w-3 h-3" /> Profil complété</>
                                    ) : (
                                        <><Zap className="w-3 h-3" /> Diagnostic en attente</>
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Action Button */}
                        <Link href="/sanctuaire/settings/history">
                            <button className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 text-stellar-300 border border-white/10 hover:bg-white/10 hover:border-horizon-400/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                                <Target className="w-4 h-4" />
                                Réglages
                            </button>
                        </Link>
                    </div>
                </div>
            </motion.div>

            {/* Content Grid */}
            <div className="space-y-6">
                
                {/* ============================================ */}
                {/* SECTION 1: INFORMATIONS PERSONNELLES */}
                {/* ============================================ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <GlassCard className="p-6 md:p-8">
                        <h2 className="text-lg font-playfair italic text-horizon-300 mb-6 flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Informations Personnelles
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2 font-medium">
                                    <User className="w-3 h-3" /> Prénom
                                </label>
                                <div className="p-4 rounded-xl bg-abyss-600/40 border border-white/[0.06] text-stellar-200">
                                    {user?.firstName || "Non renseigné"}
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2 font-medium">
                                    <User className="w-3 h-3" /> Nom
                                </label>
                                <div className="p-4 rounded-xl bg-abyss-600/40 border border-white/[0.06] text-stellar-200">
                                    {user?.lastName || "Non renseigné"}
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2 font-medium">
                                    <Mail className="w-3 h-3" /> Email
                                </label>
                                <div className="p-4 rounded-xl bg-abyss-600/40 border border-white/[0.06] text-stellar-200">
                                    {user?.email || "Non renseigné"}
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2 font-medium">
                                    <Phone className="w-3 h-3" /> Téléphone
                                </label>
                                <div className="p-4 rounded-xl bg-abyss-600/40 border border-white/[0.06] text-stellar-400">
                                    {user?.phone || "Non renseigné"}
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2 font-medium">
                                    <Calendar className="w-3 h-3" /> Date de naissance
                                </label>
                                <div className="p-4 rounded-xl bg-abyss-600/40 border border-white/[0.06] text-stellar-200">
                                    {formatDate(profile?.birthDate)}
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2 font-medium">
                                    <Clock className="w-3 h-3" /> Heure de naissance
                                </label>
                                <div className="p-4 rounded-xl bg-abyss-600/40 border border-white/[0.06] text-stellar-200">
                                    {profile?.birthTime || "Non renseigné"}
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2 font-medium">
                                    <MapPin className="w-3 h-3" /> Lieu de naissance
                                </label>
                                <div className="p-4 rounded-xl bg-abyss-600/40 border border-white/[0.06] text-stellar-200">
                                    {profile?.birthPlace || "Non renseigné"}
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* ============================================ */}
                {/* SECTION 2: DIAGNOSTIC HOLISTIQUE */}
                {/* ============================================ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <GlassCard className="p-6">
                        <h2 className="text-lg font-playfair italic text-purple-400 mb-6 flex items-center gap-2">
                            <Brain className="w-5 h-5" />
                            Diagnostic Holistique
                            {!profileComplete && (
                                <span className="ml-auto text-xs text-amber-400/80 bg-amber-400/10 px-3 py-1 rounded-full">
                                    En attente du diagnostic
                                </span>
                            )}
                        </h2>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* État Vibratoire */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm text-stellar-400 mb-2">
                                    <Sparkles className="w-4 h-4 text-emerald-400" />
                                    État Vibratoire
                                </div>
                                
                                <div>
                                    <label className="text-xs text-emerald-400 uppercase tracking-wider mb-2 block">
                                        Ce qui vous porte
                                    </label>
                                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-stellar-200 min-h-[80px]">
                                        {profile?.highs || "Non renseigné"}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-rose-400 uppercase tracking-wider mb-2 block">
                                        Ce qui pèse
                                    </label>
                                    <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-stellar-200 min-h-[80px]">
                                        {profile?.lows || "Non renseigné"}
                                    </div>
                                </div>
                            </div>

                            {/* Profil Somatique */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-sm text-stellar-400 mb-2">
                                    <Activity className="w-4 h-4 text-serenity-400" />
                                    Profil Somatique
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-stellar-500 uppercase tracking-wider mb-2 block">
                                            Côté fort
                                        </label>
                                        <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/5 text-stellar-200 text-center">
                                            {profile?.strongSide || "—"}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-stellar-500 uppercase tracking-wider mb-2 block">
                                            Côté faible
                                        </label>
                                        <div className="p-3 rounded-xl bg-abyss-500/30 border border-white/5 text-stellar-200 text-center">
                                            {profile?.weakSide || "—"}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-emerald-400 uppercase tracking-wider mb-2 block">
                                            Zone de force
                                        </label>
                                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-stellar-200 text-center">
                                            {profile?.strongZone || "Non défini"}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-rose-400 uppercase tracking-wider mb-2 block">
                                            Zone fragile
                                        </label>
                                        <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-stellar-200 text-center">
                                            {profile?.weakZone || "Non défini"}
                                        </div>
                                    </div>
                                </div>

                                {profile?.ailments && (
                                    <div>
                                        <label className="text-xs text-amber-400 uppercase tracking-wider mb-2 block">
                                            Maux physiques
                                        </label>
                                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-stellar-200">
                                            {profile.ailments}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Rythme & Style */}
                        <div className="mt-6 pt-6 border-t border-white/5">
                            <div className="flex items-center gap-2 text-sm text-stellar-400 mb-4">
                                <Heart className="w-4 h-4 text-horizon-400" />
                                Préférences de Guidance
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-gradient-to-br from-horizon-400/10 to-transparent border border-horizon-400/20">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{deliveryStyle.icon}</span>
                                        <div>
                                            <div className="text-stellar-200 font-medium">{deliveryStyle.title}</div>
                                            <div className="text-xs text-stellar-500">{deliveryStyle.subtitle}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-abyss-500/30 border border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-stellar-500 uppercase tracking-wider">Rythme</span>
                                        <span className="text-stellar-200 font-medium">{getPaceLabel(profile?.pace)}</span>
                                    </div>
                                    <div className="h-2 bg-abyss-600 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-serenity-400 to-horizon-400 rounded-full transition-all"
                                            style={{ width: `${profile?.pace ?? 50}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* ============================================ */}
                {/* SECTION 3: PHOTOS */}
                {/* ============================================ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <GlassCard className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-playfair italic text-serenity-300 flex items-center gap-2">
                                <Camera className="w-5 h-5" />
                                Photos Uploadées
                            </h2>

                            {isEditingPhotos ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 transition-all text-sm"
                                    >
                                        <X className="w-4 h-4" />
                                        Annuler
                                    </button>
                                    {photosChanged && (
                                        <button
                                            onClick={handleSavePhotos}
                                            disabled={isSaving}
                                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all disabled:opacity-50 text-sm"
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
                                    onClick={() => setIsEditingPhotos(true)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-horizon-400/20 text-horizon-300 border border-horizon-400/30 hover:bg-horizon-400/30 transition-all text-sm"
                                >
                                    <Edit3 className="w-4 h-4" />
                                    Modifier
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Photo de visage */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-3">
                                    <Camera className="w-3 h-3" /> Photo de visage
                                </label>

                                {isEditingPhotos ? (
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
                                    </div>
                                )}
                            </div>

                            {/* Photo de paume */}
                            <div>
                                <label className="flex items-center gap-2 text-xs text-stellar-500 uppercase tracking-wider mb-3">
                                    <Hand className="w-3 h-3" /> Photo de paume
                                </label>

                                {isEditingPhotos ? (
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
                                    </div>
                                )}
                            </div>
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
