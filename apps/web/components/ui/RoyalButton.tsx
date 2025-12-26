"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface RoyalButtonProps {
    label: string;
    onClick?: () => void;
    icon?: LucideIcon;
    variant?: "primary" | "secondary";
    className?: string;
    showShimmer?: boolean;
}

export const RoyalButton = ({
    label,
    onClick,
    icon: Icon,
    variant = "primary",
    className = "",
    showShimmer = true,
}: RoyalButtonProps) => {
    if (variant === "secondary") {
        return (
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClick}
                className={`relative px-8 py-3 rounded-full border border-gold/40 text-gold-light font-medium bg-transparent overflow-hidden group transition-all duration-300 hover:border-gold/60 ${className}`}
            >
                <span className="relative z-10 flex items-center justify-center gap-2">
                    {label}
                    {Icon && <Icon className="w-4 h-4" />}
                </span>
                <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.button>
        );
    }

    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            className={`relative btn-royal group ${className}`}
        >
            <span className="relative z-10 flex items-center justify-center gap-3">
                {Icon && <Icon className="w-5 h-5" />}
                {label}
                {Icon && <Icon className="w-5 h-5 transform rotate-180" />}
            </span>

            {/* Halo Aura */}
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 blur-2xl bg-gold/30 transition-opacity duration-500 -z-10" />

            {/* Subtle Shine */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
        </motion.button>
    );
};
