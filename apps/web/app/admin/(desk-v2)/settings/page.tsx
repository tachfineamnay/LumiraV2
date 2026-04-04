"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Settings,
    Key,
    Brain,
    Bot,
    Sliders,
    Save,
    RotateCcw,
    Check,
    X,
    AlertCircle,
    Loader2,
    History,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Zap,
    TestTube,
    Info,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface PromptWithMeta {
    key: string;
    value: string;
    version: number;
    isCustom: boolean;
    changedBy?: string;
    updatedAt?: string;
}

interface PromptHistory {
    id: string;
    version: number;
    value: string;
    changedBy?: string;
    comment?: string;
    isActive: boolean;
    createdAt: string;
}

type AIProvider = "gemini" | "openai";

interface AgentProviders {
    SCRIBE: AIProvider;
    GUIDE: AIProvider;
    EDITOR: AIProvider;
    CONFIDANT: AIProvider;
    ONIRIQUE: AIProvider;
    NARRATOR: AIProvider;
}

interface ModelConfig {
    heavyModel: string;
    flashModel: string;
    heavyTemperature: number;
    heavyTopP: number;
    heavyMaxTokens: number;
    flashTemperature: number;
    flashTopP: number;
    flashMaxTokens: number;
    openaiHeavyModel: string;
    openaiFlashModel: string;
    openaiHeavyTemperature: number;
    openaiHeavyTopP: number;
    openaiHeavyMaxTokens: number;
    openaiFlashTemperature: number;
    openaiFlashTopP: number;
    openaiFlashMaxTokens: number;
    agentProviders: AgentProviders;
}

type TabId = "credentials" | "personality" | "agents" | "models";

const AGENT_INFO: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
    SCRIBE: {
        label: "SCRIBE",
        icon: <Sparkles className="w-4 h-4" />,
        description: "Génère la lecture spirituelle principale (PDF)",
    },
    GUIDE: {
        label: "GUIDE",
        icon: <Zap className="w-4 h-4" />,
        description: "Crée le parcours spirituel de 7 jours",
    },
    EDITOR: {
        label: "EDITOR",
        icon: <Bot className="w-4 h-4" />,
        description: "Affine le contenu selon les instructions expert",
    },
    CONFIDANT: {
        label: "CONFIDANT",
        icon: <Brain className="w-4 h-4" />,
        description: "Compagnon spirituel quotidien (chat)",
    },
    ONIRIQUE: {
        label: "ONIRIQUE",
        icon: <Sparkles className="w-4 h-4" />,
        description: "Interprète les rêves (introspection symbolique)",
    },
    NARRATOR: {
        label: "NARRATOR",
        icon: <Zap className="w-4 h-4" />,
        description: "Reformule le texte en script audio (TTS)",
    },
};

// =============================================================================
// COMPONENTS
// =============================================================================

function GlassCard({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`bg-slate-900/50 backdrop-blur-sm border border-white/10 rounded-2xl ${className}`}
        >
            {children}
        </div>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium ${
                active
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </button>
    );
}

function StatusBadge({
    isCustom,
    version,
}: {
    isCustom: boolean;
    version: number;
}) {
    if (!isCustom) {
        return (
            <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400 text-xs">
                Par défaut
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
            Personnalisé (v{version})
        </span>
    );
}

function PromptEditor({
    promptKey,
    prompt,
    defaultValue,
    onSave,
    onReset,
    saving,
}: {
    promptKey: string;
    prompt: PromptWithMeta;
    defaultValue: string;
    onSave: (value: string, comment?: string) => Promise<void>;
    onReset: () => Promise<void>;
    saving: boolean;
}) {
    const [value, setValue] = useState(prompt.value);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<PromptHistory[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [comment, setComment] = useState("");

    const hasChanges = value !== prompt.value;
    const isDifferentFromDefault = value !== defaultValue;

    const loadHistory = async () => {
        if (history.length > 0) {
            setShowHistory(!showHistory);
            return;
        }
        setLoadingHistory(true);
        try {
            const { data } = await api.get(`/expert/settings/prompts/${promptKey}/history`);
            setHistory(data);
            setShowHistory(true);
        } catch (err) {
            console.error("Failed to load history", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const restoreVersion = async (version: number) => {
        try {
            await api.post(`/expert/settings/prompts/${promptKey}/restore/${version}`);
            // Reload history and update value
            const { data: newHistory } = await api.get(
                `/expert/settings/prompts/${promptKey}/history`
            );
            setHistory(newHistory);
            const active = newHistory.find((h: PromptHistory) => h.isActive);
            if (active) {
                setValue(active.value);
            }
        } catch (err) {
            console.error("Failed to restore version", err);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <StatusBadge isCustom={prompt.isCustom} version={prompt.version} />
                <div className="flex items-center gap-2">
                    <button
                        onClick={loadHistory}
                        disabled={loadingHistory}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                        {loadingHistory ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <History className="w-3 h-3" />
                        )}
                        Historique
                    </button>
                </div>
            </div>

            <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full h-64 p-4 bg-slate-800/50 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 resize-y focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                placeholder="Entrez le prompt..."
            />

            <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{value.length} caractères</span>
                {isDifferentFromDefault && (
                    <span className="text-amber-400">Différent de la valeur par défaut</span>
                )}
            </div>

            {hasChanges && (
                <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Note de modification (optionnel)..."
                    className="w-full px-3 py-2 bg-slate-800/30 border border-white/5 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-amber-500/30"
                />
            )}

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onSave(value, comment)}
                    disabled={!hasChanges || saving}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-black font-medium rounded-lg transition-colors text-sm"
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Sauvegarder
                </button>
                {prompt.isCustom && (
                    <button
                        onClick={onReset}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                    </button>
                )}
            </div>

            {/* History Panel */}
            <AnimatePresence>
                {showHistory && history.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-4 p-4 bg-slate-800/30 border border-white/5 rounded-xl space-y-2">
                            <h4 className="text-sm font-medium text-white flex items-center gap-2">
                                <History className="w-4 h-4" />
                                Versions précédentes
                            </h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {history.map((h) => (
                                    <div
                                        key={h.id}
                                        className={`flex items-center justify-between p-2 rounded-lg ${
                                            h.isActive
                                                ? "bg-amber-500/10 border border-amber-500/30"
                                                : "bg-slate-700/30"
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-mono text-white">
                                                    v{h.version}
                                                </span>
                                                {h.isActive && (
                                                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded">
                                                        Actif
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-400 truncate">
                                                {h.comment || "Sans commentaire"} •{" "}
                                                {new Date(h.createdAt).toLocaleDateString("fr-FR")}
                                            </div>
                                        </div>
                                        {!h.isActive && (
                                            <button
                                                onClick={() => restoreVersion(h.version)}
                                                className="px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                                            >
                                                Restaurer
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function AgentAccordion({
    agentKey,
    prompt,
    defaultValue,
    onSave,
    onReset,
    saving,
}: {
    agentKey: string;
    prompt: PromptWithMeta;
    defaultValue: string;
    onSave: (value: string, comment?: string) => Promise<void>;
    onReset: () => Promise<void>;
    saving: boolean;
}) {
    const [expanded, setExpanded] = useState(false);
    const info = AGENT_INFO[agentKey];

    return (
        <GlassCard className="overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                        {info.icon}
                    </div>
                    <div className="text-left">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{info.label}</span>
                            <StatusBadge isCustom={prompt.isCustom} version={prompt.version} />
                        </div>
                        <p className="text-xs text-slate-400">{info.description}</p>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-0 border-t border-white/5">
                            <PromptEditor
                                promptKey={agentKey}
                                prompt={prompt}
                                defaultValue={defaultValue}
                                onSave={onSave}
                                onReset={onReset}
                                saving={saving}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </GlassCard>
    );
}

// =============================================================================
// TABS CONTENT
// =============================================================================

function CredentialsTab() {
    const [testing, setTesting] = useState(false);
    const [testingOpenAI, setTestingOpenAI] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [openaiTestResult, setOpenaiTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [configStatus, setConfigStatus] = useState<{
        vertexConfigured: boolean;
        openaiConfigured: boolean;
        projectId?: string;
    } | null>(null);

    useEffect(() => {
        api.get("/expert/settings/status").then(({ data }) => setConfigStatus(data));
    }, []);

    const testConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const { data } = await api.post("/expert/settings/vertex-test");
            setTestResult(data);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            setTestResult({
                success: false,
                error: error.response?.data?.error || "Erreur de connexion",
            });
        } finally {
            setTesting(false);
        }
    };

    const testOpenAIConnection = async () => {
        setTestingOpenAI(true);
        setOpenaiTestResult(null);
        try {
            const { data } = await api.post("/expert/settings/openai-test");
            setOpenaiTestResult(data);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } } };
            setOpenaiTestResult({
                success: false,
                error: error.response?.data?.error || "Erreur de connexion",
            });
        } finally {
            setTestingOpenAI(false);
        }
    };

    return (
        <div className="space-y-6">
            <GlassCard className="p-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/30 flex items-center justify-center">
                        <Key className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-medium text-white">Clé API Gemini</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            La clé API est configurée via la variable d&apos;environnement{" "}
                            <code className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-400 text-xs">
                                GEMINI_API_KEY
                            </code>
                        </p>

                        <div className="mt-4 flex items-center gap-3">
                            <div
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                    configStatus?.vertexConfigured
                                        ? "bg-emerald-500/10 border border-emerald-500/30"
                                        : "bg-red-500/10 border border-red-500/30"
                                }`}
                            >
                                {configStatus?.vertexConfigured ? (
                                    <>
                                        <Check className="w-4 h-4 text-emerald-400" />
                                        <span className="text-sm text-emerald-400">Configurée</span>
                                    </>
                                ) : (
                                    <>
                                        <X className="w-4 h-4 text-red-400" />
                                        <span className="text-sm text-red-400">Non configurée</span>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={testConnection}
                                disabled={testing}
                                className="flex items-center gap-2 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                            >
                                {testing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <TestTube className="w-4 h-4" />
                                )}
                                Tester la connexion
                            </button>
                        </div>

                        {testResult && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`mt-4 p-3 rounded-lg ${
                                    testResult.success
                                        ? "bg-emerald-500/10 border border-emerald-500/30"
                                        : "bg-red-500/10 border border-red-500/30"
                                }`}
                            >
                                {testResult.success ? (
                                    <div className="flex items-center gap-2 text-emerald-400">
                                        <Check className="w-4 h-4" />
                                        <span className="text-sm">
                                            Connexion réussie ! L&apos;API Gemini est opérationnelle.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2 text-red-400">
                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">{testResult.error}</span>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </GlassCard>

            {/* OpenAI Card */}
            <GlassCard className="p-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center">
                        <Key className="w-6 h-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-medium text-white">Clé API OpenAI</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            La clé API est configurée via la variable d&apos;environnement{" "}
                            <code className="px-1.5 py-0.5 bg-slate-800 rounded text-blue-400 text-xs">
                                OPENAI_API_KEY
                            </code>
                        </p>

                        <div className="mt-4 flex items-center gap-3">
                            <div
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                    configStatus?.openaiConfigured
                                        ? "bg-blue-500/10 border border-blue-500/30"
                                        : "bg-red-500/10 border border-red-500/30"
                                }`}
                            >
                                {configStatus?.openaiConfigured ? (
                                    <>
                                        <Check className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm text-blue-400">Configurée</span>
                                    </>
                                ) : (
                                    <>
                                        <X className="w-4 h-4 text-red-400" />
                                        <span className="text-sm text-red-400">Non configurée</span>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={testOpenAIConnection}
                                disabled={testingOpenAI}
                                className="flex items-center gap-2 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                            >
                                {testingOpenAI ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <TestTube className="w-4 h-4" />
                                )}
                                Tester la connexion
                            </button>
                        </div>

                        {openaiTestResult && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`mt-4 p-3 rounded-lg ${
                                    openaiTestResult.success
                                        ? "bg-blue-500/10 border border-blue-500/30"
                                        : "bg-red-500/10 border border-red-500/30"
                                }`}
                            >
                                {openaiTestResult.success ? (
                                    <div className="flex items-center gap-2 text-blue-400">
                                        <Check className="w-4 h-4" />
                                        <span className="text-sm">
                                            Connexion réussie ! L&apos;API OpenAI est opérationnelle.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2 text-red-400">
                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <span className="text-sm">{openaiTestResult.error}</span>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                </div>
            </GlassCard>

            <GlassCard className="p-4">
                <div className="flex items-start gap-3 text-slate-400">
                    <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">
                        Pour modifier les clés API, mettez à jour les variables d&apos;environnement{" "}
                        <code className="px-1 py-0.5 bg-slate-800 rounded text-xs">GEMINI_API_KEY</code>{" "}
                        et/ou{" "}
                        <code className="px-1 py-0.5 bg-slate-800 rounded text-xs">OPENAI_API_KEY</code>{" "}
                        dans votre configuration de déploiement (Coolify, .env, etc.) puis redémarrez
                        l&apos;API.
                    </p>
                </div>
            </GlassCard>
        </div>
    );
}

function PersonalityTab({
    prompts,
    defaults,
    onSave,
    onReset,
    saving,
}: {
    prompts: Record<string, PromptWithMeta>;
    defaults: Record<string, string>;
    onSave: (key: string, value: string, comment?: string) => Promise<void>;
    onReset: (key: string) => Promise<void>;
    saving: boolean;
}) {
    const dnaPrompt = prompts["LUMIRA_DNA"] || {
        key: "LUMIRA_DNA",
        value: defaults["LUMIRA_DNA"] || "",
        version: 0,
        isCustom: false,
    };

    return (
        <div className="space-y-6">
            <GlassCard className="p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center">
                        <Brain className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">LUMIRA DNA</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            L&apos;ADN de personnalité partagé par tous les agents. Définit le ton, les
                            valeurs et les archétypes Lumira.
                        </p>
                    </div>
                </div>

                <PromptEditor
                    promptKey="LUMIRA_DNA"
                    prompt={dnaPrompt}
                    defaultValue={defaults["LUMIRA_DNA"] || ""}
                    onSave={(value, comment) => onSave("LUMIRA_DNA", value, comment)}
                    onReset={() => onReset("LUMIRA_DNA")}
                    saving={saving}
                />
            </GlassCard>
        </div>
    );
}

function AgentsTab({
    prompts,
    defaults,
    onSave,
    onReset,
    saving,
}: {
    prompts: Record<string, PromptWithMeta>;
    defaults: Record<string, string>;
    onSave: (key: string, value: string, comment?: string) => Promise<void>;
    onReset: (key: string) => Promise<void>;
    saving: boolean;
}) {
    const agentKeys = ["SCRIBE", "GUIDE", "EDITOR", "CONFIDANT"];

    return (
        <div className="space-y-4">
            {agentKeys.map((key) => {
                const prompt = prompts[key] || {
                    key,
                    value: defaults[key] || "",
                    version: 0,
                    isCustom: false,
                };
                return (
                    <AgentAccordion
                        key={key}
                        agentKey={key}
                        prompt={prompt}
                        defaultValue={defaults[key] || ""}
                        onSave={(value, comment) => onSave(key, value, comment)}
                        onReset={() => onReset(key)}
                        saving={saving}
                    />
                );
            })}
        </div>
    );
}

function ModelsTab({
    config,
    onSave,
    saving,
}: {
    config: ModelConfig;
    onSave: (config: Partial<ModelConfig>) => Promise<void>;
    saving: boolean;
}) {
    const [localConfig, setLocalConfig] = useState(config);
    const hasChanges = JSON.stringify(localConfig) !== JSON.stringify(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    const handleChange = (key: keyof ModelConfig, value: string | number) => {
        setLocalConfig((prev) => ({ ...prev, [key]: value }));
    };

    const handleProviderChange = (agent: keyof AgentProviders, provider: AIProvider) => {
        setLocalConfig((prev) => ({
            ...prev,
            agentProviders: { ...prev.agentProviders, [agent]: provider },
        }));
    };

    return (
        <div className="space-y-6">
            {/* Gemini Heavy Model Config */}
            <GlassCard className="p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">Gemini Heavy</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Utilisé par SCRIBE, GUIDE et EDITOR pour les tâches complexes
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Modèle</label>
                        <input
                            type="text"
                            value={localConfig.heavyModel}
                            onChange={(e) => handleChange("heavyModel", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Max Tokens</label>
                        <input
                            type="number"
                            value={localConfig.heavyMaxTokens}
                            onChange={(e) => handleChange("heavyMaxTokens", parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">
                            Temperature ({localConfig.heavyTemperature})
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={localConfig.heavyTemperature}
                            onChange={(e) =>
                                handleChange("heavyTemperature", parseFloat(e.target.value))
                            }
                            className="w-full accent-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">
                            Top P ({localConfig.heavyTopP})
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={localConfig.heavyTopP}
                            onChange={(e) => handleChange("heavyTopP", parseFloat(e.target.value))}
                            className="w-full accent-amber-500"
                        />
                    </div>
                </div>
            </GlassCard>

            {/* Gemini Flash Model Config */}
            <GlassCard className="p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-600/20 border border-cyan-500/30 flex items-center justify-center">
                        <Zap className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">Gemini Flash</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Utilisé par CONFIDANT pour le chat en temps réel
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Modèle</label>
                        <input
                            type="text"
                            value={localConfig.flashModel}
                            onChange={(e) => handleChange("flashModel", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Max Tokens</label>
                        <input
                            type="number"
                            value={localConfig.flashMaxTokens}
                            onChange={(e) =>
                                handleChange("flashMaxTokens", parseInt(e.target.value))
                            }
                            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">
                            Temperature ({localConfig.flashTemperature})
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={localConfig.flashTemperature}
                            onChange={(e) =>
                                handleChange("flashTemperature", parseFloat(e.target.value))
                            }
                            className="w-full accent-cyan-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">
                            Top P ({localConfig.flashTopP})
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={localConfig.flashTopP}
                            onChange={(e) => handleChange("flashTopP", parseFloat(e.target.value))}
                            className="w-full accent-cyan-500"
                        />
                    </div>
                </div>
            </GlassCard>

            {/* OpenAI Heavy Model Config */}
            <GlassCard className="p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">OpenAI Heavy</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Modèle puissant OpenAI pour les tâches complexes (ex: gpt-4o)
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Modèle</label>
                        <input
                            type="text"
                            value={localConfig.openaiHeavyModel}
                            onChange={(e) => handleChange("openaiHeavyModel", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Max Tokens</label>
                        <input
                            type="number"
                            value={localConfig.openaiHeavyMaxTokens}
                            onChange={(e) => handleChange("openaiHeavyMaxTokens", parseInt(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">
                            Temperature ({localConfig.openaiHeavyTemperature})
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={localConfig.openaiHeavyTemperature}
                            onChange={(e) =>
                                handleChange("openaiHeavyTemperature", parseFloat(e.target.value))
                            }
                            className="w-full accent-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">
                            Top P ({localConfig.openaiHeavyTopP})
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={localConfig.openaiHeavyTopP}
                            onChange={(e) => handleChange("openaiHeavyTopP", parseFloat(e.target.value))}
                            className="w-full accent-blue-500"
                        />
                    </div>
                </div>
            </GlassCard>

            {/* OpenAI Flash Model Config */}
            <GlassCard className="p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/30 flex items-center justify-center">
                        <Zap className="w-6 h-6 text-sky-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">OpenAI Flash</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Modèle rapide OpenAI pour le chat et les tâches légères (ex: gpt-4o-mini)
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Modèle</label>
                        <input
                            type="text"
                            value={localConfig.openaiFlashModel}
                            onChange={(e) => handleChange("openaiFlashModel", e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">Max Tokens</label>
                        <input
                            type="number"
                            value={localConfig.openaiFlashMaxTokens}
                            onChange={(e) =>
                                handleChange("openaiFlashMaxTokens", parseInt(e.target.value))
                            }
                            className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500/50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">
                            Temperature ({localConfig.openaiFlashTemperature})
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={localConfig.openaiFlashTemperature}
                            onChange={(e) =>
                                handleChange("openaiFlashTemperature", parseFloat(e.target.value))
                            }
                            className="w-full accent-sky-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-2">
                            Top P ({localConfig.openaiFlashTopP})
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={localConfig.openaiFlashTopP}
                            onChange={(e) => handleChange("openaiFlashTopP", parseFloat(e.target.value))}
                            className="w-full accent-sky-500"
                        />
                    </div>
                </div>
            </GlassCard>

            {/* Per-Agent Provider Selection */}
            <GlassCard className="p-6">
                <div className="flex items-start gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/30 flex items-center justify-center">
                        <Bot className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">Provider par Agent</h3>
                        <p className="text-sm text-slate-400 mt-1">
                            Choisir Gemini ou OpenAI pour chaque agent indépendamment
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {(Object.keys(AGENT_INFO) as Array<keyof typeof AGENT_INFO>).map((agentKey) => {
                        const info = AGENT_INFO[agentKey];
                        const provider = localConfig.agentProviders?.[agentKey as keyof AgentProviders] || "gemini";
                        return (
                            <div
                                key={agentKey}
                                className="flex items-center justify-between p-3 bg-slate-800/30 border border-white/5 rounded-xl"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                                        {info.icon}
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-white">{info.label}</span>
                                        <p className="text-xs text-slate-500">{info.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-white/10">
                                    <button
                                        onClick={() => handleProviderChange(agentKey as keyof AgentProviders, "gemini")}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                            provider === "gemini"
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : "text-slate-500 hover:text-slate-300"
                                        )}
                                    >
                                        Gemini
                                    </button>
                                    <button
                                        onClick={() => handleProviderChange(agentKey as keyof AgentProviders, "openai")}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                                            provider === "openai"
                                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                                : "text-slate-500 hover:text-slate-300"
                                        )}
                                    >
                                        OpenAI
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </GlassCard>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => onSave(localConfig)}
                    disabled={!hasChanges || saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-black font-medium rounded-lg transition-colors"
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    Sauvegarder la configuration
                </button>
            </div>
        </div>
    );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>("credentials");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [prompts, setPrompts] = useState<Record<string, PromptWithMeta>>({});
    const [defaults, setDefaults] = useState<Record<string, string>>({});
    const [modelConfig, setModelConfig] = useState<ModelConfig>({
        heavyModel: "gemini-2.5-flash",
        flashModel: "gemini-2.5-flash",
        heavyTemperature: 0.8,
        heavyTopP: 0.95,
        heavyMaxTokens: 16384,
        flashTemperature: 0.9,
        flashTopP: 0.95,
        flashMaxTokens: 2048,
        openaiHeavyModel: "gpt-4o",
        openaiFlashModel: "gpt-4o-mini",
        openaiHeavyTemperature: 0.8,
        openaiHeavyTopP: 0.95,
        openaiHeavyMaxTokens: 16384,
        openaiFlashTemperature: 0.9,
        openaiFlashTopP: 0.95,
        openaiFlashMaxTokens: 2048,
        agentProviders: {
            SCRIBE: "gemini",
            GUIDE: "gemini",
            EDITOR: "gemini",
            CONFIDANT: "gemini",
            ONIRIQUE: "gemini",
            NARRATOR: "gemini",
        },
    });

    // Load data on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const [promptsRes, defaultsRes, configRes] = await Promise.all([
                    api.get("/expert/settings/prompts"),
                    api.get("/expert/settings/prompts/defaults"),
                    api.get("/expert/settings/model-config"),
                ]);
                setPrompts(promptsRes.data);
                setDefaults(defaultsRes.data);
                setModelConfig(configRes.data);
            } catch (err) {
                console.error("Failed to load settings", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const handleSavePrompt = useCallback(
        async (key: string, value: string, comment?: string) => {
            setSaving(true);
            try {
                await api.put(`/expert/settings/prompts/${key}`, { value, comment });
                // Reload prompts
                const { data } = await api.get("/expert/settings/prompts");
                setPrompts(data);
            } catch (err) {
                console.error("Failed to save prompt", err);
            } finally {
                setSaving(false);
            }
        },
        []
    );

    const handleResetPrompt = useCallback(async (key: string) => {
        setSaving(true);
        try {
            await api.post(`/expert/settings/prompts/${key}/reset`);
            // Reload prompts
            const { data } = await api.get("/expert/settings/prompts");
            setPrompts(data);
        } catch (err) {
            console.error("Failed to reset prompt", err);
        } finally {
            setSaving(false);
        }
    }, []);

    const handleSaveModelConfig = useCallback(async (config: Partial<ModelConfig>) => {
        setSaving(true);
        try {
            await api.put("/expert/settings/model-config", config);
            // Reload config
            const { data } = await api.get("/expert/settings/model-config");
            setModelConfig(data);
        } catch (err) {
            console.error("Failed to save model config", err);
        } finally {
            setSaving(false);
        }
    }, []);

    if (loading) {
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
                    <h1 className="text-2xl font-serif italic text-white">
                        Paramètres IA
                    </h1>
                    <p className="text-sm text-slate-400">
                        Configurer les agents Oracle Lumira
                    </p>
                </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
                <TabButton
                    active={activeTab === "credentials"}
                    onClick={() => setActiveTab("credentials")}
                    icon={<Key className="w-4 h-4" />}
                    label="Credentials"
                />
                <TabButton
                    active={activeTab === "personality"}
                    onClick={() => setActiveTab("personality")}
                    icon={<Brain className="w-4 h-4" />}
                    label="Personnalité"
                />
                <TabButton
                    active={activeTab === "agents"}
                    onClick={() => setActiveTab("agents")}
                    icon={<Bot className="w-4 h-4" />}
                    label="Agents"
                />
                <TabButton
                    active={activeTab === "models"}
                    onClick={() => setActiveTab("models")}
                    icon={<Sliders className="w-4 h-4" />}
                    label="Modèles"
                />
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === "credentials" && <CredentialsTab />}
                    {activeTab === "personality" && (
                        <PersonalityTab
                            prompts={prompts}
                            defaults={defaults}
                            onSave={handleSavePrompt}
                            onReset={handleResetPrompt}
                            saving={saving}
                        />
                    )}
                    {activeTab === "agents" && (
                        <AgentsTab
                            prompts={prompts}
                            defaults={defaults}
                            onSave={handleSavePrompt}
                            onReset={handleResetPrompt}
                            saving={saving}
                        />
                    )}
                    {activeTab === "models" && (
                        <ModelsTab
                            config={modelConfig}
                            onSave={handleSaveModelConfig}
                            saving={saving}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
