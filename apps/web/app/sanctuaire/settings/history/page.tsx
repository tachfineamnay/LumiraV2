"use client";

export const dynamic = 'force-dynamic';

import React from "react";
import { Scroll, Construction } from "lucide-react";
import { GlassCard } from "../../../../components/ui/GlassCard";

export default function HistorySettingsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="mb-8">
                <h2 className="text-2xl font-playfair italic text-white">Historique & Demandes</h2>
                <p className="text-stellar-400 text-sm">Vos archives sacrées.</p>
            </div>

            <GlassCard className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                    <Scroll className="w-8 h-8 text-stellar-500" />
                </div>
                <h3 className="text-xl font-playfair text-white mb-2">Bientôt Disponible</h3>
                <p className="text-stellar-400 max-w-md mx-auto">
                    Vos lectures passées et vos demandes spéciales seront bientôt accessibles depuis cet espace dédié.
                </p>
            </GlassCard>
        </div>
    );
}
