"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { SanctuaireProvider, useSanctuaire } from "../../context/SanctuaireContext";
import { MobileBottomNav } from "../../components/sanctuary/MobileBottomNav";
import { motion, AnimatePresence } from "framer-motion";
import { Home, User as UserIcon, LogOut, ChevronDown, Eye, ShoppingBag, Sparkles } from "lucide-react";
import { useState } from "react";
import { LevelBadge } from "../../components/ui/LevelBadge";

// =============================================================================
// LAYOUT CONTENT
// =============================================================================

function SanctuaireLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, logout } = useAuth();
    const { levelMetadata, isLoading: entitlementsLoading } = useSanctuaire();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const pathname = usePathname();

    // Determine display level (default to 1 if no orders)
    const displayLevel = (levelMetadata?.level || 1) as 1 | 2 | 3 | 4;

    return (
        <div className="min-h-screen bg-cosmos-night text-star-white selection:bg-dawn-gold/20 flex flex-col starfield">

            {/* 🏛️ FLOATING HEADER */}
            <header className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
                {/* Left: Home Button */}
                <div className="flex items-center gap-4 pointer-events-auto">
                    <Link
                        href="/"
                        className="w-10 h-10 rounded-xl bg-cosmos-twilight/50 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-cosmos-twilight/70 hover:border-dawn-gold/20 transition-all duration-300"
                    >
                        <Home className="w-5 h-5 text-star-silver hover:text-dawn-gold transition-colors" />
                    </Link>
                </div>

                {/* Right: Level Badge + Profile Dropdown */}
                <div className="flex items-center gap-3 pointer-events-auto">
                    {/* Dynamic Level Badge */}
                    <div className="hidden sm:block">
                        {entitlementsLoading ? (
                            <div className="px-4 py-2 rounded-full bg-cosmos-twilight/50 animate-pulse">
                                <span className="text-xs text-star-dim">Chargement...</span>
                            </div>
                        ) : (
                            <LevelBadge level={displayLevel} />
                        )}
                    </div>

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl bg-cosmos-twilight/50 backdrop-blur-sm border border-white/10 hover:bg-cosmos-twilight/70 hover:border-dawn-gold/20 transition-all duration-300"
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-dawn-gold to-dawn-amber flex items-center justify-center text-cosmos-deep font-bold text-sm">
                                {user?.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <span className="text-sm font-medium hidden md:block text-star-silver">
                                {user?.name || 'Explorateur'}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-star-dim transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isProfileOpen && (
                                <>
                                    {/* Backdrop */}
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsProfileOpen(false)}
                                    />

                                    {/* Dropdown Menu */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-3 w-72 z-50 bg-cosmos-twilight/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                                    >
                                        {/* User Info Header */}
                                        <div className="p-4 border-b border-white/5 bg-gradient-to-br from-dawn-gold/5 to-transparent">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-dawn-gold to-dawn-amber flex items-center justify-center text-cosmos-deep font-bold text-lg">
                                                    {user?.name?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-star-white">{user?.name || 'Explorateur'}</p>
                                                    <p className="text-xs text-star-dim">{user?.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-star-dim uppercase tracking-wider">Niveau:</span>
                                                {!entitlementsLoading && <LevelBadge level={displayLevel} showName={true} className="scale-75 origin-left" />}
                                            </div>
                                        </div>

                                        {/* Quick Links */}
                                        <nav className="p-2">
                                            <Link
                                                href="/sanctuaire/profile"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                                            >
                                                <UserIcon className="w-5 h-5 text-dawn-gold" />
                                                <div>
                                                    <span className="text-sm text-star-white">Mon Profil</span>
                                                    <span className="block text-[10px] text-star-dim">Gérer mon identité</span>
                                                </div>
                                            </Link>

                                            <Link
                                                href="/sanctuaire/draws"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                                            >
                                                <Eye className="w-5 h-5 text-cosmos-cyan" />
                                                <div>
                                                    <span className="text-sm text-star-white">Mes Lectures</span>
                                                    <span className="block text-[10px] text-star-dim">Historique des tirages</span>
                                                </div>
                                            </Link>

                                            <Link
                                                href="/commande"
                                                onClick={() => setIsProfileOpen(false)}
                                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                                            >
                                                <ShoppingBag className="w-5 h-5 text-dawn-amber" />
                                                <div>
                                                    <span className="text-sm text-star-white">Nouvelle Lecture</span>
                                                    <span className="block text-[10px] text-star-dim">Commander maintenant</span>
                                                </div>
                                            </Link>
                                        </nav>

                                        {/* Logout */}
                                        <div className="p-2 border-t border-white/5">
                                            <button
                                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors text-rose-400 hover:bg-rose-400/10"
                                                onClick={() => { logout(); setIsProfileOpen(false); }}
                                            >
                                                <LogOut className="w-5 h-5" />
                                                <span className="text-sm">Déconnexion</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            {/* 🌌 MAIN CONTENT */}
            <main className="flex-1 flex flex-col pt-20 pb-24 lg:pb-8">
                {children}
            </main>

            {/* 📱 MOBILE BOTTOM NAV */}
            <MobileBottomNav />
        </div>
    );
}

// =============================================================================
// LAYOUT EXPORT
// =============================================================================

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
