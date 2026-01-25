"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
    User,
    Activity,
    Scroll,
    CreditCard,
    Shield,
    ChevronRight
} from "lucide-react";

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const tabs = [
        {
            label: "Mon Dossier",
            icon: User,
            href: "/sanctuaire/settings/general",
            color: "text-horizon-400"
        },
        {
            label: "Diagnostic",
            icon: Activity,
            href: "/sanctuaire/settings/diagnostic",
            color: "text-emerald-400"
        },
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
                            ⚙️
                        </span>
                        Paramètres
                    </h1>
                    <p className="text-xs text-stellar-500 mt-2 pl-10">
                        Gérez votre expérience spirituelle.
                    </p>
                </div>

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

            {/* MAIN CONTENT WRAPPER */}
            <main className="flex-1 md:pl-72 w-full max-w-5xl mx-auto">
                {/* Scrollable Container */}
                <div className="p-4 md:p-8 pt-24 md:pt-8 min-h-screen pb-24 md:pb-8">
                    {children}
                </div>
            </main>

            {/* MOBILE TAB BAR (Fixed Bottom) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-abyss-800/90 backdrop-blur-xl border-t border-white/10 z-50 px-4 py-2 flex items-center justify-between overflow-x-auto no-scrollbar pb-safe-area">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href;
                    return (
                        <Link key={tab.href} href={tab.href} className="flex-1 min-w-[70px]">
                            <div className={`flex flex-col items-center gap-1 py-1 px-1 rounded-lg transition-colors ${isActive ? "text-white" : "text-stellar-600"
                                }`}>
                                <div className={`p-1.5 rounded-full ${isActive ? "bg-white/10" : ""}`}>
                                    <tab.icon className={`w-5 h-5 ${isActive ? tab.color : "opacity-50"}`} />
                                </div>
                                <span className="text-[10px] font-medium truncate w-full text-center">
                                    {tab.label}
                                </span>
                            </div>
                        </Link>
                    );
                })}
            </nav>

        </div>
    );
}
