"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import { ExpertAuthProvider, useExpertAuth } from "../../context/ExpertAuthContext";
import {
    Sparkles,
    Users,
    Settings,
    LogOut,
    Bell,
    ChevronRight,
    HelpCircle,
    Loader2,
    Menu,
    X,
    Wand2,
    Search,
} from "lucide-react";

// =============================================================================
// QUICK STATS HOOK - Polling Backend pour Stats
// =============================================================================

interface QuickStats {
    pending: number;
    validation: number;
}

function useQuickStats() {
    const [stats, setStats] = useState<QuickStats>({ pending: 0, validation: 0 });
    const { isAuthenticated } = useExpertAuth();

    const fetchStats = useCallback(async () => {
        try {
            const token = localStorage.getItem("expert_token");
            if (!token) return;
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
            const response = await fetch(`${apiUrl}/api/expert/stats`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
                const data = await response.json();
                setStats({
                    pending: data.pendingOrders || data.pending || 0,
                    validation: data.awaitingValidation || data.validation || 0,
                });
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error);
        }
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [isAuthenticated, fetchStats]);

    return { stats, refetch: fetchStats };
}

// =============================================================================
// ADMIN LAYOUT INNER
// =============================================================================

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { expert, logout, isLoading } = useExpertAuth();
    const { stats, refetch } = useQuickStats();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowSearch(true);
            }
            if (e.key === 'Escape') setShowSearch(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Don't apply layout to login page
    if (pathname === "/admin/login") {
        return <>{children}</>;
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                            <Wand2 className="w-8 h-8 text-amber-400 animate-pulse" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full animate-ping" />
                    </div>
                    <div className="text-center">
                        <p className="text-white font-medium">Initialisation du Desk</p>
                        <p className="text-slate-500 text-xs">Chargement...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Menu items - simplified
    const menuItems = [
        {
            name: "Studio",
            href: "/admin/studio",
            icon: Sparkles,
            description: "File d'attente & Workspace",
            badge: stats.pending + stats.validation > 0 ? stats.pending + stats.validation : null,
        },
        {
            name: "Clients",
            href: "/admin/clients",
            icon: Users,
            description: "CRM & Historique",
            badge: null,
        },
        {
            name: "Paramètres",
            href: "/admin/settings",
            icon: Settings,
            description: "Configuration Vertex AI",
            badge: null,
        },
    ];

    const getRoleDisplay = (role?: string) => {
        switch (role) {
            case 'ADMIN': return 'Grand Maître';
            case 'EXPERT': return 'Expert Oracle';
            default: return 'Expert';
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/admin/clients?search=${encodeURIComponent(searchQuery)}`);
            setShowSearch(false);
            setSearchQuery('');
        }
    };

    return (
        <div className="flex min-h-screen bg-[#0a0d14] text-slate-50 font-sans">
            {/* ===== SEARCH OVERLAY ===== */}
            <AnimatePresence>
                {showSearch && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
                        onClick={() => setShowSearch(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-xl mx-4"
                        >
                            <form onSubmit={handleSearch}>
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Rechercher un client, une commande..."
                                        autoFocus
                                        className="w-full pl-12 pr-6 py-4 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                                    />
                                    <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-500">
                                        ESC
                                    </kbd>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== SIDEBAR (Desktop) ===== */}
            <aside className="w-64 border-r border-white/5 bg-[#0d1117] hidden lg:flex flex-col">
                {/* Logo */}
                <div className="p-5 border-b border-white/5">
                    <Link href="/admin/studio" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-slate-900 shadow-[0_0_20px_rgba(251,191,36,0.3)] group-hover:shadow-[0_0_30px_rgba(251,191,36,0.5)] transition-all">
                            <Wand2 className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-white font-bold block leading-none">Expert Desk</span>
                            <span className="text-[10px] text-amber-400 uppercase tracking-wider">Lumira Studio</span>
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/admin/studio" && pathname?.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                                    isActive
                                        ? "bg-amber-500 text-slate-900"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5", isActive ? "text-slate-900" : "text-slate-500 group-hover:text-amber-400")} />
                                <div className="flex-1">
                                    <span className="text-sm font-medium block">{item.name}</span>
                                    {!isActive && (
                                        <span className="text-[10px] text-slate-600 group-hover:text-slate-500">{item.description}</span>
                                    )}
                                </div>
                                {item.badge && (
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-xs font-bold",
                                        isActive ? "bg-slate-900/30 text-slate-900" : "bg-amber-500/20 text-amber-400"
                                    )}>
                                        {item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Expert Profile */}
                <div className="p-4 border-t border-white/5">
                    <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-slate-900">
                                {expert?.name?.[0] || "E"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{expert?.name || "Expert"}</p>
                                <p className="text-[10px] text-amber-400">{getRoleDisplay(expert?.role)}</p>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-700/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all text-sm"
                        >
                            <LogOut className="w-4 h-4" />
                            Déconnexion
                        </button>
                    </div>
                </div>
            </aside>

            {/* ===== MOBILE HEADER ===== */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#0d1117] border-b border-white/5 flex items-center justify-between px-4 z-30">
                <Link href="/admin/studio" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center text-slate-900">
                        <Wand2 className="w-4 h-4" />
                    </div>
                    <span className="text-white font-bold">Desk</span>
                </Link>
                <div className="flex items-center gap-2">
                    {(stats.pending + stats.validation > 0) && (
                        <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                            {stats.pending + stats.validation}
                        </span>
                    )}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 rounded-lg hover:bg-white/5 text-slate-400"
                    >
                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* ===== MOBILE MENU ===== */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: "100%" }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="lg:hidden fixed top-14 right-0 bottom-0 w-64 bg-[#0d1117] border-l border-white/5 z-30 flex flex-col"
                    >
                        <nav className="flex-1 p-4 space-y-1">
                            {menuItems.map((item) => {
                                const isActive = pathname === item.href || (item.href !== "/admin/studio" && pathname?.startsWith(item.href));
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                                            isActive
                                                ? "bg-amber-500 text-slate-900"
                                                : "text-slate-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <item.icon className={cn("w-5 h-5", isActive ? "text-slate-900" : "text-slate-500")} />
                                        <span className="text-sm font-medium">{item.name}</span>
                                        {item.badge && (
                                            <span className={cn(
                                                "px-2 py-0.5 rounded-full text-xs font-bold ml-auto",
                                                isActive ? "bg-slate-900/30" : "bg-amber-500/20 text-amber-400"
                                            )}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>
                        <div className="p-4 border-t border-white/5">
                            <button
                                onClick={() => { logout(); setMobileMenuOpen(false); }}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-slate-700/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all"
                            >
                                <LogOut className="w-4 h-4" />
                                Déconnexion
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ===== MAIN CONTENT ===== */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#0a0d14]">
                {/* Top bar */}
                <header className="h-14 border-b border-white/5 bg-[#0d1117]/80 backdrop-blur-sm items-center justify-between px-6 sticky top-0 z-10 hidden lg:flex">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Expert Desk</span>
                        <ChevronRight className="w-3 h-3 text-slate-700" />
                        <span className="text-sm font-medium text-slate-300">
                            {menuItems.find(i => pathname === i.href || (i.href !== "/admin/studio" && pathname?.startsWith(i.href)))?.name || "Studio"}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search trigger */}
                        <button
                            onClick={() => setShowSearch(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all text-sm"
                        >
                            <Search className="w-4 h-4" />
                            <span className="hidden md:inline">Rechercher</span>
                            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-[10px] text-slate-500">⌘K</kbd>
                        </button>

                        {/* Notifications */}
                        <button className="relative p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-amber-400 transition-all">
                            <Bell className="w-5 h-5" />
                            {(stats.pending + stats.validation > 0) && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                            )}
                        </button>

                        {/* Help */}
                        <button className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all">
                            <HelpCircle className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <div className="flex-1 overflow-auto lg:mt-0 mt-14">
                    {children}
                </div>
            </main>
        </div>
    );
}

// =============================================================================
// EXPORT
// =============================================================================

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <ExpertAuthProvider>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </ExpertAuthProvider>
    );
}
