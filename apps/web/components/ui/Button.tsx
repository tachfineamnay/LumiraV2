"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "gold";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", isLoading, children, ...props }, ref) => {
        const baseStyles = "relative inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden";

        const variants = {
            primary: "bg-deep text-divine border border-white/10 hover:bg-white/5 hover:border-gold/30 shadow-lg hover:shadow-gold/20",
            secondary: "bg-white/5 text-ethereal hover:bg-white/10 border border-transparent hover:border-white/20",
            ghost: "bg-transparent text-ethereal hover:text-gold hover:bg-white/5",
            gold: "bg-gold-gradient text-deep font-bold shadow-gold-glow hover:shadow-[0_0_60px_rgba(255,215,0,0.6)] border border-gold/50",
        };

        const sizes = {
            sm: "h-9 px-4 text-sm",
            md: "h-11 px-6 text-base",
            lg: "h-14 px-8 text-lg",
        };

        return (
            <motion.button
                ref={ref}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={isLoading || props.disabled}
                {...props}
            >
                {variant === "gold" && (
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent z-10" />
                )}
                <span className="relative z-20 flex items-center gap-2">
                    {isLoading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : null}
                    {children}
                </span>
            </motion.button>
        );
    }
);

Button.displayName = "Button";
