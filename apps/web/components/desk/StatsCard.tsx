"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface StatsCardProps {
    icon: LucideIcon;
    value: number;
    label: string;
    color: "horizon" | "serenity" | "emerald" | "violet" | "stellar";
}

const colorClasses = {
    horizon: { 
        icon: "text-horizon-400", 
        value: "text-horizon-400", 
        bg: "from-horizon-400/10",
        glow: "hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]"
    },
    serenity: { 
        icon: "text-serenity-400", 
        value: "text-serenity-400", 
        bg: "from-serenity-400/10",
        glow: "hover:shadow-[0_0_20px_rgba(74,222,128,0.15)]"
    },
    emerald: { 
        icon: "text-emerald-400", 
        value: "text-emerald-400", 
        bg: "from-emerald-400/10",
        glow: "hover:shadow-[0_0_20px_rgba(52,211,153,0.15)]"
    },
    violet: { 
        icon: "text-violet-400", 
        value: "text-violet-400", 
        bg: "from-violet-400/10",
        glow: "hover:shadow-[0_0_20px_rgba(167,139,250,0.15)]"
    },
    stellar: { 
        icon: "text-stellar-300", 
        value: "text-stellar-100", 
        bg: "from-white/5",
        glow: "hover:shadow-[0_0_20px_rgba(255,255,255,0.08)]"
    },
};

export const StatsCard = ({ icon: Icon, value, label, color }: StatsCardProps) => {
    const colors = colorClasses[color];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={cn(
                "glass-desk p-5 rounded-xl transition-all duration-300",
                `bg-gradient-to-br ${colors.bg} to-transparent`,
                colors.glow
            )}
        >
            <div className="flex items-center gap-4">
                <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    "bg-white/[0.03] border border-white/[0.06]"
                )}>
                    <Icon className={cn("w-5 h-5", colors.icon)} />
                </div>
                <div>
                    <p className={cn("text-2xl font-bold tracking-tight", colors.value)}>{value}</p>
                    <p className="text-sm text-stellar-400">{label}</p>
                </div>
            </div>
        </motion.div>
    );
};
