"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    // Navigation
    Command,
    Users,
    LogOut,
    Wand2,
    Bell,
    Settings,
    Loader2,
    Search,
    // Quick Actions
    Sparkles,
    Zap,
    BarChart3,
    HelpCircle,
    // Indicators
    ChevronRight,
    ChevronDown,
    ArrowUpRight,
    Radio
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ExpertAuthProvider, useExpertAuth } from "../../context/ExpertAuthContext";

// =============================================================================
// QUICK STATS HOOK
// =============================================================================

function useQuickStats() {
    const [stats, setStats] = useState({ pending: 0, validation: 0, processing: 0 });
    
    useEffect(() => {
        const fetchStats = async () => {
            const token = localStorage.getItem('expert_token');
            if (!token) return;
            
            try {
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const res = await fetch(`${apiUrl}/api/expert/stats`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStats({
                        pending: data.pendingOrders || 0,
                        validation: data.awaitingValidation || 0,
                        processing: data.processingOrders || 0
                    });
                }
            } catch (e) {
                console.error('Stats fetch error', e);
            }
        };
        
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);
    
    return stats;
}

// =============================================================================
// ADMIN LAYOUT INNER
// =============================================================================

function AdminLayoutInner({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { expert, logout, isLoading } = useExpertAuth();
    const stats = useQuickStats();
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Don't apply layout to login page
    if (pathname === "/admin/login") {
        return <>{children}</>;
    }

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                            <Wand2 className="w-8 h-8 text-amber-400 animate-pulse" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full animate-ping" />
                    </div>
                    <div className="text-center">
                        <p className="text-white font-medium">Initialisation du Desk</p>
                        <p className="text-slate-500 text-xs">Chargement des modules...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Minimal menu - Mission Control + CRM
    const menuItems = [
        { 
            name: "Mission Control", 
            href: "/admin", 
            icon: Command,
            badge: stats.pending + stats.validation > 0 ? stats.pending + stats.validation : null,
            description: "Pipeline & Opérations"
        },
        { 
            name: "CRM Clients", 
            href: "/admin/clients", 
            icon: Users,
            badge: null,
            description: "Gestion des clients"
        },
        { 
            name: "Analytics", 
            href: "/admin/analytics", 
            icon: BarChart3,
            badge: null,
            description: "Rapports & Statistiques"
        },
        { 
            name: "Paramètres", 
            href: "/admin/settings", 
            icon: Settings,
            badge: null,
            description: "Configuration"
        },
    ];

    // Get expert role display name
    const getRoleDisplay = (role?: string) => {
        switch (role) {
            case 'ADMIN': return 'Grand Maître';
            case 'EXPERT': return 'Expert Oracle';
            default: return 'Expert';
        }
    };

    // Handle global search
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/admin/clients?search=${encodeURIComponent(searchQuery)}`);
            setShowSearch(false);
            setSearchQuery('');
        }
    };

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowSearch(true);
            }
            if (e.key === 'Escape') {
                setShowSearch(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="flex min-h-screen bg-[#0a0d14] text-slate-50 selection:bg-amber-400/20 font-sans">
            {/* 🔍 GLOBAL SEARCH OVERLAY */}
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
                            className="w-full max-w-2xl"
                        >
                            <form onSubmit={handleSearch}>
                                <div className="relative">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Rechercher un client, une commande..."
                                        autoFocus
                                        className="w-full pl-14 pr-6 py-5 text-lg bg-slate-900 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                                    />
                                    <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-slate-500 text-sm">
                                        <kbd className="px-2 py-0.5 bg-slate-800 rounded text-xs">ESC</kbd>
                                    </div>
                                </div>
                            </form>
                            
                            {/* Quick Actions */}
                            <div className="mt-4 p-4 bg-slate-900/90 border border-white/5 rounded-xl">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Actions Rapides</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => { router.push('/admin'); setShowSearch(false); }}
                                        className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50 hover:bg-amber-500/10 hover:border-amber-500/20 border border-transparent text-slate-300 hover:text-amber-400 transition-all text-sm"
                                    >
                                        <Command className="w-4 h-4" />
                                        Mission Control
                                    </button>
                                    <button
                                        onClick={() => { router.push('/admin/clients'); setShowSearch(false); }}
                                        className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50 hover:bg-blue-500/10 hover:border-blue-500/20 border border-transparent text-slate-300 hover:text-blue-400 transition-all text-sm"
                                    >
                                        <Users className="w-4 h-4" />
                                        Voir tous les clients
                                    </button>
                                    <button
                                        onClick={() => { router.push('/admin/analytics'); setShowSearch(false); }}
                                        className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50 hover:bg-purple-500/10 hover:border-purple-500/20 border border-transparent text-slate-300 hover:text-purple-400 transition-all text-sm"
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                        Analytics
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* 🏛️ ADMIN SIDEBAR - Redesigned */}
            <aside className="w-72 border-r border-white/5 bg-[#0d1117] hidden md:flex flex-col z-20">
                {/* Logo & Brand */}
                <div className="p-6 border-b border-white/5">
                    <Link href="/admin" className="flex items-center gap-3 group">
                        <div className="relative">
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center text-slate-900 shadow-[0_0_30px_rgba(251,191,36,0.3)] group-hover:shadow-[0_0_40px_rgba(251,191,36,0.5)] transition-all duration-500">
                                <Wand2 className="w-6 h-6" />
                            </div>
                            {/* Live indicator */}
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-[#0d1117] flex items-center justify-center">
                                <Radio className="w-2 h-2 text-emerald-900" />
                            </div>
                        </div>
                        <div>
                            <span className="text-xl font-bold text-white block tracking-tight">Expert Desk</span>
                            <span className="text-[10px] text-amber-400/80 uppercase tracking-[0.2em] font-bold">Mission Control</span>
                        </div>
                    </Link>
                </div>

                {/* Search Shortcut */}
                <div className="px-4 py-4">
                    <button
                        onClick={() => setShowSearch(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/50 border border-white/5 hover:border-amber-500/30 transition-all group"
                    >
                        <Search className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                        <span className="text-sm text-slate-500 flex-1 text-left">Rechercher...</span>
                        <kbd className="px-1.5 py-0.5 bg-slate-700/50 rounded text-[10px] text-slate-400">⌘K</kbd>
                    </button>
                </div>

                {/* Status Indicators */}
                <div className="px-4 pb-4">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-amber-400">Files d'attente</span>
                            <span className="text-[10px] text-slate-500">LIVE</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-sm font-bold text-white">{stats.pending}</span>
                                <span className="text-[10px] text-slate-500">en attente</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-purple-400" />
                                <span className="text-sm font-bold text-white">{stats.validation}</span>
                                <span className="text-[10px] text-slate-500">à valider</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-1">
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-4 py-2">Navigation</p>
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
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
                                <item.icon className={cn(
                                    "w-5 h-5",
                                    isActive ? "text-slate-900" : "text-slate-500 group-hover:text-amber-400"
                                )} />
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
                                {isActive && (
                                    <motion.div
                                        layoutId="active-nav"
                                        className="absolute inset-0 bg-amber-500 rounded-xl -z-10"
                                        transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Expert Profile */}
                <div className="p-4 border-t border-white/5">
                    <div className="p-4 rounded-xl bg-slate-800/30 border border-white/5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-slate-900 text-lg">
                                {expert?.name?.[0] || "E"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate">{expert?.name || "Expert"}</p>
                                <p className="text-[10px] text-amber-400">{getRoleDisplay(expert?.role)}</p>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-700/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all text-sm"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Déconnexion</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* 🌌 MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#0a0d14]">
                {/* MINIMAL TOP BAR */}
                <header className="h-14 border-b border-white/5 bg-[#0d1117]/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Expert Desk</span>
                        <ChevronRight className="w-3 h-3 text-slate-700" />
                        <span className="text-sm font-medium text-slate-300">
                            {menuItems.find(i => pathname === i.href || (i.href !== "/admin" && pathname?.startsWith(i.href)))?.name || "Dashboard"}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Notifications */}
                        <button className="relative p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-amber-400 transition-all">
                            <Bell className="w-5 h-5" />
                            {(stats.pending + stats.validation > 0) && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                            )}
                        </button>
                        
                        {/* Help */}
                        <button title="Aide" className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all">
                            <HelpCircle className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* PAGE CONTENT */}
                <div className="p-6 flex-1 overflow-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ExpertAuthProvider>
            <AdminLayoutInner>{children}</AdminLayoutInner>
        </ExpertAuthProvider>
    );
}

