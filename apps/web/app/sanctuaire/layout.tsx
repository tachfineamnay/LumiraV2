"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { SanctuaireProvider, useSanctuaire } from "../../context/SanctuaireContext";
import { SanctuaireSidebar } from "../../components/sanctuary/SanctuaireSidebar";
import { MobileBottomNav } from "../../components/sanctuary/MobileBottomNav";
import { motion, AnimatePresence } from "framer-motion";
import { Home, User as UserIcon, LogOut, ChevronDown, Eye, ShoppingBag } from "lucide-react";
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

    const displayLevel = (levelMetadata?.level || 1) as 1 | 2 | 3 | 4;

    return (
        <div className="min-h-screen bg-abyss-700 text-stellar-100 selection:bg-horizon-400/20 starfield">

            {/* 🏛️ SIDEBAR - Desktop Only */}
            <SanctuaireSidebar />

            {/* 📱 MAIN WRAPPER */}
            <div className="lg:ml-64 min-h-screen flex flex-col">

                {/* 🔝 TOP BAR */}
                <header className="sticky top-0 z-40 p-4 flex justify-between items-center backdrop-blur-xl bg-abyss-700/80 border-b border-white/[0.04]">
                    {/* Left: Home (Mobile) */}
                    <div className="flex items-center gap-4 lg:hidden">
                        <Link
                            href="/"
                            className="w-10 h-10 rounded-xl bg-abyss-500/50 border border-white/[0.06] flex items-center justify-center hover:bg-abyss-400/50 transition-all duration-300"
                        >
                            <Home className="w-5 h-5 text-stellar-400" />
                        </Link>
                    </div>

                    {/* Center spacer */}
                    <div className="flex-1" />

                    {/* Right: Level Badge + Profile */}
                    <div className="flex items-center gap-3">
                        {/* Level Badge */}
                        <div className="hidden sm:block">
                            {entitlementsLoading ? (
                                <div className="px-4 py-2 rounded-full bg-abyss-500/50 animate-pulse">
                                    <span className="text-xs text-stellar-500">Chargement...</span>
                                </div>
                            ) : (
                                <LevelBadge level={displayLevel} />
                            )}
                        </div>

                        {/* Profile Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-abyss-500/50 border border-white/[0.06] hover:bg-abyss-400/50 transition-all duration-300"
                            >
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-horizon-300 to-horizon-500 flex items-center justify-center text-abyss-800 font-bold text-sm">
                                    {user?.name?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <span className="text-sm font-medium hidden md:block text-stellar-300">
                                    {user?.name || 'Explorateur'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-stellar-500 transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {isProfileOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsProfileOpen(false)}
                                        />

                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute right-0 mt-3 w-72 z-50 bg-abyss-600/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-abyss overflow-hidden"
                                        >
                                            {/* User Info */}
                                            <div className="p-4 border-b border-white/[0.04] bg-gradient-to-br from-horizon-400/5 to-transparent">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-horizon-300 to-horizon-500 flex items-center justify-center text-abyss-800 font-bold text-lg">
                                                        {user?.name?.[0]?.toUpperCase() || 'U'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-stellar-100">{user?.name || 'Explorateur'}</p>
                                                        <p className="text-xs text-stellar-500">{user?.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-stellar-500 uppercase tracking-wider">Niveau:</span>
                                                    {!entitlementsLoading && <LevelBadge level={displayLevel} showName={true} className="scale-75 origin-left" />}
                                                </div>
                                            </div>

                                            {/* Links */}
                                            <nav className="p-2">
                                                <Link
                                                    href="/sanctuaire/profile"
                                                    onClick={() => setIsProfileOpen(false)}
                                                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                                                >
                                                    <UserIcon className="w-5 h-5 text-horizon-400" />
                                                    <div>
                                                        <span className="text-sm text-stellar-100">Mon Profil</span>
                                                        <span className="block text-[10px] text-stellar-500">Gérer mon identité</span>
                                                    </div>
                                                </Link>

                                                <Link
                                                    href="/sanctuaire/draws"
                                                    onClick={() => setIsProfileOpen(false)}
                                                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                                                >
                                                    <Eye className="w-5 h-5 text-serenity-400" />
                                                    <div>
                                                        <span className="text-sm text-stellar-100">Mes Lectures</span>
                                                        <span className="block text-[10px] text-stellar-500">Historique des tirages</span>
                                                    </div>
                                                </Link>

                                                <Link
                                                    href="/commande"
                                                    onClick={() => setIsProfileOpen(false)}
                                                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-white/5 transition-colors"
                                                >
                                                    <ShoppingBag className="w-5 h-5 text-horizon-300" />
                                                    <div>
                                                        <span className="text-sm text-stellar-100">Nouvelle Lecture</span>
                                                        <span className="block text-[10px] text-stellar-500">Commander maintenant</span>
                                                    </div>
                                                </Link>
                                            </nav>

                                            {/* Logout */}
                                            <div className="p-2 border-t border-white/[0.04]">
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
                <main className="flex-1 pb-24 lg:pb-8">
                    {children}
                </main>
            </div>

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
