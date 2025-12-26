"use client";

import React from "react";
import { cn } from "../../lib/utils";

interface LevelBadgeProps {
    level: 1 | 2 | 3 | 4;
    showName?: boolean;
    className?: string;
}

const LEVELS = {
    1: { name: "Initié", emoji: "✨", gradient: "from-blue-600/20", border: "border-blue-400/30", text: "text-blue-400" },
    2: { name: "Mystique", emoji: "🔮", gradient: "from-purple-600/20", border: "border-purple-400/30", text: "text-purple-400" },
    3: { name: "Profond", emoji: "🌟", gradient: "from-amber-600/20", border: "border-amber-400/30", text: "text-amber-400" },
    4: { name: "Intégral", emoji: "👑", gradient: "from-emerald-600/20", border: "border-emerald-400/30", text: "text-emerald-400" },
};

export const LevelBadge = ({
    level,
    showName = true,
    className,
}: LevelBadgeProps) => {
    const config = LEVELS[level];

    return (
        <div
            className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md",
                `bg-gradient-to-r ${config.gradient} to-transparent`,
                config.border,
                "border",
                className
            )}
        >
            <span className="text-sm">{config.emoji}</span>
            {showName && (
                <span className={cn("text-xs font-bold uppercase tracking-widest", config.text)}>
                    {config.name}
                </span>
            )}
        </div>
    );
};
