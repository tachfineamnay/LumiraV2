'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    ClipboardList,
    CheckCircle2,
    History,
    Users,
    LogOut,
    Shield,
    BarChart3,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();

    // Don't apply layout to login page
    if (pathname === '/admin/login') {
        return <>{children}</>;
    }

    const menuItems = [
        { name: 'Commandes', href: '/admin/orders', icon: ClipboardList },
        { name: 'Validations', href: '/admin/validations', icon: CheckCircle2 },
        { name: 'Historique', href: '/admin/history', icon: History },
        { name: 'Clients', href: '/admin/clients', icon: Users },
    ];

    const handleLogout = () => {
        localStorage.removeItem('expert_token');
        localStorage.removeItem('expert_refresh_token');
        localStorage.removeItem('expert_user');
        if (logout) logout();
        router.push('/admin/login');
    };

    return (
        <div className="flex min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/10 bg-white/5 backdrop-blur-xl hidden md:flex flex-col">
                <div className="p-6">
                    <Link href="/admin/orders" className="flex items-center gap-3 group">
                        <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg shadow-amber-500/30"
                        >
                            <Shield className="w-5 h-5" />
                        </motion.div>
                        <div>
                            <span className="text-lg font-bold tracking-tight text-white">Expert Desk</span>
                            <p className="text-[10px] text-amber-400/80 uppercase tracking-wider">Oracle Lumira</p>
                        </div>
                    </Link>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                                    isActive
                                        ? "bg-white/10 text-white border border-white/20"
                                        : "text-white/60 hover:text-white hover:bg-white/5"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute left-0 w-1 h-8 bg-amber-500 rounded-r-full"
                                    />
                                )}
                                <item.icon className={cn(
                                    "w-5 h-5 transition-colors",
                                    isActive ? "text-amber-400" : "text-white/40 group-hover:text-amber-400/80"
                                )} />
                                <span className="font-medium">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Stats link */}
                <div className="px-4 mb-2">
                    <Link
                        href="/admin"
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                            pathname === '/admin' && !pathname?.includes('/admin/')
                                ? "bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-white border border-amber-500/30"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                        )}
                    >
                        <BarChart3 className="w-5 h-5 text-amber-400" />
                        <span className="font-medium">Dashboard</span>
                    </Link>
                </div>

                {/* User & Logout */}
                <div className="p-4 border-t border-white/10">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg">
                            {user?.name?.[0] || 'E'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{user?.name || 'Expert'}</p>
                            <p className="text-[10px] text-amber-400 uppercase tracking-wider">
                                {user?.role || 'Expert'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-white/60 hover:text-rose-400 hover:bg-rose-400/10 transition-all group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Déconnexion</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {/* Header */}
                <header className="h-16 border-b border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
                    <div className="flex items-center gap-2 text-amber-400">
                        <Shield className="w-5 h-5" />
                        <span className="text-sm font-bold uppercase tracking-wider">Expert Mode</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-white">{user?.name || 'Admin'}</p>
                            <p className="text-[10px] text-amber-400 uppercase tracking-wider">Grand Maître</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-bold text-white shadow-lg shadow-amber-500/20">
                            {user?.name?.[0] || 'A'}
                        </div>
                    </div>
                </header>

                {/* Content */}
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
