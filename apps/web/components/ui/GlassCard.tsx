"use client";

import { cn } from "@/lib/utils";
import React from "react";
import { motion } from "framer-motion";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
    hoverEffect?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
    ({ className, hoverEffect = false, children, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                initial={false}
                whileHover={hoverEffect ? {
                    scale: 1.02,
                    y: -5,
                    rotateX: 2,
                    rotateY: 2,
                    transition: { duration: 0.4, ease: "easeOut" }
                } : {}}
                className={cn(
                    "relative overflow-hidden rounded-2xl p-6 sm:p-8 transition-colors duration-500",
                    "bg-[#0B0B1A]/60 backdrop-blur-2xl border border-white/5",
                    hoverEffect && "hover:border-white/20 hover:bg-[#1A1B3A]/60 hover:shadow-[0_0_50px_-12px_rgba(139,123,216,0.2)] group",
                    className
                )}
                style={{ transformStyle: "preserve-3d", perspective: "1000px" }}
                {...props}
            >
                {/* Obsidian Reflection Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/40 pointer-events-none opacity-50" />

                {/* Chromatic Edge Glow (Visible on Hover) */}
                {hoverEffect && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-[radial-gradient(circle_at_50%_-20%,rgba(255,215,0,0.15),transparent_70%)]" />
                )}

                <div className="relative z-10 translate-z-10 transform-gpu">
                    {children}
                </div>
            </motion.div>
        );
    }
);

GlassCard.displayName = "GlassCard";
