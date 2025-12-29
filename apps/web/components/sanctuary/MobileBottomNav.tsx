"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Compass, BookOpen, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

// =============================================================================
// MOBILE NAV ITEMS
// =============================================================================

const mobileNavItems = [
    { key: "home", label: "Accueil", icon: Home, route: "/sanctuaire" },
    { key: "chemin", label: "Chemin", icon: Compass, route: "/sanctuaire/path" },
    { key: "tirages", label: "Tirages", icon: BookOpen, route: "/sanctuaire/draws" },
    { key: "oracle", label: "Oracle", icon: MessageCircle, route: "/sanctuaire/chat" },
    { key: "profil", label: "Profil", icon: User, route: "/sanctuaire/profile" },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function MobileBottomNav() {
    const pathname = usePathname();

    return (
        <motion.nav
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        >
            {/* Background */}
            <div className="absolute inset-0 bg-abyss-800/95 backdrop-blur-xl border-t border-white/[0.04]" />

            {/* Nav Items */}
            <div className="relative flex items-center justify-around px-2 py-3 safe-area-pb">
                {mobileNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.route ||
                        (item.route !== "/sanctuaire" && pathname?.startsWith(item.route));
                    const isExactHome = item.route === "/sanctuaire" && pathname === "/sanctuaire";

                    return (
                        <Link
                            key={item.key}
                            href={item.route}
                            className="flex flex-col items-center gap-1 p-2 group"
                        >
                            <div className={`relative p-2 rounded-xl transition-all duration-300 ${isActive || isExactHome
                                    ? "bg-horizon-400/15"
                                    : "group-hover:bg-white/5"
                                }`}>
                                {(isActive || isExactHome) && (
                                    <motion.div
                                        layoutId="mobileNavIndicator"
                                        className="absolute inset-0 bg-gradient-to-br from-horizon-400/20 to-horizon-500/10 rounded-xl border border-horizon-400/20"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}

                                <Icon className={`relative z-10 w-5 h-5 transition-colors duration-300 ${isActive || isExactHome
                                        ? "text-horizon-300"
                                        : "text-stellar-500 group-hover:text-stellar-300"
                                    }`} />
                            </div>

                            <span className={`text-[10px] font-medium transition-colors duration-300 ${isActive || isExactHome
                                    ? "text-horizon-300"
                                    : "text-stellar-500 group-hover:text-stellar-300"
                                }`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </motion.nav>
    );
}
