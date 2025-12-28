"use client";

import React from "react";
import { motion } from "framer-motion";
import { User, Mail, Calendar, MapPin, Star, Moon, Sun, Award } from "lucide-react";
import { GlassCard } from "../../../components/ui/GlassCard";
import { LevelBadge } from "../../../components/ui/LevelBadge";

export default function ProfilePage() {
    // Mock user data
    const user = {
        name: "Sophie L.",
        email: "sophie.l@example.com",
        level: 1,
        joinDate: "Décembre 2024",
        zodiacSign: "Verseau",
        ascendant: "Gémeaux",
        moonSign: "Scorpion",
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-12 min-h-screen">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12 text-center"
            >
                <h1 className="text-4xl md:text-5xl font-playfair italic text-white mb-4">
                    Mon Profil Spirituel
                </h1>
                <p className="text-cosmic-ethereal/60 uppercase tracking-widest text-sm">
                    Votre identité dans le cosmos
                </p>
            </motion.div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
                {/* 🧙‍♂️ Main Identity Card */}
                <motion.div variants={itemVariants} className="md:col-span-1">
                    <GlassCard className="h-full flex flex-col items-center text-center p-8 border-white/10 bg-gradient-to-b from-white/5 to-transparent">
                        <div className="relative mb-6 group">
                            <div className="absolute inset-0 bg-cosmic-gold/20 rounded-full blur-xl group-hover:blur-2xl transition-all duration-500" />
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-amber-800/40 to-black border-2 border-cosmic-gold/50 flex items-center justify-center relative z-10 overflow-hidden">
                                <User className="w-16 h-16 text-cosmic-gold/80" />
                            </div>
                            <div className="absolute bottom-0 right-0 z-20">
                                <LevelBadge level={user.level as 1} />
                            </div>
                        </div>

                        <h2 className="text-2xl font-playfair text-white mb-1">{user.name}</h2>
                        <p className="text-sm text-white/50 mb-6 flex items-center gap-2 justify-center">
                            <Mail className="w-3 h-3" /> {user.email}
                        </p>

                        <div className="w-full h-px bg-white/10 mb-6" />

                        <div className="flex flex-col gap-3 w-full text-left">
                            <div className="flex items-center gap-3 text-sm text-cosmic-ethereal/80 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                <Calendar className="w-4 h-4 text-cosmic-gold" />
                                <span>Membre depuis {user.joinDate}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-cosmic-ethereal/80 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                <Award className="w-4 h-4 text-emerald-400" />
                                <span>Statut: Initié</span>
                            </div>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* 🌌 Astral Chart Card */}
                <motion.div variants={itemVariants} className="md:col-span-2">
                    <GlassCard className="h-full p-8 border-white/10 relative overflow-hidden">
                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-900/10 rounded-full blur-[80px]" />

                        <h3 className="text-2xl font-playfair italic text-indigo-200 mb-8 flex items-center gap-3">
                            <Star className="w-6 h-6 text-indigo-400" />
                            Thème Astral Simplifié
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {/* Sun Sign */}
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-900/20 to-transparent border border-amber-500/20 text-center hover:scale-105 transition-transform duration-300">
                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
                                    <Sun className="w-6 h-6 text-amber-300" />
                                </div>
                                <div className="text-xs uppercase tracking-widest text-amber-500/60 mb-1">Signe Solaire</div>
                                <div className="text-xl font-playfair text-amber-100">{user.zodiacSign}</div>
                            </div>

                            {/* Ascendant */}
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/20 to-transparent border border-purple-500/20 text-center hover:scale-105 transition-transform duration-300">
                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
                                    <MapPin className="w-6 h-6 text-purple-300" />
                                </div>
                                <div className="text-xs uppercase tracking-widest text-purple-500/60 mb-1">Ascendant</div>
                                <div className="text-xl font-playfair text-purple-100">{user.ascendant}</div>
                            </div>

                            {/* Moon Sign */}
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900/20 to-transparent border border-indigo-500/20 text-center hover:scale-105 transition-transform duration-300">
                                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
                                    <Moon className="w-6 h-6 text-indigo-300" />
                                </div>
                                <div className="text-xs uppercase tracking-widest text-indigo-500/60 mb-1">Signe Lunaire</div>
                                <div className="text-xl font-playfair text-indigo-100">{user.moonSign}</div>
                            </div>
                        </div>

                        <div className="mt-8 p-6 rounded-xl bg-white/5 border border-white/5">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-3">Votre prochaine étape</h4>
                            <p className="text-cosmic-ethereal/80 leading-relaxed italic">
                                "Le chemin des étoiles s'ouvre à vous. Votre signe solaire en {user.zodiacSign} indique une période propice à l'introspection..."
                            </p>
                        </div>
                    </GlassCard>
                </motion.div>
            </motion.div>
        </div>
    );
}
