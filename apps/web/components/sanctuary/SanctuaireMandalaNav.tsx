"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, User, Compass, BookOpen, MessageCircle, Layers } from "lucide-react";

// =============================================================================
// NAVIGATION ITEMS CONFIGURATION
// =============================================================================

interface NavItem {
    key: string;
    label: string;
    sublabel?: string;
    icon: React.ComponentType<{ className?: string }>;
    route: string;
    angle: number; // Position around the mandala (degrees, 0 = top)
}

const navItems: NavItem[] = [
    { key: "chemin", label: "Chemin", sublabel: "spirituel", icon: Compass, route: "/sanctuaire/path", angle: 0 },
    { key: "tirages", label: "Tirages", sublabel: "bruts", icon: BookOpen, route: "/sanctuaire/draws", angle: 72 },
    { key: "profil", label: "Profil", icon: User, route: "/sanctuaire/profile", angle: 144 },
    { key: "conversations", label: "Conversations", icon: MessageCircle, route: "/sanctuaire/chat", angle: 216 },
    { key: "synthese", label: "Synthèse", icon: Layers, route: "/sanctuaire/synthesis", angle: 288 },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function SanctuaireMandalaNav() {
    const pathname = usePathname();
    const radius = 140; // Distance from center to nav items

    return (
        <div className="relative w-[400px] h-[400px] mx-auto">
            {/* Glassmorphism Background */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 shadow-2xl" />

            {/* Mandala Rings (Static) */}
            <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 400 400"
                fill="none"
            >
                {/* Outer glow ring */}
                <circle
                    cx="200"
                    cy="200"
                    r="185"
                    stroke="url(#goldGradient)"
                    strokeWidth="1"
                    opacity="0.3"
                />
                {/* Middle ring */}
                <circle
                    cx="200"
                    cy="200"
                    r="140"
                    stroke="url(#goldGradient)"
                    strokeWidth="0.5"
                    opacity="0.2"
                    strokeDasharray="4 8"
                />
                {/* Inner ring */}
                <circle
                    cx="200"
                    cy="200"
                    r="60"
                    stroke="url(#goldGradient)"
                    strokeWidth="1"
                    opacity="0.4"
                />

                {/* Connection lines to nav items */}
                {navItems.map((item) => {
                    const angleRad = (item.angle - 90) * (Math.PI / 180);
                    const x2 = 200 + radius * Math.cos(angleRad);
                    const y2 = 200 + radius * Math.sin(angleRad);
                    return (
                        <line
                            key={item.key}
                            x1="200"
                            y1="200"
                            x2={x2}
                            y2={y2}
                            stroke="url(#goldGradient)"
                            strokeWidth="0.5"
                            opacity="0.15"
                        />
                    );
                })}

                {/* Gradient Definition */}
                <defs>
                    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFD700" />
                        <stop offset="50%" stopColor="#FFA500" />
                        <stop offset="100%" stopColor="#FFD700" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Center Hub - Sanctuaire Star */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
            >
                <Link href="/sanctuaire">
                    <div className="relative group cursor-pointer">
                        {/* Glow effect */}
                        <div className="absolute inset-0 w-24 h-24 rounded-full bg-gradient-to-br from-amber-400/30 to-amber-600/20 blur-xl group-hover:blur-2xl transition-all duration-500" />

                        {/* Main orb */}
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 group-hover:shadow-amber-400/50 transition-shadow duration-300 border-2 border-amber-300/50">
                            <Star className="w-10 h-10 text-cosmic-void fill-cosmic-void" />
                        </div>

                        {/* Label */}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                            <span className="text-xs font-bold text-amber-200 tracking-wider">Sanctuaire</span>
                            <span className="block text-[10px] text-white/50 mt-0.5">Centre spirituel</span>
                        </div>
                    </div>
                </Link>
            </motion.div>

            {/* Navigation Items */}
            {navItems.map((item, index) => {
                const Icon = item.icon;
                const angleRad = (item.angle - 90) * (Math.PI / 180);
                const x = 200 + radius * Math.cos(angleRad);
                const y = 200 + radius * Math.sin(angleRad);
                const isActive = pathname === item.route;

                return (
                    <motion.div
                        key={item.key}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                        className="absolute z-10"
                        style={{
                            left: `${x}px`,
                            top: `${y}px`,
                            transform: "translate(-50%, -50%)",
                        }}
                    >
                        <Link href={item.route}>
                            <div className="relative group cursor-pointer">
                                {/* Glow on hover/active */}
                                <div className={`absolute inset-0 w-14 h-14 rounded-full transition-all duration-300 ${isActive
                                        ? "bg-amber-500/30 blur-lg"
                                        : "bg-white/0 group-hover:bg-white/10 blur-md"
                                    }`} />

                                {/* Icon container */}
                                <div className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 border ${isActive
                                        ? "bg-gradient-to-br from-amber-500/20 to-amber-700/20 border-amber-400/50 shadow-lg shadow-amber-500/20"
                                        : "bg-white/5 border-white/10 group-hover:bg-white/10 group-hover:border-white/20"
                                    }`}>
                                    <Icon className={`w-6 h-6 transition-colors duration-300 ${isActive ? "text-amber-300" : "text-white/70 group-hover:text-white"
                                        }`} />
                                </div>

                                {/* Label */}
                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                                    <span className={`text-[11px] font-medium transition-colors duration-300 ${isActive ? "text-amber-200" : "text-white/60 group-hover:text-white/80"
                                        }`}>
                                        {item.label}
                                    </span>
                                    {item.sublabel && (
                                        <span className={`block text-[9px] transition-colors duration-300 ${isActive ? "text-amber-300/70" : "text-white/40"
                                            }`}>
                                            {item.sublabel}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                );
            })}
        </div>
    );
}
