"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    onClick?: () => void;
    variant?: "default" | "gold" | "serenity";
    interactive?: boolean;
}

export const GlassCard = ({
    children,
    className,
    hover = false,
    onClick,
    variant = "default",
    interactive = false,
}: GlassCardProps) => {
    const baseStyles = cn(
        "rounded-2xl backdrop-blur-xl transition-all duration-500",
        "bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
        "border border-white/[0.06]",
        "shadow-[0_8px_32px_rgba(4,6,16,0.4),inset_0_1px_0_rgba(255,255,255,0.03)]"
    );

    const variants = {
        default: "",
        gold: "border-horizon-400/20 shadow-[0_8px_32px_rgba(232,168,56,0.08)]",
        serenity: "border-serenity-400/20 shadow-[0_8px_32px_rgba(45,138,160,0.08)]",
    };

    const hoverStyles = (hover || interactive)
        ? cn(
            "cursor-pointer",
            "hover:bg-gradient-to-br hover:from-white/[0.05] hover:to-white/[0.02]",
            "hover:border-horizon-400/20",
            "hover:shadow-[0_12px_40px_rgba(4,6,16,0.5),0_0_30px_rgba(232,168,56,0.08)]",
            "hover:scale-[1.02] active:scale-[0.98]"
        )
        : "";

    return (
        <motion.div
            whileHover={(hover || interactive) ? { scale: 1.02 } : undefined}
            whileTap={(hover || interactive) ? { scale: 0.98 } : undefined}
            onClick={onClick}
            className={cn(baseStyles, variants[variant], hoverStyles, className)}
        >
            {children}
        </motion.div>
    );
};
