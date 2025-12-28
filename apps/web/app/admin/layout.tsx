"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    ClipboardList,
    CheckCircle2,
    History,
    Users,
    LogOut,
    Wand2,
    Bell,
    LayoutDashboard,
    Loader2
} from "lucide-react";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";
import { ExpertAuthProvider, useExpertAuth } from "../../context/ExpertAuthContext";

function AdminLayoutInner({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { expert, logout, isLoading, isAuthenticated } = useExpertAuth();

    // Don't apply layout to login page
    if (pathname === "/admin/login") {
        return <>{children}</>;
    }

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 text-sm">Chargement...</p>
                </div>
            </div>
        );
    }

    const menuItems = [
        { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { name: "Commandes", href: "/admin/orders", icon: ClipboardList },
        { name: "Validations", href: "/admin/validations", icon: CheckCircle2 },
        { name: "Historique", href: "/admin/history", icon: History },
        { name: "Clients", href: "/admin/clients", icon: Users },
    ];

    const handleLogout = () => {
        logout();
    };

    // Get expert role display name
    const getRoleDisplay = (role?: string) => {
        switch (role) {
            case 'ADMIN': return 'Grand Maître';
            case 'EXPERT': return 'Expert Oracle';
            default: return 'Expert';
        }
    };

    return (
        <div className="flex min-h-screen bg-slate-900 text-slate-50 selection:bg-amber-400/20 font-sans">
            {/* 🏛️ ADMIN SIDEBAR */}
            <aside className="w-64 border-r border-white/5 bg-slate-950/50 backdrop-blur-xl hidden md:flex flex-col z-20">
                <div className="p-6 border-b border-white/5">
                    <Link href="/admin" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center text-slate-900 shadow-[0_0_20px_rgba(251,191,36,0.2)] group-hover:shadow-[0_0_30px_rgba(251,191,36,0.4)] transition-all duration-500">
                            <Wand2 className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="text-lg font-serif italic text-white block">Expert Desk</span>
                            <span className="text-[10px] text-amber-400/60 uppercase tracking-widest font-bold">Poste de commande</span>
                        </div>
                    </Link>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative",
                                    isActive
                                        ? "bg-amber-400 text-slate-900 font-bold shadow-lg"
                                        : "text-slate-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <item.icon className={cn(
                                    "w-5 h-5",
                                    isActive ? "text-slate-900" : "text-slate-500 group-hover:text-amber-400"
                                )} />
                                <span className="text-sm">{item.name}</span>
                                {isActive && (
                                    <motion.div
                                        layoutId="active-pill"
                                        className="absolute inset-0 bg-amber-400 rounded-xl -z-10"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-white/5">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-all group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-sm font-medium">Déconnexion</span>
                    </button>
                </div>
            </aside>

            {/* 🌌 MAIN DASHBOARD */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#0B0F1A]">
                {/* STICKY HEADER */}
                <header className="h-16 border-b border-white/5 bg-slate-950/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10 transition-colors">
                    <div className="flex items-center gap-3">
                        <h2 className="text-sm font-medium text-slate-400">
                            {menuItems.find(i => pathname === i.href || (i.href !== "/admin" && pathname?.startsWith(i.href)))?.name || "Dashboard"}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Notification Bell */}
                        <button className="relative p-2 text-slate-400 hover:text-amber-400 transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse shadow-[0_0_10px_#fbbf24]" />
                        </button>

                        <div className="h-8 w-[1px] bg-white/5 mx-2" />

                        {/* Profile Info */}
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-white leading-none mb-1">{expert?.name || "Expert"}</p>
                                <p className="text-[10px] text-amber-400 uppercase tracking-widest leading-none">{getRoleDisplay(expert?.role)}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-amber-400 shadow-xl overflow-hidden">
                                {expert?.name?.[0] || "E"}
                            </div>
                        </div>
                    </div>
                </header>

                {/* PAGE CONTENT */}
                <div className="p-8 flex-1">
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

