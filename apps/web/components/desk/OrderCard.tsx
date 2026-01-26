"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface OrderCardProps {
    orderNumber: string;
    customerName: string;
    status: "pending" | "processing" | "validation" | "completed";
    date: string;
    levelName: string;
    selected?: boolean;
    onClick: () => void;
}

const statusConfig = {
    pending: { color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", label: "En attente" },
    processing: { color: "text-serenity-300", bg: "bg-serenity-400/10", border: "border-serenity-400/20", label: "En traitement" },
    validation: { color: "text-horizon-400", bg: "bg-horizon-400/10", border: "border-horizon-400/20", label: "À valider" },
    completed: { color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", label: "Complété" },
};

export const OrderCard = ({
    orderNumber,
    customerName,
    status,
    date,
    levelName,
    selected = false,
    onClick,
}: OrderCardProps) => {
    const statusInfo = statusConfig[status];

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={cn(
                "glass-desk p-5 rounded-xl cursor-pointer transition-all duration-300",
                selected
                    ? "border-2 border-horizon-400 shadow-[0_0_30px_rgba(232,168,56,0.2)] bg-gradient-to-br from-horizon-400/5 to-transparent"
                    : "border border-white/[0.08] hover:border-white/20"
            )}
        >
            <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-sm text-stellar-100 font-bold tracking-wide">{orderNumber}</span>
                <span className={cn("text-xs px-3 py-1 rounded-full font-medium", statusInfo.bg, statusInfo.color, statusInfo.border, "border")}>
                    {statusInfo.label}
                </span>
            </div>

            <div className="space-y-3">
                <p className="text-sm text-stellar-200 font-medium">{customerName}</p>
                <div className="flex items-center justify-between text-xs text-stellar-400">
                    <span className="px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">{levelName}</span>
                    <span>{date}</span>
                </div>
            </div>
        </motion.div>
    );
};
