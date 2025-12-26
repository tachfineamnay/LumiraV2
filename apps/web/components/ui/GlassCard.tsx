"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GlassCardProps {
    children: ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

export const GlassCard = ({
    children,
    className = "",
    hoverEffect = true,
}: GlassCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={hoverEffect ? { scale: 1.02 } : {}}
            className={`glass-card ${hoverEffect ? "glass-card-hover" : ""} p-6 relative group overflow-hidden ${className}`}
        >
            {/* Aurora Shadow Background */}
            {hoverEffect && (
                <div className="absolute inset-0 bg-aurora-violet/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            )}

            {/* Dust Particles (Subtle internal animation) */}
            {hoverEffect && (
                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    {[...Array(6)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-1 h-1 bg-white rounded-full"
                            initial={{ x: `${Math.random() * 100}%`, y: "100%", opacity: 0 }}
                            animate={hoverEffect ? {
                                y: "-20%",
                                opacity: [0, 1, 0],
                            } : {}}
                            transition={{
                                duration: 2 + Math.random() * 2,
                                repeat: Infinity,
                                delay: Math.random() * 2,
                                ease: "easeOut"
                            }}
                        />
                    ))}
                </div>
            )}

            <div className="relative z-10">{children}</div>
        </motion.div>
    );
};
