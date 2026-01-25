"use client";

export const dynamic = 'force-dynamic';

import React from "react";
import { Lock, Download, Trash2, AlertTriangle } from "lucide-react";
import { GlassCard } from "../../../../components/ui/GlassCard";

export default function SecuritySettingsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="mb-8">
                <h2 className="text-2xl font-playfair italic text-white">Sécurité & Confidentialité</h2>
                <p className="text-stellar-400 text-sm">Protégez votre compte et vos données personnelles.</p>
            </div>

            {/* PASSWORD */}
            <GlassCard className="p-8">
                <h3 className="text-lg font-playfair text-white mb-6 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-horizon-400" /> Mot de passe
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                    <div className="space-y-2">
                        <label className="text-xs text-stellar-400">Mot de passe actuel</label>
                        <input type="password" className="w-full bg-abyss-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-horizon-400 outline-none" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-stellar-400">Nouveau mot de passe</label>
                        <input type="password" className="w-full bg-abyss-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-horizon-400 outline-none" />
                    </div>
                    <div className="col-span-full">
                        <button className="px-6 py-2.5 rounded-xl bg-white/5 text-white hover:bg-white/10 border border-white/10 transition-colors">
                            Mettre à jour
                        </button>
                    </div>
                </div>
            </GlassCard>

            {/* DATA & PRIVACY */}
            <GlassCard className="p-8">
                <h3 className="text-lg font-playfair text-white mb-6 flex items-center gap-2">
                    <Download className="w-5 h-5 text-purple-400" /> Mes Données (GDPR)
                </h3>
                <p className="text-stellar-400 text-sm mb-6">
                    Téléchargez une copie de toutes les données personnelles que nous conservons à votre sujet.
                </p>
                <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 transition-colors">
                    <Download className="w-4 h-4" />
                    Télécharger l'archive
                </button>
            </GlassCard>

            {/* DANGER ZONE */}
            <div className="p-8 rounded-2xl border border-rose-500/20 bg-rose-500/5">
                <h3 className="text-lg font-playfair text-rose-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" /> Zone de Danger
                </h3>
                <p className="text-rose-300/60 text-sm mb-6">
                    La suppression de votre compte est irréversible. Toutes vos données seront effacées.
                </p>
                <button className="px-6 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Supprimer mon compte
                </button>
            </div>
        </div>
    );
}
