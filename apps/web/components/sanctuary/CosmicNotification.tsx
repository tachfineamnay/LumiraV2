"use client";

import React from "react";
import { motion } from "framer-motion";
import { Clock, Sparkles } from "lucide-react";

interface CosmicNotificationProps {
    type?: "success" | "info" | "warning";
    title: string;
    message: string;
    delay?: string;
    status?: string;
    actionLabel?: string;
    secondaryActionLabel?: string;
    onAction?: () => void;
    onSecondaryAction?: () => void;
}

export const CosmicNotification: React.FC<CosmicNotificationProps> = ({
    type = "success",
    title,
    message,
    delay,
    status,
    actionLabel,
    secondaryActionLabel,
    onAction,
    onSecondaryAction,
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto"
        >
            <div className="relative group overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 backdrop-blur-xl shadow-[0_0_40px_rgba(16,185,129,0.15)]">
                {/* 🌟 Animated Background Sheen */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent pointer-events-none translate-x-[-100%] animate-shimmer" />

                <div className="relative p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">

                    {/* Icon Container with Pulse */}
                    <div className="relative flex-shrink-0">
                        <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse-slow" />
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50 shadow-inner">
                            {type === 'success' ? (
                                <Clock className="w-8 h-8 text-emerald-400" />
                            ) : (
                                <Sparkles className="w-8 h-8 text-emerald-400" />
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-grow space-y-3">
                        <div>
                            <h3 className="text-xl font-playfair italic text-emerald-300 flex items-center justify-center md:justify-start gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-400" />
                                {title}
                            </h3>
                            <p className="text-emerald-100/80 text-sm leading-relaxed mt-1">
                                {message}
                            </p>
                        </div>

                        {/* Metadata Row */}
                        {(delay || status) && (
                            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-xs font-bold uppercase tracking-wider text-emerald-400/70">
                                {delay && (
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Délai : {delay}</span>
                                    </div>
                                )}
                                {status && (
                                    <div className="flex items-center gap-1.5">
                                        <Star className="w-3.5 h-3.5" />
                                        <span>{status}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                            {actionLabel && (
                                <button
                                    onClick={onAction}
                                    className="px-5 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-sm font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                >
                                    {actionLabel}
                                </button>
                            )}
                            {secondaryActionLabel && (
                                <button
                                    onClick={onSecondaryAction}
                                    className="px-5 py-2 rounded-lg hover:bg-white/5 border border-white/10 text-emerald-200/60 hover:text-emerald-200 text-sm font-bold uppercase tracking-widest transition-colors"
                                >
                                    {secondaryActionLabel}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes shimmer {
                    100% { transform: translateX(100%); }
                }
                .animate-shimmer {
                    animation: shimmer 3s infinite;
                }
            `}</style>
        </motion.div>
    );
};

// StartIcon helper
function Star({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
    )
}
