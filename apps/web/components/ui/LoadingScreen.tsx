"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface LoadingScreenProps {
    message?: string;
}

export const LoadingScreen = ({ message = "Chargement en cours..." }: LoadingScreenProps) => {
    return (
        <div className="fixed inset-0 bg-cosmic-void z-50 flex flex-col items-center justify-center">
            {/* Rotating Icon */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-2xl bg-cosmic-gold/20 border border-cosmic-gold/30 flex items-center justify-center mb-8"
            >
                <Sparkles className="w-8 h-8 text-cosmic-gold" />
            </motion.div>

            {/* Pulsing Message */}
            <motion.p
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="text-cosmic-ethereal text-sm tracking-widest uppercase"
            >
                {message}
            </motion.p>

            {/* Subtle Stars */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.5, 0] }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            delay: i * 0.2,
                            ease: "easeInOut",
                        }}
                        className="absolute w-1 h-1 bg-white rounded-full"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};
