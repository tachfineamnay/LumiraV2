"use client";

export const dynamic = 'force-dynamic';

import React, { useState } from "react";
import { CreditCard, ExternalLink, Check, Zap } from "lucide-react";
import { GlassCard } from "../../../../components/ui/GlassCard";
import axios from "axios";

export default function BillingSettingsPage() {
    const [isLoading, setIsLoading] = useState(false);

    const handleManageSubscription = async () => {
        setIsLoading(true);
        try {
            // Mock API call to get portal URL
            // const { data } = await axios.post("/api/stripe/create-portal-session");
            // window.location.href = data.url;

            // Simulation
            setTimeout(() => {
                alert("Redirection vers le portail Stripe...");
                setIsLoading(false);
            }, 1000);
        } catch (error) {
            console.error(error);
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="mb-8">
                <h2 className="text-2xl font-playfair italic text-white">Abonnement</h2>
                <p className="text-stellar-400 text-sm">Gérez votre formule et vos moyens de paiement.</p>
            </div>

            <GlassCard className="p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-horizon-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Plan Initié</h3>
                            <p className="text-horizon-400 text-sm">Actif • Renouvellement le 12 Fév. 2026</p>
                        </div>
                    </div>
                    <button
                        onClick={handleManageSubscription}
                        disabled={isLoading}
                        className="bg-white text-abyss-900 px-6 py-2.5 rounded-xl font-medium hover:bg-horizon-100 transition-colors flex items-center gap-2"
                    >
                        {isLoading ? "Chargement..." : "Gérer l'abonnement"}
                        <ExternalLink className="w-4 h-4" />
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2 text-sm text-stellar-300">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Accès illimité au feed</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-stellar-300">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Support prioritaire</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-stellar-300">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Contenus exclusifs</span>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
