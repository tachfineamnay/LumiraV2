"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface StatsCardProps {
    icon: LucideIcon;
    value: number;
    label: string;
    color: "yellow" | "blue" | "green" | "amber" | "white";
}

const colorClasses = {
    yellow: { icon: "text-yellow-400", value: "text-yellow-400", bg: "from-yellow-400/10" },
    blue: { icon: "text-blue-400", value: "text-blue-400", bg: "from-blue-400/10" },
    green: { icon: "text-green-400", value: "text-green-400", bg: "from-green-400/10" },
    amber: { icon: "text-amber-400", value: "text-amber-400", bg: "from-amber-400/10" },
    white: { icon: "text-white", value: "text-white", bg: "from-white/10" },
};

export const StatsCard = ({ icon: Icon, value, label, color }: StatsCardProps) => {
    const colors = colorClasses[color];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            className={cn(
                "glass-desk p-4 rounded-xl",
                `bg-gradient-to-br ${colors.bg} to-transparent`
            )}
        >
            <div className="flex items-center gap-3">
                <Icon className={cn("w-5 h-5", colors.icon)} />
                <div>
                    <p className={cn("text-2xl font-bold", colors.value)}>{value}</p>
                    <p className="text-sm text-slate-400">{label}</p>
                </div>
            </div>
        </motion.div>
    );
};
