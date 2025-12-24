'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Sparkles,
    Compass,
    User as UserIcon,
    LogOut,
    ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function SanctuaireLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const menuItems = [
        { name: 'Tableau de bord', href: '/sanctuaire', icon: LayoutDashboard },
        { name: 'Mes Tirages', href: '/sanctuaire/tirages', icon: Sparkles },
        { name: 'Mandala Sacré', href: '/sanctuaire/mandala', icon: Compass },
        { name: 'Mon Profil', href: '/sanctuaire/profil', icon: UserIcon },
    ];

    return (
        <div className="flex min-h-screen bg-slate-950 text-slate-200">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl hidden md:flex flex-col">
                <div className="p-8">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] group-hover:scale-110 transition-transform">L</div>
                        <span className="text-xl font-bold tracking-tighter text-white">LUMIRA</span>
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                                pathname === item.href
                                    ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5", pathname === item.href ? "text-indigo-400" : "text-slate-500 group-hover:text-indigo-300")} />
                            <span className="font-medium">{item.name}</span>
                            {pathname === item.href && (
                                <motion.div layoutId="active" className="ml-auto w-1 h-1 rounded-full bg-indigo-400" />
                            )}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <div className="bg-slate-800/50 rounded-2xl p-4 mb-4">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Expert Assigné</p>
                        <p className="text-sm font-medium text-white">Maître Elara</p>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-all group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Déconnexion</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md flex items-center justify-between px-8 md:justify-end">
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-white">{user?.name || 'Explorateur'}</p>
                            <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Niveau Initié</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-[0_0_10px_rgba(79,70,229,0.3)]">
                            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center font-bold text-indigo-400">
                                {user?.name?.[0] || 'E'}
                            </div>
                        </div>
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}

import { motion } from 'framer-motion';
