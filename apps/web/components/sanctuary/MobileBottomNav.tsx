"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Compass, BookOpen, MessageCircle, Layers } from "lucide-react";
import { motion } from "framer-motion";

// =============================================================================
// MOBILE NAVIGATION ITEMS
// =============================================================================

interface MobileNavItem {
    key: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    route: string;
}

const mobileNavItems: MobileNavItem[] = [
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
            {/* Background blur */}
            <div className="absolute inset-0 bg-cosmos-deep/90 backdrop-blur-xl border-t border-white/10" />

            {/* Navigation items */}
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
                                    ? "bg-dawn-gold/20"
                                    : "group-hover:bg-white/5"
                                }`}>
                                {/* Active indicator */}
                                {(isActive || isExactHome) && (
                                    <motion.div
                                        layoutId="mobileNavIndicator"
                                        className="absolute inset-0 bg-gradient-to-br from-dawn-gold/20 to-dawn-amber/10 rounded-xl border border-dawn-gold/30"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}

                                <Icon className={`relative z-10 w-5 h-5 transition-colors duration-300 ${isActive || isExactHome
                                        ? "text-dawn-gold"
                                        : "text-star-dim group-hover:text-star-silver"
                                    }`} />
                            </div>

                            <span className={`text-[10px] font-medium transition-colors duration-300 ${isActive || isExactHome
                                    ? "text-dawn-amber"
                                    : "text-star-dim group-hover:text-star-silver"
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
