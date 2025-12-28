"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { SanctuaireProvider, useSanctuaire } from "../../context/SanctuaireContext";
import { motion, AnimatePresence } from "framer-motion";
import { Home, User as UserIcon, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import { LevelBadge } from "../../components/ui/LevelBadge";

function SanctuaireLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, logout } = useAuth();
    const { levelMetadata, isLoading: entitlementsLoading } = useSanctuaire();
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Determine display level (default to 1 if no orders)
    const displayLevel = (levelMetadata?.level || 1) as 1 | 2 | 3 | 4;

    return (
        <div className="min-h-screen bg-cosmic-void text-cosmic-divine selection:bg-cosmic-gold/20 flex flex-col starfield">

            {/* 🏛️ FLOATING HEADER */}
            <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <Link href="/" className="glass-card p-2 hover:bg-white/10 transition-colors">
                        <Home className="w-5 h-5 text-gold-light" />
                    </Link>
                </div>

                <div className="flex items-center gap-4 pointer-events-auto">
                    {/* Dynamic Level Badge */}
                    <div className="hidden sm:block">
                        {entitlementsLoading ? (
                            <div className="px-4 py-2 rounded-full bg-white/5 animate-pulse">
                                <span className="text-xs text-white/30">Chargement...</span>
                            </div>
                        ) : (
                            <LevelBadge level={displayLevel} />
                        )}
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="glass-card flex items-center gap-3 px-4 py-2 hover:bg-white/10 transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-gold-gradient flex items-center justify-center text-void font-bold">
                                {user?.name?.[0] || 'U'}
                            </div>
                            <span className="text-sm font-medium hidden md:block">{user?.name || 'Explorateur'}</span>
                            <ChevronDown className={`w-4 h-4 text-gold-light transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isProfileOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 mt-3 w-64 glass-card p-2 shadow-2xl origin-top-right"
                                >
                                    <div className="p-3 border-b border-white/5 mb-2">
                                        <p className="text-xs text-ethereal/50 uppercase tracking-widest">Identité</p>
                                        <p className="text-sm font-medium pt-1">{user?.email}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[10px] text-gold/60 italic">Niveau:</span>
                                            {!entitlementsLoading && <LevelBadge level={displayLevel} showName={true} className="scale-75 origin-left" />}
                                        </div>
                                    </div>
                                    <nav className="flex flex-col gap-1">
                                        <Link href="/sanctuaire/profile" className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left">
                                            <UserIcon className="w-4 h-4 text-gold" />
                                            <span className="text-sm">Mon Profil</span>
                                        </Link>
                                        <button className="flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-colors text-left text-rose-400 hover:bg-rose-400/10" onClick={logout}>
                                            <LogOut className="w-4 h-4" />
                                            <span className="text-sm">Déconnexion</span>
                                        </button>
                                    </nav>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            {/* 🌌 MAIN CONTENT */}
            <main className="flex-1 flex flex-col pt-24">
                {children}
            </main>

            {/* 🎵 MINI AUDIO PLAYER (Placeholder) */}
            <motion.div
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                className="fixed bottom-0 left-0 right-0 z-50 p-4 pointer-events-none"
            >
                <div className="max-w-xl mx-auto glass-card flex items-center gap-6 px-6 py-3 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pointer-events-auto">
                    <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center mandala-pulse">
                        <div className="w-1 h-1 bg-gold rounded-full" />
                    </div>
                    <div className="flex-grow">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gold/80">Résonance de l'Âme</span>
                            <span className="text-[10px] text-ethereal/40">0:00 / 12:44</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gold-gradient w-0" />
                        </div>
                    </div>
                    <button className="w-10 h-10 rounded-full bg-gold-gradient flex items-center justify-center text-void shadow-gold-glow">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-0.5">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

export default function SanctuaireLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SanctuaireProvider>
            <SanctuaireLayoutContent>
                {children}
            </SanctuaireLayoutContent>
        </SanctuaireProvider>
    );
}
