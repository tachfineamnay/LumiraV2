"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star, User, Compass, BookOpen, MessageCircle, Layers, FileText } from "lucide-react";

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
    progress?: number; // 0-100 completion percentage
}

const navItems: NavItem[] = [
    { key: "chemin", label: "Chemin", sublabel: "spirituel", icon: Compass, route: "/sanctuaire/path", angle: -72, progress: 0 },
    { key: "tirages", label: "Tirages", sublabel: "bruts", icon: BookOpen, route: "/sanctuaire/draws", angle: 0, progress: 0 },
    { key: "synthese", label: "Synthèse", icon: Layers, route: "/sanctuaire/synthesis", angle: 72, progress: 0 },
    { key: "oracle", label: "Conversations", icon: MessageCircle, route: "/sanctuaire/chat", angle: 144, progress: 0 },
    { key: "profil", label: "Profil", icon: User, route: "/sanctuaire/profile", angle: 216, progress: 75 },
];

// =============================================================================
// PROGRESS RING COMPONENT
// =============================================================================

function ProgressRing({ progress, size = 70 }: { progress: number; size?: number }) {
    const strokeWidth = 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <svg width={size} height={size} className="absolute inset-0">
            {/* Background ring */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth={strokeWidth}
            />
            {/* Progress ring */}
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
                className="transition-all duration-700"
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
// MAIN COMPONENT
// =============================================================================

export function MandalaNav() {
    const pathname = usePathname();
    const radius = 130; // Distance from center to nav items
    const containerSize = 380;
    const center = containerSize / 2;

    return (
        <div
            className="relative mx-auto"
            style={{ width: containerSize, height: containerSize }}
        >
            {/* Glassmorphism Background */}
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm border border-white/10 shadow-celestial" />

            {/* Mandala Rings (Static) */}
            <svg
                className="absolute inset-0 w-full h-full"
                viewBox={`0 0 ${containerSize} ${containerSize}`}
                fill="none"
            >
                {/* Outer decorative ring */}
                <circle
                    cx={center}
                    cy={center}
                    r={170}
                    stroke="url(#ringGradient)"
                    strokeWidth="0.5"
                    opacity="0.2"
                    strokeDasharray="4 8"
                />
                {/* Middle ring */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="url(#ringGradient)"
                    strokeWidth="1"
                    opacity="0.15"
                />
                {/* Inner ring */}
                <circle
                    cx={center}
                    cy={center}
                    r={55}
                    stroke="url(#ringGradient)"
                    strokeWidth="1.5"
                    opacity="0.3"
                />

                {/* Connection lines to nav items */}
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
                            opacity="0.1"
                        />
                    );
                })}

                {/* Gradient Definitions */}
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
                transition={{ duration: 0.6, delay: 0.2, type: "spring" }}
                className="absolute z-20"
                style={{
                    left: center,
                    top: center,
                    transform: "translate(-50%, -50%)",
                }}
            >
                <Link href="/sanctuaire">
                    <div className="relative group cursor-pointer">
                        {/* Glow effect */}
                        <div className="absolute -inset-4 rounded-full bg-gradient-to-br from-dawn-gold/30 to-dawn-amber/20 blur-xl group-hover:blur-2xl transition-all duration-500 opacity-60 group-hover:opacity-100" />

                        {/* Main orb */}
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-dawn-gold via-dawn-amber to-dawn-gold flex items-center justify-center shadow-lg shadow-dawn-gold/30 group-hover:shadow-dawn-gold/50 transition-all duration-300 border-2 border-dawn-glow/50">
                            <Star className="w-9 h-9 text-cosmos-deep fill-cosmos-deep" />
                        </div>

                        {/* Label */}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                            <span className="text-xs font-bold text-dawn-amber tracking-wider">Sanctuaire</span>
                            <span className="block text-[10px] text-star-dim mt-0.5">Centre spirituel</span>
                        </div>
                    </div>
                </Link>
            </motion.div>

            {/* Navigation Items */}
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
                        transition={{ duration: 0.4, delay: 0.3 + index * 0.08, type: "spring" }}
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
                                {item.progress !== undefined && item.progress > 0 && (
                                    <ProgressRing progress={item.progress} size={70} />
                                )}

                                {/* Glow on hover/active */}
                                <div className={`absolute inset-0 w-[70px] h-[70px] rounded-full transition-all duration-300 ${isActive
                                        ? "bg-dawn-gold/25 blur-lg"
                                        : "bg-white/0 group-hover:bg-cosmos-cyan/20 blur-md"
                                    }`} />

                                {/* Icon container */}
                                <div className={`relative w-[70px] h-[70px] rounded-full flex items-center justify-center transition-all duration-300 border ${isActive
                                        ? "bg-gradient-to-br from-dawn-gold/20 to-dawn-amber/10 border-dawn-gold/40 shadow-lg shadow-dawn-gold/20"
                                        : "bg-cosmos-twilight/50 border-white/10 group-hover:bg-cosmos-twilight/70 group-hover:border-dawn-gold/20"
                                    }`}>
                                    <Icon className={`w-7 h-7 transition-colors duration-300 ${isActive ? "text-dawn-gold" : "text-star-silver group-hover:text-star-white"
                                        }`} />
                                </div>

                                {/* Label */}
                                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                                    <span className={`text-[11px] font-medium transition-colors duration-300 ${isActive ? "text-dawn-amber" : "text-star-dim group-hover:text-star-silver"
                                        }`}>
                                        {item.label}
                                    </span>
                                    {item.sublabel && (
                                        <span className={`block text-[9px] transition-colors duration-300 ${isActive ? "text-dawn-gold/70" : "text-star-dim/60"
                                            }`}>
                                            {item.sublabel}
                                        </span>
                                    )}
                                </div>

                                {/* Tooltip */}
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                    <div className="bg-cosmos-twilight/90 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-1.5 shadow-lg">
                                        <span className="text-xs text-star-white whitespace-nowrap">
                                            {item.label} {item.sublabel || ""}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                );
            })}
        </div>
    );
}
