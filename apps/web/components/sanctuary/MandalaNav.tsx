"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, User, Compass, BookOpen, MessageCircle, Layers } from "lucide-react";

// =============================================================================
// NAVIGATION ITEMS
// =============================================================================

interface NavItem {
    key: string;
    label: string;
    sublabel?: string;
    icon: React.ComponentType<{ className?: string }>;
    route: string;
    angle: number;
    progress?: number;
}

const navItems: NavItem[] = [
    { key: "chemin", label: "Chemin", sublabel: "spirituel", icon: Compass, route: "/sanctuaire/path", angle: -72, progress: 0 },
    { key: "tirages", label: "Tirages", sublabel: "bruts", icon: BookOpen, route: "/sanctuaire/draws", angle: 0, progress: 25 },
    { key: "synthese", label: "Synthèse", icon: Layers, route: "/sanctuaire/synthesis", angle: 72, progress: 0 },
    { key: "oracle", label: "Conversations", icon: MessageCircle, route: "/sanctuaire/chat", angle: 144, progress: 0 },
    { key: "profil", label: "Profil", icon: User, route: "/sanctuaire/profile", angle: 216, progress: 75 },
];

// =============================================================================
// PROGRESS RING
// =============================================================================

function ProgressRing({ progress, size = 88 }: { progress: number; size?: number }) {
    const strokeWidth = 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    if (progress <= 0) return null;

    return (
        <svg width={size} height={size} className="absolute inset-0">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth={strokeWidth}
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="transition-all duration-1000"
            />
            <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#E8A838" />
                    <stop offset="100%" stopColor="#F4B942" />
                </linearGradient>
            </defs>
        </svg>
    );
}

// =============================================================================
// MAIN COMPONENT - MORE SPACIOUS
// =============================================================================

export function MandalaNav() {
    const pathname = usePathname();
    const radius = 180; // Increased from 130 for more space
    const containerSize = 500; // Increased from 380
    const center = containerSize / 2;

    return (
        <div
            className="relative mx-auto"
            style={{ width: containerSize, height: containerSize }}
        >
            {/* Outer glow */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-serenity-600/5 to-transparent blur-3xl" />

            {/* Glassmorphism Background - More subtle */}
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/[0.02] to-transparent backdrop-blur-sm border border-white/[0.04]" />

            {/* Mandala Rings */}
            <svg
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${containerSize} ${containerSize}`}
                fill="none"
            >
                {/* Outermost decorative ring */}
                <circle
                    cx={center}
                    cy={center}
                    r={220}
                    stroke="url(#ringGradient)"
                    strokeWidth="0.5"
                    opacity="0.1"
                    strokeDasharray="2 6"
                />
                {/* Navigation orbit ring */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="url(#ringGradient)"
                    strokeWidth="0.5"
                    opacity="0.08"
                />
                {/* Inner sanctuary ring */}
                <circle
                    cx={center}
                    cy={center}
                    r={70}
                    stroke="url(#ringGradient)"
                    strokeWidth="1"
                    opacity="0.15"
                />

                {/* Subtle connection lines */}
                {navItems.map((item) => {
                    const angleRad = (item.angle - 90) * (Math.PI / 180);
                    const x2 = center + radius * Math.cos(angleRad);
                    const y2 = center + radius * Math.sin(angleRad);
                    return (
                        <line
                            key={item.key}
                            x1={center}
                            y1={center}
                            x2={x2}
                            y2={y2}
                            stroke="url(#ringGradient)"
                            strokeWidth="0.5"
                            opacity="0.05"
                        />
                    );
                })}

                <defs>
                    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#E8A838" />
                        <stop offset="50%" stopColor="#F4B942" />
                        <stop offset="100%" stopColor="#E8A838" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Center Hub - Sanctuaire Star */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.2, type: "spring", stiffness: 100 }}
                className="absolute z-20"
                style={{
                    left: center,
                    top: center,
                    transform: "translate(-50%, -50%)",
                }}
            >
                <Link href="/sanctuaire">
                    <div className="relative group cursor-pointer">
                        {/* Soft glow */}
                        <div className="absolute -inset-6 rounded-full bg-gradient-to-br from-horizon-400/20 to-horizon-500/10 blur-2xl group-hover:blur-3xl transition-all duration-700 opacity-50 group-hover:opacity-80" />

                        {/* Main orb */}
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-horizon-300 via-horizon-400 to-horizon-500 flex items-center justify-center shadow-lg shadow-horizon-400/20 group-hover:shadow-horizon-400/40 transition-all duration-500 border border-horizon-200/30">
                            <Star className="w-10 h-10 text-abyss-800 fill-abyss-800" />
                        </div>

                        {/* Label */}
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                            <span className="text-sm font-semibold text-horizon-300 tracking-wide">Sanctuaire</span>
                            <span className="block text-[10px] text-stellar-500 mt-0.5">Centre spirituel</span>
                        </div>
                    </div>
                </Link>
            </motion.div>

            {/* Navigation Items - More spacious */}
            {navItems.map((item, index) => {
                const Icon = item.icon;
                const angleRad = (item.angle - 90) * (Math.PI / 180);
                const x = center + radius * Math.cos(angleRad);
                const y = center + radius * Math.sin(angleRad);
                const isActive = pathname === item.route || pathname?.startsWith(item.route + "/");

                return (
                    <motion.div
                        key={item.key}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.4 + index * 0.1, type: "spring", stiffness: 80 }}
                        className="absolute z-10"
                        style={{
                            left: `${x}px`,
                            top: `${y}px`,
                            transform: "translate(-50%, -50%)",
                        }}
                    >
                        <Link href={item.route}>
                            <div className="relative group cursor-pointer">
                                {/* Progress Ring */}
                                <ProgressRing progress={item.progress || 0} size={88} />

                                {/* Hover glow */}
                                <div className={`absolute inset-0 w-[88px] h-[88px] rounded-full transition-all duration-500 ${isActive
                                        ? "bg-horizon-400/15 blur-xl"
                                        : "bg-transparent group-hover:bg-serenity-400/10 blur-lg"
                                    }`} />

                                {/* Icon container */}
                                <div className={`relative w-[88px] h-[88px] rounded-full flex items-center justify-center transition-all duration-500 border ${isActive
                                        ? "bg-gradient-to-br from-horizon-400/15 to-horizon-500/5 border-horizon-400/30"
                                        : "bg-abyss-500/30 border-white/[0.06] group-hover:bg-abyss-400/40 group-hover:border-serenity-400/20"
                                    }`}>
                                    <Icon className={`w-8 h-8 transition-all duration-500 ${isActive ? "text-horizon-300" : "text-stellar-400 group-hover:text-stellar-200"
                                        }`} />
                                </div>

                                {/* Label */}
                                <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                                    <span className={`text-xs font-medium transition-colors duration-300 ${isActive ? "text-horizon-300" : "text-stellar-500 group-hover:text-stellar-300"
                                        }`}>
                                        {item.label}
                                    </span>
                                    {item.sublabel && (
                                        <span className={`block text-[9px] transition-colors duration-300 ${isActive ? "text-horizon-400/60" : "text-stellar-600"
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
