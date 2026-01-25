"use client";

export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import { motion } from "framer-motion";
import { User, MapPin, Calendar, Mail, Phone, Save, Loader2, Edit3, X } from "lucide-react";
import { useAuth } from "../../../../context/AuthContext";
import { GlassCard } from "../../../../components/ui/GlassCard";
import { SmartPhotoUploader } from "../../../../components/onboarding/SmartPhotoUploader";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";

// Schema for General Profile
const generalSchema = z.object({
    firstName: z.string().min(2, "Prénom trop court"),
    lastName: z.string().min(2, "Nom trop court"),
    phone: z.string().optional(),
    birthDate: z.string().min(1, "Date requise"),
    birthTime: z.string().optional(),
    birthPlace: z.string().min(2, "Lieu requis").optional(),
});

type GeneralFormData = z.infer<typeof generalSchema>;

export default function GeneralSettingsPage() {
    const { user, updateUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Initial photos state
    const [photos, setPhotos] = useState({
        face: user?.profile?.facePhotoUrl || null,
        palm: user?.profile?.palmPhotoUrl || null
    });

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm<GeneralFormData>({
        resolver: zodResolver(generalSchema),
        defaultValues: {
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            phone: user?.phone || "",
            birthDate: user?.profile?.birthDate?.split('T')[0] || "",
            birthTime: user?.profile?.birthTime || "",
            birthPlace: user?.profile?.birthPlace || "",
        }
    });

    const onSubmit = async (data: GeneralFormData) => {
        setIsSaving(true);
        try {
            // Simulator API update
            // await axios.patch("/api/users/profile", { ...data, ...photos });
            console.log("Saving:", data, photos);

            // Mock update functionality until backend ready
            if (updateUser) {
                // updateUser({ ...user, ...data });
            }

            setIsEditing(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* HERDER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-playfair italic text-white">Mon Dossier</h2>
                    <p className="text-stellar-400 text-sm">Vos informations civiles et célestes.</p>
                </div>
                <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`px-4 py-2 rounded-xl border text-sm flex items-center gap-2 transition-all ${isEditing
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                            : "bg-white/5 border-white/10 text-stellar-200 hover:bg-white/10"
                        }`}
                >
                    {isEditing ? <><X className="w-4 h-4" /> Annuler</> : <><Edit3 className="w-4 h-4" /> Modifier</>}
                </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* PHOTO & IDENTITY */}
                <GlassCard className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Avatar Section */}
                        <div className="w-full md:w-1/3 space-y-4">
                            <h3 className="text-xs uppercase tracking-wider text-stellar-500 font-semibold mb-4">Identité Visuelle</h3>
                            <div className="relative group">
                                {/* Placeholder or Face Photo */}
                                <div className="aspect-square rounded-2xl overflow-hidden bg-abyss-900/50 border border-white/10 relative">
                                    {photos.face ? (
                                        <img src={photos.face} alt="Face" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-stellar-600">
                                            <User className="w-12 h-12 opacity-50" />
                                        </div>
                                    )}
                                    {isEditing && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-xs text-white">Modifier (Indisponible en démo)</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Civil Fields */}
                        <div className="w-full md:w-2/3 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-full">
                                <h3 className="text-xs uppercase tracking-wider text-stellar-500 font-semibold mb-4 border-b border-white/5 pb-2">État Civil</h3>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-stellar-400">Prénom</label>
                                <input
                                    {...register("firstName")}
                                    disabled={!isEditing}
                                    className="w-full bg-abyss-900/50 border border-white/10 rounded-xl px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed focus:border-horizon-400 outline-none transition-colors"
                                />
                                {errors.firstName && <span className="text-rose-400 text-xs">{errors.firstName.message}</span>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-stellar-400">Nom</label>
                                <input
                                    {...register("lastName")}
                                    disabled={!isEditing}
                                    className="w-full bg-abyss-900/50 border border-white/10 rounded-xl px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed focus:border-horizon-400 outline-none transition-colors"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-stellar-400">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-stellar-600" />
                                    <input
                                        value={user?.email || ""}
                                        disabled
                                        className="w-full bg-abyss-900/30 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-stellar-500 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-stellar-400">Téléphone</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-3.5 w-4 h-4 text-stellar-600" />
                                    <input
                                        {...register("phone")}
                                        disabled={!isEditing}
                                        className="w-full bg-abyss-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 disabled:opacity-50 focus:border-horizon-400 outline-none transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* CELESTIAL ANCHOR */}
                <GlassCard className="p-6 md:p-8">
                    <div className="mb-6 border-b border-white/5 pb-2">
                        <h3 className="text-xs uppercase tracking-wider text-stellar-500 font-semibold flex items-center gap-2">
                            <span className="text-horizon-400">✦</span> Ancrage Céleste
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs text-stellar-400">Date de Naissance</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-3.5 w-4 h-4 text-stellar-600" />
                                <input
                                    type="date"
                                    {...register("birthDate")}
                                    disabled={!isEditing}
                                    className="w-full bg-abyss-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 disabled:opacity-50 focus:border-horizon-400 outline-none transition-colors"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-stellar-400">Heure de Naissance</label>
                            <input
                                type="time"
                                {...register("birthTime")}
                                disabled={!isEditing}
                                className="w-full bg-abyss-900/50 border border-white/10 rounded-xl px-4 py-3 disabled:opacity-50 focus:border-horizon-400 outline-none transition-colors"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-stellar-400">Lieu de Naissance</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-stellar-600" />
                                <input
                                    {...register("birthPlace")}
                                    disabled={!isEditing}
                                    placeholder="Ville, Pays"
                                    className="w-full bg-abyss-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 disabled:opacity-50 focus:border-horizon-400 outline-none transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </GlassCard>

                {/* SAVE BUTTON */}
                {isEditing && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                    >
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-horizon-400 text-abyss-900 px-8 py-3 rounded-xl font-bold hover:shadow-gold-glow transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Enregistrer les modifications
                        </button>
                    </motion.div>
                )}

            </form>
        </div>
    );
}
