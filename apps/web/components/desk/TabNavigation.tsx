"use client";

import React from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle, History, Users, LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface Tab {
    key: string;
    label: string;
    icon: LucideIcon;
    count?: number;
}

interface TabNavigationProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (key: string) => void;
}

const DEFAULT_TABS: Tab[] = [
    { key: "orders", label: "Commandes", icon: Clock, count: 12 },
    { key: "validation", label: "Validations", icon: CheckCircle, count: 5 },
    { key: "history", label: "Historique", icon: History, count: 245 },
    { key: "clients", label: "Clients", icon: Users, count: 89 },
];

export const TabNavigation = ({
    tabs = DEFAULT_TABS,
    activeTab,
    onTabChange,
}: TabNavigationProps) => {
    return (
        <div className="flex flex-wrap gap-2 p-1.5 bg-abyss-600/30 rounded-xl border border-white/[0.04]">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;

                return (
                    <motion.button
                        key={tab.key}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onTabChange(tab.key)}
                        className={cn(
                            "relative flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-300",
                            isActive
                                ? "bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-900 shadow-gold-glow"
                                : "text-stellar-300 hover:text-stellar-100 hover:bg-white/[0.04]"
                        )}
                    >
                        <Icon className={cn("w-4 h-4", isActive && "drop-shadow-sm")} />
                        <span className="text-sm font-semibold">{tab.label}</span>
                        {tab.count !== undefined && (
                            <span
                                className={cn(
                                    "text-xs px-2 py-0.5 rounded-full font-bold",
                                    isActive 
                                        ? "bg-abyss-900/20 text-abyss-900" 
                                        : "bg-white/[0.06] text-stellar-400"
                                )}
                            >
                                {tab.count}
                            </span>
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
};
