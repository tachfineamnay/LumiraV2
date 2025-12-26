"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    onClick?: () => void;
    variant?: "default" | "gold";
}

export const GlassCard = ({
    children,
    className,
    hover = true,
    onClick,
    variant = "default",
}: GlassCardProps) => {
    const baseStyles = "rounded-2xl backdrop-blur-sm transition-all duration-500";

    const variants = {
        default: "bg-gradient-to-br from-purple-400/10 to-blue-400/10 border border-purple-400/30",
        gold: "bg-gradient-to-br from-amber-400/10 to-yellow-500/10 border border-amber-400/30",
    };

    const hoverStyles = hover
        ? "hover:scale-[1.02] hover:shadow-aurora cursor-pointer"
        : "";

    return (
        <motion.div
            whileHover={hover ? { scale: 1.02 } : undefined}
            whileTap={hover ? { scale: 0.98 } : undefined}
            onClick={onClick}
            className={cn(baseStyles, variants[variant], hoverStyles, "p-6", className)}
        >
            {children}
        </motion.div>
    );
};
