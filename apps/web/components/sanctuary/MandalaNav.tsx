"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { Star, Book, Layers, MessageCircle, User } from "lucide-react";

const SPHERES = [
    { key: "path", label: "Chemin", icon: Star, color: "amber", route: "/sanctuaire/path", progress: 75 },
    { key: "draws", label: "Tirages", icon: Book, color: "emerald", route: "/sanctuaire/draws", progress: 60 },
    { key: "synthesis", label: "Synthèse", icon: Layers, color: "purple", route: "/sanctuaire/synthesis", progress: 30 },
    { key: "chat", label: "Conversations", icon: MessageCircle, color: "blue", route: "/sanctuaire/chat", progress: 90 },
    { key: "profile", label: "Profil", icon: User, color: "gold", route: "/sanctuaire/profile", progress: 100 },
];

const colorMap: Record<string, { bg: string; ring: string; glow: string }> = {
    amber: { bg: "from-amber-500/20 to-amber-600/10", ring: "#f59e0b", glow: "shadow-[0_0_30px_rgba(245,158,11,0.4)]" },
    emerald: { bg: "from-emerald-500/20 to-emerald-600/10", ring: "#10b981", glow: "shadow-[0_0_30px_rgba(16,185,129,0.4)]" },
    purple: { bg: "from-purple-500/20 to-purple-600/10", ring: "#a855f7", glow: "shadow-[0_0_30px_rgba(168,85,247,0.4)]" },
    blue: { bg: "from-blue-500/20 to-blue-600/10", ring: "#3b82f6", glow: "shadow-[0_0_30px_rgba(59,130,246,0.4)]" },
    gold: { bg: "from-amber-400/20 to-yellow-500/10", ring: "#fbbf24", glow: "shadow-[0_0_30px_rgba(251,191,36,0.4)]" },
};

export const MandalaNav = () => {
    const router = useRouter();
    const pathname = usePathname();
    const radius = 160;

    // Calculate pentagon positions (5 points)
    const getPosition = (index: number) => {
        const angle = (index * (360 / 5) - 90) * (Math.PI / 180);
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
        };
    };

    return (
        <div className="relative w-[400px] h-[400px] flex items-center justify-center">
            {/* Central Star */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-cosmic-gold/30 to-amber-600/20 border-2 border-cosmic-gold/50 flex items-center justify-center z-10 animate-glow-pulse"
            >
                <Star className="w-12 h-12 text-cosmic-gold fill-cosmic-gold/30" />
            </motion.div>

            {/* Orbiting Spheres */}
            {SPHERES.map((sphere, index) => {
                const pos = getPosition(index);
                const isActive = pathname?.startsWith(sphere.route);
                const colors = colorMap[sphere.color];
                const Icon = sphere.icon;

                return (
                    <motion.div
                        key={sphere.key}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1, x: pos.x, y: pos.y }}
                        transition={{ delay: 0.3 + index * 0.12, duration: 0.5, ease: "easeOut" }}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => router.push(sphere.route)}
                        className={`absolute w-20 h-20 rounded-full cursor-pointer group ${isActive ? colors.glow : ""}`}
                    >
                        {/* Progress Ring SVG */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            {/* Background ring */}
                            <circle
                                cx="40"
                                cy="40"
                                r="36"
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="3"
                            />
                            {/* Progress ring */}
                            <circle
                                cx="40"
                                cy="40"
                                r="36"
                                fill="none"
                                stroke={colors.ring}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={`${(sphere.progress / 100) * 226} 226`}
                                className="transition-all duration-500"
                            />
                        </svg>

                        {/* Sphere Content */}
                        <div className={`absolute inset-1 rounded-full bg-gradient-to-br ${colors.bg} backdrop-blur-sm border ${isActive ? "border-cosmic-gold" : "border-white/20"} flex flex-col items-center justify-center transition-all duration-300`}>
                            <Icon className={`w-6 h-6 ${isActive ? "text-cosmic-gold" : "text-white/80"} transition-colors`} />
                            <span className="text-[10px] mt-1 text-white/60 font-medium">{sphere.label}</span>
                        </div>

                        {/* Hover Particles */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            {[...Array(5)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-1 h-1 bg-white/60 rounded-full"
                                    style={{
                                        left: `${20 + Math.random() * 60}%`,
                                        bottom: "20%",
                                    }}
                                    animate={{
                                        y: [-10, -40],
                                        opacity: [1, 0],
                                    }}
                                    transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                        ease: "easeOut",
                                    }}
                                />
                            ))}
                        </div>

                        {/* Tooltip */}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                            <span className="text-xs text-cosmic-ethereal bg-cosmic-void/80 px-2 py-1 rounded-md border border-white/10">
                                {sphere.label} • {sphere.progress}%
                            </span>
                        </div>
                    </motion.div>
                );
            })}

            {/* Connecting Lines (optional decorative) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                {SPHERES.map((_, i) => {
                    const pos1 = getPosition(i);
                    const pos2 = getPosition((i + 1) % 5);
                    return (
                        <line
                            key={i}
                            x1={200 + pos1.x}
                            y1={200 + pos1.y}
                            x2={200 + pos2.x}
                            y2={200 + pos2.y}
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="1"
                        />
                    );
                })}
            </svg>
        </div>
    );
};
