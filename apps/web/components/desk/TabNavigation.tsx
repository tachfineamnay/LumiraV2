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
        <div className="flex flex-wrap gap-2">
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
                            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                            isActive
                                ? "bg-amber-400 text-slate-900"
                                : "bg-white/10 text-white hover:bg-white/20"
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm">{tab.label}</span>
                        {tab.count !== undefined && (
                            <span
                                className={cn(
                                    "text-xs px-2 py-0.5 rounded-full",
                                    isActive ? "bg-slate-900/20" : "bg-white/10"
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
