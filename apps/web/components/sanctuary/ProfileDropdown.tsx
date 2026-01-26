"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { User, ChevronDown, BookOpen, Plus, LogOut, Settings } from "lucide-react";
import { LevelBadge } from "../ui/LevelBadge";
import { useSanctuaireAuth } from "../../context/SanctuaireAuthContext";

interface ProfileDropdownProps {
    userLevel?: 1 | 2 | 3 | 4;
}

export const ProfileDropdown = ({ userLevel = 1 }: ProfileDropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const { user, logout } = useSanctuaireAuth();

    const menuItems = [
        { label: "Mon Profil", icon: User, route: "/sanctuaire/profile" },
        { label: "Mes Lectures", icon: BookOpen, route: "/sanctuaire/draws" },
        { label: "Nouvelle Lecture", icon: Plus, route: "/commande" },
    ];

    const handleLogout = () => {
        if (logout) logout();
        router.push("/");
    };

    const displayName = user ? `${user.firstName} ${user.lastName}` : "Explorateur";
    const initials = user?.firstName?.[0] || "E";

    return (
        <div className="relative">
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors"
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-horizon-400/30 to-amber-600/20 border border-horizon-400/50 flex items-center justify-center">
                    <span className="text-sm font-bold text-horizon-400">
                        {initials}
                    </span>
                </div>
                <span className="text-sm font-medium text-stellar-200 hidden md:block">
                    {displayName}
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-stellar-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Dropdown */}
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute right-0 mt-2 w-64 z-50 rounded-xl bg-abyss-700/95 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden"
                        >
                            {/* User Info */}
                            <div className="p-4 border-b border-white/5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-horizon-400/30 to-amber-600/20 border border-horizon-400/50 flex items-center justify-center">
                                        <span className="text-sm font-bold text-horizon-400">
                                            {initials}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-stellar-200">
                                            {displayName}
                                        </p>
                                        <p className="text-xs text-stellar-500">
                                            {user?.email || "email@exemple.com"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-stellar-500 uppercase tracking-wider">Niveau:</span>
                                    <LevelBadge level={userLevel} />
                                </div>
                            </div>

                            {/* Menu Items */}
                            <div className="p-2">
                                {menuItems.map((item) => (
                                    <motion.button
                                        key={item.label}
                                        whileHover={{ x: 4 }}
                                        onClick={() => {
                                            router.push(item.route);
                                            setIsOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-stellar-400 hover:bg-white/5 hover:text-stellar-200 transition-colors text-sm"
                                    >
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </motion.button>
                                ))}
                            </div>

                            {/* Logout */}
                            <div className="p-2 border-t border-white/5">
                                <motion.button
                                    whileHover={{ x: 4 }}
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-rose-400 hover:bg-rose-400/10 transition-colors text-sm"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Déconnexion
                                </motion.button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
