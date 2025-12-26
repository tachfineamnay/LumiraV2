"use client";

import React from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

interface LockedCardProps {
    level: "Initié" | "Mystique" | "Profond" | "Intégral";
    title: string;
    message: string;
    onUnlock: () => void;
}

export const LockedCard = ({
    level,
    title,
    message,
    onUnlock,
}: LockedCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden"
        >
            {/* Blurred Background Placeholder */}
            <div className="h-48 bg-gradient-to-br from-purple-400/10 to-blue-400/10 border border-purple-400/30" />

            {/* Lock Overlay */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <Lock className="w-12 h-12 text-white/40 mb-4" />
                <h3 className="text-lg font-playfair italic text-cosmic-divine mb-2">{title}</h3>
                <p className="text-sm text-cosmic-ethereal/60 mb-4 max-w-xs">{message}</p>
                <p className="text-xs text-amber-400/60 mb-4">Requis : Niveau {level}</p>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onUnlock}
                    className="px-6 py-3 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-400 font-medium hover:bg-amber-400/30 transition-all"
                >
                    Débloquer l'accès
                </motion.button>
            </div>
        </motion.div>
    );
};
