"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Mail, Phone, MapPin } from "lucide-react";

export const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="bg-cosmic-deep border-t border-white/5">
            <div className="max-w-7xl mx-auto px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-cosmic-gold/20 border border-cosmic-gold/30 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-cosmic-gold" />
                            </div>
                            <span className="text-xl font-playfair italic text-cosmic-divine">
                                Oracle <span className="text-cosmic-gold">Lumira</span>
                            </span>
                        </div>
                        <p className="text-sm text-cosmic-stardust leading-relaxed">
                            Une fusion entre algorithmes mystiques et résonances stellaires pour cartographier votre vibration originelle.
                        </p>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-cosmic-ethereal mb-4">
                            Contact
                        </h3>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-sm text-cosmic-stardust">
                                <Mail className="w-4 h-4 text-cosmic-gold" />
                                contact@oraclelumira.com
                            </li>
                            <li className="flex items-center gap-3 text-sm text-cosmic-stardust">
                                <Phone className="w-4 h-4 text-cosmic-gold" />
                                +33 1 23 45 67 89
                            </li>
                            <li className="flex items-center gap-3 text-sm text-cosmic-stardust">
                                <MapPin className="w-4 h-4 text-cosmic-gold" />
                                Paris, France
                            </li>
                        </ul>
                    </div>

                    {/* Légal */}
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-cosmic-ethereal mb-4">
                            Légal
                        </h3>
                        <ul className="space-y-3">
                            <li>
                                <Link href="/mentions-legales" className="text-sm text-cosmic-stardust hover:text-cosmic-gold transition-colors">
                                    Mentions légales
                                </Link>
                            </li>
                            <li>
                                <Link href="/confidentialite" className="text-sm text-cosmic-stardust hover:text-cosmic-gold transition-colors">
                                    Politique de confidentialité
                                </Link>
                            </li>
                            <li>
                                <Link href="/cgv" className="text-sm text-cosmic-stardust hover:text-cosmic-gold transition-colors">
                                    Conditions générales de vente
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Copyright */}
                <div className="mt-12 pt-8 border-t border-white/5 text-center">
                    <p className="text-xs text-cosmic-stardust">
                        © {currentYear} Oracle Lumira. Tous droits réservés.
                    </p>
                </div>
            </div>
        </footer>
    );
};
