"use client";

import React from "react";
import { motion } from "framer-motion";
import { Book, Download, Calendar, Eye } from "lucide-react";
import { GlassCard } from "../../../components/ui/GlassCard";

// Mock data
const LECTURES = [
    {
        id: "1",
        title: "Lecture Spirituelle Intégrale",
        type: "Chemin de Vie",
        date: "22 Déc 2024",
        status: "completed",
        hasAudio: true,
        hasPdf: true,
    },
    {
        id: "2",
        title: "Tirage des Énergies",
        type: "Tirage Quotidien",
        date: "20 Déc 2024",
        status: "completed",
        hasAudio: false,
        hasPdf: true,
    },
    {
        id: "3",
        title: "Message de Guidance",
        type: "Oracle Personnel",
        date: "18 Déc 2024",
        status: "new",
        hasAudio: true,
        hasPdf: true,
    },
];

export default function DrawsPage() {
    return (
        <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="mb-8">
                <h1 className="text-3xl font-playfair italic text-cosmic-divine mb-2">
                    Mes Lectures & Tirages
                </h1>
                <p className="text-cosmic-ethereal/60 text-sm">
                    Vos messages stellaires et analyses vibratoires
                </p>
            </div>

            {/* Vertical Layout - NOT GRID */}
            <div className="flex flex-col gap-6">
                {LECTURES.map((lecture, i) => (
                    <motion.div
                        key={lecture.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <GlassCard className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Left: Info */}
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-cosmic-gold/10 flex items-center justify-center">
                                    <Book className="w-6 h-6 text-cosmic-gold" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-playfair italic text-lg text-cosmic-divine">
                                            {lecture.title}
                                        </h3>
                                        {lecture.status === "new" && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-400 font-bold uppercase">
                                                Nouveau
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-cosmic-ethereal/50">{lecture.type}</p>
                                    <div className="flex items-center gap-2 mt-2 text-xs text-cosmic-stardust">
                                        <Calendar className="w-3 h-3" />
                                        {lecture.date}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-3">
                                {lecture.hasPdf && (
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cosmic-gold/10 border border-cosmic-gold/30 text-cosmic-gold text-sm font-medium hover:bg-cosmic-gold/20 transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        PDF
                                    </motion.button>
                                )}
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-cosmic-divine text-sm font-medium hover:bg-white/10 transition-colors"
                                >
                                    <Eye className="w-4 h-4" />
                                    Consulter
                                </motion.button>
                            </div>
                        </GlassCard>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
