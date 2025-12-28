"use client";

import React from "react";
import { motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface LockedCardAction {
    label: string;
    productId: string;
    comingSoon?: boolean;
}

interface LockedCardProps {
    level: "Initié" | "Mystique" | "Profond" | "Intégral";
    title: string;
    message: string;
    /** Optional action with upgrade navigation */
    action?: LockedCardAction;
    /** Legacy callback for custom unlock behavior */
    onUnlock?: () => void;
}

export const LockedCard = ({
    level,
    title,
    message,
    action,
    onUnlock,
}: LockedCardProps) => {
    const router = useRouter();

    const handleUnlock = () => {
        if (action?.comingSoon) {
            return; // Do nothing for coming soon
        }
        if (action?.productId) {
            router.push(`/commande?product=${action.productId}`);
        } else if (onUnlock) {
            onUnlock();
        }
    };

    const isComingSoon = action?.comingSoon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden h-full min-h-[220px]"
        >
            {/* Blurred Background Placeholder */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-blue-400/10 border border-purple-400/30 rounded-2xl" />

            {/* Lock Overlay */}
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center rounded-2xl">
                {/* Lock Icon with Glow */}
                <div className="relative mb-4">
                    <div className="absolute inset-0 bg-cosmic-gold/20 blur-xl rounded-full" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-cosmic-gold/20 to-amber-900/20 border border-cosmic-gold/30 flex items-center justify-center">
                        <Lock className="w-7 h-7 text-cosmic-gold/80" />
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-playfair italic text-cosmic-divine mb-2">{title}</h3>

                {/* Message */}
                <p className="text-sm text-cosmic-ethereal/60 mb-3 max-w-xs leading-relaxed">{message}</p>

                {/* Required Level Badge */}
                <div className="flex items-center gap-2 mb-5">
                    <Sparkles className="w-3 h-3 text-amber-400/60" />
                    <span className="text-xs text-amber-400/70 font-medium tracking-wide">
                        Requiert niveau {level}
                    </span>
                    <Sparkles className="w-3 h-3 text-amber-400/60" />
                </div>

                {/* CTA Button */}
                <motion.button
                    whileHover={!isComingSoon ? { scale: 1.05 } : {}}
                    whileTap={!isComingSoon ? { scale: 0.95 } : {}}
                    onClick={handleUnlock}
                    disabled={isComingSoon}
                    className={`
                        px-6 py-3 rounded-xl font-medium transition-all
                        ${isComingSoon
                            ? 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'
                            : 'bg-gradient-to-r from-amber-500/20 to-amber-700/20 border border-amber-400/50 text-amber-300 hover:from-amber-500/30 hover:to-amber-700/30 hover:border-amber-400/70 shadow-lg shadow-amber-900/20'
                        }
                    `}
                >
                    {action?.label || `Débloquer niveau ${level}`}
                </motion.button>

                {isComingSoon && (
                    <p className="text-[10px] text-white/30 mt-2 uppercase tracking-widest">
                        Disponible prochainement
                    </p>
                )}
            </div>
        </motion.div>
    );
};
