"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Star, Book, Layers, MessageCircle, User, LucideIcon } from "lucide-react";
import { useState } from "react";

interface SphereProps {
    label: string;
    icon: LucideIcon;
    color: string;
    progress: number;
    active: boolean;
    onHover: (active: boolean) => void;
    index: number;
}

const Sphere = ({ label, icon: Icon, color, progress, active, onHover, index }: SphereProps) => {
    // Angle for pentagon distribution: (index * 72) - 90 to start from top
    const angle = (index * 72 - 90) * (Math.PI / 180);
    const radius = 140; // Desktop radius

    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1, x, y }}
            transition={{
                delay: 0.5 + index * 0.1,
                type: "spring",
                stiffness: 100,
                damping: 15
            }}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            className="absolute cursor-pointer group"
        >
            <div className="relative flex items-center justify-center">
                {/* Progress Ring */}
                <svg className="absolute w-24 h-24 -rotate-90">
                    <circle
                        cx="48"
                        cy="48"
                        r="44"
                        fill="none"
                        stroke="white"
                        strokeOpacity="0.05"
                        strokeWidth="2"
                    />
                    <motion.circle
                        cx="48"
                        cy="48"
                        r="44"
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeDasharray="276"
                        initial={{ strokeDashoffset: 276 }}
                        animate={{ strokeDashoffset: 276 - (276 * progress) / 100 }}
                        transition={{ duration: 1.5, delay: 1 + index * 0.1 }}
                        strokeLinecap="round"
                    />
                </svg>

                {/* Sphere Core */}
                <motion.div
                    whileHover={{ scale: 1.1 }}
                    className={`w-16 h-16 rounded-full flex items-center justify-center relative z-10 transition-all duration-500 shadow-lg ${active ? "ring-2 ring-gold shadow-gold-glow" : ""
                        }`}
                    style={{
                        background: `radial-gradient(circle at 30% 30%, ${color} 0%, #000 100%)`,
                        boxShadow: active ? `0 0 30px ${color}88` : `0 0 10px ${color}44`
                    }}
                >
                    <Icon className="w-8 h-8 text-white" />

                    {/* Active Glow */}
                    {active && (
                        <motion.div
                            layoutId="sphere-glow"
                            className="absolute inset-0 rounded-full bg-white opacity-20 blur-md"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        />
                    )}
                </motion.div>

                {/* Tooltip / Label */}
                <AnimatePresence>
                    {active && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-20 bg-void-deep/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-lg whitespace-nowrap z-50 pointer-events-none"
                        >
                            <span className="text-xs font-bold text-divine tracking-widest uppercase">{label}</span>
                            <div className="text-[10px] text-gold/60 mt-1">{progress}% complété</div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export const MandalaNav = () => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const spheres = [
        { label: "Chemin Spirituel", icon: Star, color: "#fbbf24", progress: 85 },
        { label: "Tirages & Lectures", icon: Book, color: "#10b981", progress: 40 },
        { label: "Synthèse", icon: Layers, color: "#8b5cf6", progress: 60 },
        { label: "Conversations", icon: MessageCircle, color: "#06b6d4", progress: 25 },
        { label: "Profil", icon: User, color: "#fdba74", progress: 100 },
    ];

    return (
        <div className="relative w-[500px] h-[500px] flex items-center justify-center">
            {/* Central Star */}
            <motion.div
                animate={{
                    rotate: 360,
                    scale: [1, 1.05, 1]
                }}
                transition={{
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }}
                className="w-32 h-32 rounded-full bg-gold-gradient flex items-center justify-center shadow-gold-glow z-20 cursor-pointer"
                onClick={() => setHoveredIndex(null)}
            >
                <Star className="w-12 h-12 text-void fill-void" />
                <div className="absolute inset-0 rounded-full border-4 border-gold/20 animate-ping" />
            </motion.div>

            {/* Orbiting Particles */}
            {[...Array(12)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-gold rounded-full"
                    animate={{
                        rotate: 360,
                    }}
                    transition={{
                        duration: 10 + i * 2,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                    style={{
                        originX: "50%",
                        originY: "50%",
                        top: "50%",
                        left: "50%",
                        transform: `rotate(${i * 30}deg) translateX(180px)`,
                    }}
                />
            ))}

            {/* Spheres */}
            <div className="absolute inset-0 flex items-center justify-center">
                {spheres.map((sphere, i) => (
                    <Sphere
                        key={sphere.label}
                        {...sphere}
                        index={i}
                        active={hoveredIndex === i}
                        onHover={(active) => setHoveredIndex(active ? i : null)}
                    />
                ))}
            </div>
        </div>
    );
};
