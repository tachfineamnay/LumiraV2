"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Settings,
    CloudCog,
    CheckCircle2,
    XCircle,
    Save,
    Loader2,
    Eye,
    EyeOff,
    Sparkles
} from "lucide-react";
import { cn } from "../../../lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface SettingsStatus {
    vertexConfigured: boolean;
}

export default function SettingsPage() {
    const [status, setStatus] = useState<SettingsStatus | null>(null);
    const [credentials, setCredentials] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showCredentials, setShowCredentials] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Fetch current status on mount
    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const token = localStorage.getItem("expert_token");
            const res = await fetch(`${API_URL}/api/expert/settings/status`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (error) {
            console.error("Failed to fetch settings status:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!credentials.trim()) {
            setMessage({ type: "error", text: "Veuillez coller les identifiants JSON." });
            return;
        }

        // Validate JSON format
        try {
            JSON.parse(credentials);
        } catch {
            setMessage({ type: "error", text: "Format JSON invalide. Vérifiez la syntaxe." });
            return;
        }

        setIsSaving(true);
        setMessage(null);

        try {
            const token = localStorage.getItem("expert_token");
            const res = await fetch(`${API_URL}/api/expert/settings/vertex-key`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ credentials }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessage({ type: "success", text: data.message || "Identifiants sauvegardés avec succès!" });
                setCredentials("");
                fetchStatus(); // Refresh status
            } else {
                setMessage({ type: "error", text: data.message || "Erreur lors de la sauvegarde." });
            }
        } catch {
            setMessage({ type: "error", text: "Erreur de connexion au serveur." });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-4"
            >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.3)]">
                    <Settings className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-serif italic text-white">Paramètres</h1>
                    <p className="text-sm text-slate-400">Configuration du système Oracle</p>
                </div>
            </motion.div>

            {/* Section: Connexions Divines */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
            >
                <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-medium text-white">Connexions Divines</h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-amber-400/20 to-transparent" />
                </div>

                {/* Vertex AI Card */}
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
                    {/* Glow Effect */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />

                    <div className="relative z-10 space-y-6">
                        {/* Card Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
                                    <CloudCog className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Google Vertex AI</h3>
                                    <p className="text-sm text-slate-400">Intelligence Artificielle Oracle</p>
                                </div>
                            </div>

                            {/* Status Indicator */}
                            <div className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full border",
                                status?.vertexConfigured
                                    ? "border-emerald-500/30 bg-emerald-500/10"
                                    : "border-rose-500/30 bg-rose-500/10"
                            )}>
                                {status?.vertexConfigured ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <span className="text-sm font-medium text-emerald-400">Connecté</span>
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="w-4 h-4 text-rose-400" />
                                        <span className="text-sm font-medium text-rose-400">Non configuré</span>
                                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shadow-[0_0_10px_rgba(251,113,133,0.5)]" />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Credentials Input */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-300">
                                    Identifiants JSON du compte de service
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowCredentials(!showCredentials)}
                                    className="text-xs text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1"
                                >
                                    {showCredentials ? (
                                        <>
                                            <EyeOff className="w-3 h-3" />
                                            Masquer
                                        </>
                                    ) : (
                                        <>
                                            <Eye className="w-3 h-3" />
                                            Afficher
                                        </>
                                    )}
                                </button>
                            </div>
                            <textarea
                                value={credentials}
                                onChange={(e) => setCredentials(e.target.value)}
                                placeholder='{"type": "service_account", "project_id": "...", ...}'
                                rows={8}
                                className={cn(
                                    "w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-white/10",
                                    "text-sm font-mono text-slate-300 placeholder:text-slate-600",
                                    "focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50",
                                    "resize-none transition-all",
                                    !showCredentials && credentials && "blur-sm hover:blur-none focus:blur-none"
                                )}
                            />
                            <p className="text-xs text-slate-500">
                                Collez le contenu complet du fichier JSON des credentials Google Cloud.
                            </p>
                        </div>

                        {/* Message */}
                        {message && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "px-4 py-3 rounded-xl text-sm",
                                    message.type === "success"
                                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                                        : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                                )}
                            >
                                {message.text}
                            </motion.div>
                        )}

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !credentials.trim()}
                            className={cn(
                                "w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl",
                                "bg-gradient-to-r from-amber-500 to-orange-500",
                                "text-slate-900 font-bold text-sm uppercase tracking-wider",
                                "shadow-[0_0_30px_rgba(245,158,11,0.3)]",
                                "hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] hover:scale-[1.02]",
                                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                                "transition-all duration-300"
                            )}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sauvegarde en cours...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Sauvegarder & Connecter
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.section>
        </div>
    );
}
