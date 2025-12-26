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
    pending: { color: "text-yellow-400", bg: "bg-yellow-400/10", label: "En attente" },
    processing: { color: "text-blue-400", bg: "bg-blue-400/10", label: "En traitement" },
    validation: { color: "text-amber-400", bg: "bg-amber-400/10", label: "À valider" },
    completed: { color: "text-green-400", bg: "bg-green-400/10", label: "Complété" },
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
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onClick}
            className={cn(
                "glass-desk p-4 rounded-xl cursor-pointer transition-all duration-200",
                selected
                    ? "border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.2)]"
                    : "border border-white/10 hover:border-white/20"
            )}
        >
            <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-sm text-white font-bold">{orderNumber}</span>
                <span className={cn("text-xs px-2 py-1 rounded-full", statusInfo.bg, statusInfo.color)}>
                    {statusInfo.label}
                </span>
            </div>

            <div className="space-y-2">
                <p className="text-sm text-white">{customerName}</p>
                <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{levelName}</span>
                    <span>{date}</span>
                </div>
            </div>
        </motion.div>
    );
};
