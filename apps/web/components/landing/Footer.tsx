"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowUpRight } from "lucide-react";

export const Footer = () => {
    const currentYear = new Date().getFullYear();

    const navLinks = [
        { name: 'Niveaux', href: '#niveaux' },
        { name: 'Manifesto', href: '#comment-ca-marche' },
        { name: 'Témoignages', href: '#temoignages' },
        { name: 'Connexion', href: '/sanctuaire' },
    ];

    const legalLinks = [
        { name: 'Mentions légales', href: '/mentions-legales' },
        { name: 'Confidentialité', href: '/confidentialite' },
        { name: 'CGV', href: '/cgv' },
    ];

    return (
        <footer className="relative bg-void border-t border-white/5 pt-32 pb-12 overflow-hidden">
            {/* Background Noise */}
            <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none"></div>

            <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-24 mb-32">

                    {/* Brand - Large */}
                    <div className="md:col-span-2">
                        <Link href="/" className="group inline-block mb-8">
                            <span className="font-playfair italic text-3xl md:text-5xl text-white group-hover:text-cosmic-gold transition-colors duration-500">
                                Oracle Lumira
                            </span>
                        </Link>
                        <p className="text-white/40 text-lg font-light leading-relaxed max-w-sm">
                            Architecture vibratoire et cartographie de l'âme par algorithmes sacrés.
                        </p>
                    </div>

                    {/* Navigation - Minimal List */}
                    <div>
                        <span className="text-white/20 text-[10px] uppercase tracking-[0.2em] font-bold block mb-8">Navigation</span>
                        <ul className="space-y-4">
                            {navLinks.map(link => (
                                <li key={link.name}>
                                    <Link href={link.href} className="text-white/60 hover:text-white transition-colors text-sm font-medium tracking-wide flex items-center gap-2 group">
                                        {link.name}
                                        <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Connect - Minimal List */}
                    <div>
                        <span className="text-white/20 text-[10px] uppercase tracking-[0.2em] font-bold block mb-8">Connect</span>
                        <ul className="space-y-4">
                            <li>
                                <a href="mailto:contact@oraclelumira.com" className="text-white/60 hover:text-white transition-colors text-sm font-medium tracking-wide">
                                    contact@oraclelumira.com
                                </a>
                            </li>
                            <li>
                                <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-medium tracking-wide">
                                    Instagram
                                </a>
                            </li>
                            <li>
                                <a href="#" className="text-white/60 hover:text-white transition-colors text-sm font-medium tracking-wide">
                                    Twitter / X
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar - Technical Look */}
                <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-end gap-6 text-[10px] font-mono text-white/30 uppercase tracking-widest">
                    <div className="flex flex-col gap-2">
                        <span>© {currentYear} Lumira Systems Inc.</span>
                        <span>All rights reserved.</span>
                    </div>

                    <div className="flex gap-8">
                        {legalLinks.map(link => (
                            <Link key={link.name} href={link.href} className="hover:text-white transition-colors">
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span>System Operational</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};
