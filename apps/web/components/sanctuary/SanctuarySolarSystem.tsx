"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { Star, Book, Layers, MessageCircle, User, Sparkles } from "lucide-react";

const PLANETS = [
    // Inner Orbit
    { key: "profile", label: "Profil", icon: User, color: "gold", route: "/sanctuaire/profile", orbitRadius: 110, size: 40, speed: 20, startAngle: 0 },

    // Middle Orbit
    { key: "path", label: "Chemin", icon: Star, color: "amber", route: "/sanctuaire/rituals", orbitRadius: 180, size: 56, speed: 35, startAngle: 120 },
    { key: "draws", label: "Tirages", icon: Book, color: "emerald", route: "/sanctuaire/draws", orbitRadius: 180, size: 48, speed: 35, startAngle: 300 },

    // Outer Orbit
    { key: "chat", label: "Oracle", icon: MessageCircle, color: "blue", route: "/sanctuaire/chat", orbitRadius: 260, size: 64, speed: 50, startAngle: 60 },
    { key: "synthesis", label: "Synthèse", icon: Layers, color: "purple", route: "/sanctuaire/synthesis", orbitRadius: 260, size: 52, speed: 50, startAngle: 240 },
];

const colorMap: Record<string, { bg: string; ring: string; glow: string; text: string }> = {
    amber: { bg: "from-amber-600/40 to-amber-900/40", ring: "border-amber-500/50", glow: "shadow-amber-500/30", text: "text-amber-200" },
    emerald: { bg: "from-emerald-600/40 to-emerald-900/40", ring: "border-emerald-500/50", glow: "shadow-emerald-500/30", text: "text-emerald-200" },
    purple: { bg: "from-purple-600/40 to-purple-900/40", ring: "border-purple-500/50", glow: "shadow-purple-500/30", text: "text-purple-200" },
    blue: { bg: "from-cyan-600/40 to-blue-900/40", ring: "border-cyan-500/50", glow: "shadow-cyan-500/30", text: "text-cyan-200" },
    gold: { bg: "from-yellow-500/40 to-amber-700/40", ring: "border-yellow-400/50", glow: "shadow-yellow-400/30", text: "text-yellow-200" },
};

export const SanctuarySolarSystem = () => {
    const router = useRouter();
    const pathname = usePathname();
    const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null);

    return (
        <div className="relative w-[600px] h-[600px] flex items-center justify-center">
            {/* 🌌 Background Glow & Particles */}
            <div className="absolute inset-0 bg-cosmic-gold/5 blur-[100px] rounded-full" />

            {/* Solar Orbits */}
            {[110, 180, 260].map((radius, i) => (
                <div
                    key={radius}
                    className="absolute rounded-full border border-white/5"
                    style={{ width: radius * 2, height: radius * 2 }}
                />
            ))}

            {/* ✨ Central Star (Sun) */}
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute z-20 w-32 h-32 rounded-full relative flex items-center justify-center group cursor-default"
            >
                {/* Sun Core */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-200 to-orange-600 rounded-full blur-md opacity-80 animate-pulse-slow" />
                <div className="absolute inset-2 bg-gradient-to-br from-orange-400 via-red-500 to-amber-900 rounded-full shadow-[0_0_60px_rgba(251,191,36,0.6)]" />

                {/* Sun Surface Details */}
                <div className="absolute inset-0 rounded-full opacity-30 mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />

                {/* Content */}
                <div className="relative z-10 text-center">
                    <Sparkles className="w-8 h-8 text-white mx-auto mb-1 animate-spin-slow" />
                    <span className="text-white font-playfair font-bold tracking-widest text-sm uppercase drop-shadow-md">
                        Sanctuaire
                    </span>
                </div>
            </motion.div>

            {/* 🪐 Orbiting Planets */}
            {PLANETS.map((planet, index) => {
                const isActive = pathname?.startsWith(planet.route);
                const isHovered = hoveredPlanet === planet.key;
                const colors = colorMap[planet.color];
                const Icon = planet.icon;

                return (
                    <div
                        key={planet.key}
                        className="absolute w-full h-full flex items-center justify-center pointer-events-none"
                        style={{
                            animation: `spinOrbit ${planet.speed}s linear infinite`,
                            animationDelay: `-${(planet.startAngle / 360) * planet.speed}s`
                        }}
                    >
                        {/* Styles for animation keyframes injected via style tag or global css would be ideal, 
                             but here we rely on tailwind or just standard rotation.
                             To keep the planet upright, we counter-rotate the inner container.
                          */}
                        <div
                            className="absolute"
                            style={{ transform: `translateX(${planet.orbitRadius}px)` }}
                        >
                            {/* Counter-rotation to keep content upright */}
                            <motion.div
                                className="pointer-events-auto"
                                style={{
                                    width: planet.size,
                                    height: planet.size,
                                    animation: `counterSpin ${planet.speed}s linear infinite`,
                                    animationDelay: `-${(planet.startAngle / 360) * planet.speed}s`
                                }}
                                whileHover={{ scale: 1.2 }}
                                onMouseEnter={() => setHoveredPlanet(planet.key)}
                                onMouseLeave={() => setHoveredPlanet(null)}
                                onClick={() => router.push(planet.route)}
                            >
                                <div className={`
                                    relative w-full h-full rounded-full cursor-pointer transition-all duration-300
                                    bg-gradient-to-br ${colors.bg} backdrop-blur-md border border-white/10
                                    shadow-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]
                                    flex items-center justify-center
                                    ${isActive ? `ring-2 ring-offset-2 ring-offset-black ${colors.ring}` : ''}
                                `}>
                                    <Icon className={`w-1/2 h-1/2 text-white/90 drop-shadow-md`} />

                                    {/* Planet Atmosphere Glow */}
                                    <div className={`absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-300 ${colors.glow} shadow-[0_0_20px_currentColor]`} />
                                </div>

                                {/* 🏷️ Planet Label Tooltip */}
                                <AnimatePresence>
                                    {(isHovered || isActive) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 5 }}
                                            className={`
                                                absolute top-full left-1/2 -translate-x-1/2 mt-3
                                                px-3 py-1.5 rounded-lg border border-white/10
                                                bg-cosmic-void/90 backdrop-blur-xl
                                                text-xs font-bold uppercase tracking-widest whitespace-nowrap
                                                ${colors.text} shadow-xl z-50
                                            `}
                                        >
                                            {planet.label}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    </div>
                );
            })}

            <style jsx>{`
                @keyframes spinOrbit {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes counterSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(-360deg); }
                }
                .animate-pulse-slow {
                    animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                .animate-spin-slow {
                    animation: spin 8s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
