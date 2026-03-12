"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from "react";
import { Volume2, Check, Loader2 } from "lucide-react";
import { GlassCard } from "../../../../components/ui/GlassCard";
import api from "../../../../lib/api";

type VoiceOption = "FEMININE" | "MASCULINE";

export default function PreferencesPage() {
    const [selectedVoice, setSelectedVoice] = useState<VoiceOption>("FEMININE");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load current preference
    useEffect(() => {
        api.get("/api/client/profile")
            .then((res) => {
                const voice = res.data?.profile?.preferredVoice;
                if (voice === "MASCULINE" || voice === "FEMININE") {
                    setSelectedVoice(voice);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const handleVoiceChange = async (voice: VoiceOption) => {
        setSelectedVoice(voice);
        setSaving(true);
        setSaved(false);
        try {
            await api.patch("/api/client/voice-preference", { voice });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch {
            // Revert on error
            setSelectedVoice(selectedVoice);
        } finally {
            setSaving(false);
        }
    };

    const voices: { value: VoiceOption; label: string; description: string }[] = [
        {
            value: "FEMININE",
            label: "Voix Féminine",
            description: "Douce et enveloppante, idéale pour la méditation",
        },
        {
            value: "MASCULINE",
            label: "Voix Masculine",
            description: "Grave et apaisante, pour une écoute profonde",
        },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="mb-8">
                <h2 className="text-2xl font-playfair italic text-white">Préférences</h2>
                <p className="text-stellar-400 text-sm">Personnalisez votre expérience spirituelle.</p>
            </div>

            {/* VOICE PREFERENCE */}
            <GlassCard className="p-8">
                <h3 className="text-lg font-playfair text-white mb-2 flex items-center gap-2">
                    <Volume2 className="w-5 h-5 text-serenity-400" /> La Voix du Guide
                </h3>
                <p className="text-stellar-400 text-sm mb-6">
                    Choisissez la voix qui accompagnera vos lectures audio et méditations.
                </p>

                {loading ? (
                    <div className="flex items-center gap-2 text-stellar-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Chargement...</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                        {voices.map((voice) => {
                            const isSelected = selectedVoice === voice.value;
                            return (
                                <button
                                    key={voice.value}
                                    onClick={() => handleVoiceChange(voice.value)}
                                    disabled={saving}
                                    className={`relative p-5 rounded-xl border text-left transition-all ${
                                        isSelected
                                            ? "bg-serenity-500/10 border-serenity-400/40 ring-1 ring-serenity-400/20"
                                            : "bg-abyss-900/50 border-white/10 hover:border-white/20 hover:bg-abyss-800/50"
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <span className={`text-sm font-medium ${isSelected ? "text-serenity-300" : "text-stellar-200"}`}>
                                                {voice.label}
                                            </span>
                                            <p className="text-xs text-stellar-500 mt-1">{voice.description}</p>
                                        </div>
                                        {isSelected && (
                                            <div className="w-5 h-5 rounded-full bg-serenity-400/20 flex items-center justify-center flex-shrink-0 ml-2">
                                                {saving ? (
                                                    <Loader2 className="w-3 h-3 text-serenity-400 animate-spin" />
                                                ) : (
                                                    <Check className="w-3 h-3 text-serenity-400" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {saved && (
                    <p className="text-serenity-400 text-xs mt-4 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Préférence enregistrée
                    </p>
                )}

                <p className="text-stellar-600 text-xs mt-4">
                    Ce choix s&apos;appliquera à vos prochaines lectures générées.
                </p>
            </GlassCard>
        </div>
    );
}
