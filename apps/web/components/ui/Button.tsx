"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "gold" | "stardust";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", isLoading, children, ...props }, ref) => {
        // 2026 Styles
        const baseStyles = "relative inline-flex items-center justify-center rounded-lg font-medium tracking-wide transition-all duration-300 focus:outline-none focus:ring-1 focus:ring-gold/30 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group";

        const variants = {
            primary: "bg-deep text-divine border border-white/10 hover:bg-white/5 hover:border-gold/30 shadow-[0_0_20px_-5px_rgba(0,0,0,0.3)] hover:shadow-gold/20",
            secondary: "bg-white/5 text-ethereal hover:bg-white/10 border border-white/5 hover:border-white/20 backdrop-blur-sm",
            ghost: "bg-transparent text-ethereal hover:text-gold hover:bg-white/5",
            gold: "bg-gold-gradient text-[#0B0B1A] font-bold shadow-gold-glow hover:shadow-[0_0_80px_-10px_rgba(255,215,0,0.6)] border border-transparent hover:scale-105",
            stardust: "bg-transparent text-gold border border-gold/30 hover:bg-gold/5 shadow-[0_0_30px_-5px_rgba(255,215,0,0.1)] hover:shadow-gold-glow/50",
        };

        const sizes = {
            sm: "h-9 px-4 text-xs uppercase tracking-widest",
            md: "h-12 px-8 text-sm uppercase tracking-[0.2em]",
            lg: "h-16 px-10 text-base uppercase tracking-[0.25em]",
        };

        return (
            <motion.button
                ref={ref}
                whileTap={{ scale: 0.98 }}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {/* Shimmer Effect for Gold/Stardust */}
                {(variant === "gold" || variant === "stardust") && (
                    <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent z-10" />
                )}

                {/* Inner Glow */}
                <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-transparent via-transparent to-white/5 pointer-events-none" />

                <span className="relative z-20 flex items-center gap-2">
                    {isLoading ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : null}
                    {children}
                </span>
            </motion.button>
        );
    }
);

Button.displayName = "Button";
