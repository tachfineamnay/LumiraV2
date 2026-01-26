"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
    Settings,
    Scroll,
    CreditCard,
    Shield,
    ArrowLeft,
} from "lucide-react";

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const tabs = [
        {
            label: "Historique",
            icon: Scroll,
            href: "/sanctuaire/settings/history",
            color: "text-purple-400"
        },
        {
            label: "Abonnement",
            icon: CreditCard,
            href: "/sanctuaire/settings/billing",
            color: "text-amber-400"
        },
        {
            label: "Sécurité",
            icon: Shield,
            href: "/sanctuaire/settings/security",
            color: "text-rose-400"
        },
    ];

    return (
        <div className="min-h-screen bg-[#0B0F19] text-stellar-100 flex flex-col md:flex-row">

            {/* DESKTOP SIDEBAR */}
            <aside className="hidden md:flex flex-col w-72 border-r border-white/5 bg-abyss-800/30 min-h-screen fixed left-0 top-0 pt-24 px-4">
                <div className="mb-8 px-4">
                    <h1 className="text-xl font-playfair italic text-white flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                            <Settings className="w-4 h-4" />
                        </span>
                        Réglages
                    </h1>
                    <p className="text-xs text-stellar-500 mt-2 pl-10">
                        Gérez vos paramètres et préférences.
                    </p>
                </div>

                {/* Back to Profile Link */}
                <Link href="/sanctuaire/profile" className="mb-4 px-4">
                    <div className="flex items-center gap-2 text-stellar-400 hover:text-horizon-300 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" />
                        Retour au profil
                    </div>
                </Link>

                <nav className="space-y-2">
                    {tabs.map((tab) => {
                        const isActive = pathname === tab.href;
                        return (
                            <Link key={tab.href} href={tab.href}>
                                <div className={`relative flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${isActive
                                        ? "bg-white/5 text-white border border-white/10 shadow-lg"
                                        : "text-stellar-400 hover:bg-white/5 hover:text-stellar-200"
                                    }`}>
                                    <div className="flex items-center gap-3">
                                        <tab.icon className={`w-5 h-5 ${isActive ? tab.color : "opacity-50"}`} />
                                        <span className="font-medium text-sm">{tab.label}</span>
                                    </div>
                                    {isActive && (
                                        <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-current" />
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* MOBILE HEADER */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-abyss-800/95 backdrop-blur-xl border-b border-white/5 px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                    <Link href="/sanctuaire/profile" className="flex items-center gap-2 text-stellar-400 text-sm">
                        <ArrowLeft className="w-4 h-4" />
                        Profil
                    </Link>
                    <h1 className="text-lg font-playfair italic text-white flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Réglages
                    </h1>
                    <div className="w-16" /> {/* Spacer */}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
                    {tabs.map((tab) => {
                        const isActive = pathname === tab.href;
                        return (
                            <Link key={tab.href} href={tab.href}>
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-sm transition-all ${isActive
                                        ? "bg-white/10 text-white border border-white/10"
                                        : "text-stellar-400 hover:bg-white/5"
                                    }`}>
                                    <tab.icon className={`w-4 h-4 ${isActive ? tab.color : ""}`} />
                                    <span>{tab.label}</span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* MAIN CONTENT WRAPPER */}
            <main className="flex-1 md:pl-72 w-full max-w-5xl mx-auto">
                {/* Scrollable Container */}
                <div className="p-4 md:p-8 pt-32 md:pt-8 min-h-screen pb-24 md:pb-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
