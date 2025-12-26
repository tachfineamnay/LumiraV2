"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Menu, X } from "lucide-react";

export const Header = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { label: "Niveaux", href: "#niveaux" },
        { label: "Témoignages", href: "#temoignages" },
        { label: "Contact", href: "#contact" },
    ];

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled
                    ? "bg-cosmic-void/80 backdrop-blur-xl border-b border-white/5"
                    : "bg-transparent"
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <motion.div
                        whileHover={{ rotate: 180 }}
                        transition={{ duration: 0.5 }}
                        className="w-8 h-8 rounded-lg bg-cosmic-gold/20 border border-cosmic-gold/30 flex items-center justify-center"
                    >
                        <Sparkles className="w-4 h-4 text-cosmic-gold" />
                    </motion.div>
                    <span className="text-xl font-playfair italic text-cosmic-divine group-hover:text-cosmic-gold transition-colors">
                        Oracle <span className="text-cosmic-gold">Lumira</span>
                    </span>
                </Link>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            className="text-sm text-cosmic-ethereal hover:text-cosmic-gold transition-colors font-medium"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* CTA Button */}
                <div className="hidden md:block">
                    <Link
                        href="/sanctuaire"
                        className="px-6 py-2 rounded-full border border-cosmic-gold/50 text-cosmic-gold text-sm font-medium hover:bg-cosmic-gold/10 transition-colors"
                    >
                        Connexion
                    </Link>
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-2 text-cosmic-ethereal"
                >
                    {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="md:hidden bg-cosmic-deep/95 backdrop-blur-xl border-t border-white/5"
                >
                    <div className="p-6 space-y-4">
                        {navLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="block text-cosmic-ethereal hover:text-cosmic-gold transition-colors font-medium py-2"
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Link
                            href="/sanctuaire"
                            className="block w-full text-center px-6 py-3 rounded-full border border-cosmic-gold/50 text-cosmic-gold text-sm font-medium hover:bg-cosmic-gold/10 transition-colors mt-4"
                        >
                            Connexion
                        </Link>
                    </div>
                </motion.div>
            )}
        </header>
    );
};
