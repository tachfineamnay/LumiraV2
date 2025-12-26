"use client";

import { motion } from "framer-motion";

export const Mandala = () => {
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center opacity-10 mix-blend-screen">
            <motion.svg
                viewBox="0 0 100 100"
                className="w-[150vmax] h-[150vmax] text-gold"
                animate={{ rotate: 360 }}
                transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
            >
                {/* Simple geometric mandala pattern */}
                <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.2" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.2" />
                <path d="M50 2 L50 98 M2 50 L98 50" stroke="currentColor" strokeWidth="0.2" />
                <path d="M16 16 L84 84 M84 16 L16 84" stroke="currentColor" strokeWidth="0.2" />
                <rect x="25" y="25" width="50" height="50" fill="none" stroke="currentColor" strokeWidth="0.2" transform="rotate(45 50 50)" />
                <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 2" />

                {/* Decorative rays */}
                {[...Array(12)].map((_, i) => (
                    <path
                        key={i}
                        d={`M50 50 L${50 + 45 * Math.cos(i * 30 * Math.PI / 180)} ${50 + 45 * Math.sin(i * 30 * Math.PI / 180)}`}
                        stroke="currentColor"
                        strokeWidth="0.1"
                    />
                ))}
            </motion.svg>
        </div>
    );
};
