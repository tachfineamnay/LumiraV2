'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    CheckCircle,
    XCircle,
    FileText,
    Loader2,
    Eye,
    Download,
    RefreshCw,
} from 'lucide-react';
import type { OrderDetails } from './ExpertWorkspace';

// =============================================================================
// TYPES
// =============================================================================

interface CreationEngineProps {
    order: OrderDetails;
    isGenerating: boolean;
    generationResult?: {
        pdfUrl: string;
        archetype: string;
        stepsCreated: number;
    };
    onGenerate: () => Promise<void>;
    onValidate: () => Promise<void>;
    onReject: (reason: string) => Promise<void>;
}

type EngineState = 'pending' | 'generating' | 'preview' | 'completed';

// =============================================================================
// COMPONENT
// =============================================================================

export function CreationEngine({
    order,
    isGenerating,
    generationResult,
    onGenerate,
    onValidate,
    onReject,
}: CreationEngineProps) {
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'preview' | 'content'>('preview');

    // Determine current state
    const getState = (): EngineState => {
        if (isGenerating) return 'generating';
        if (order.status === 'COMPLETED') return 'completed';
        if (order.generatedContent?.pdfUrl || generationResult?.pdfUrl) return 'preview';
        return 'pending';
    };

    const state = getState();
    const pdfUrl = generationResult?.pdfUrl || order.generatedContent?.pdfUrl;
    const archetype = generationResult?.archetype || order.generatedContent?.synthesis?.archetype;

    return (
        <GlassCard className="h-full flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                        Moteur de Création
                    </h3>
                    {archetype && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {archetype}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-5 overflow-hidden">
                <AnimatePresence mode="wait">
                    {state === 'pending' && (
                        <PendingState key="pending" onGenerate={onGenerate} order={order} />
                    )}

                    {state === 'generating' && (
                        <GeneratingState key="generating" />
                    )}

                    {(state === 'preview' || state === 'completed') && pdfUrl && (
                        <PreviewState
                            key="preview"
                            pdfUrl={pdfUrl}
                            order={order}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            state={state}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* Actions */}
            {(state === 'preview' || state === 'completed') && (
                <div className="p-5 border-t border-slate-700/50">
                    {state === 'preview' && (
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRejectModal(true)}
                                className="flex-1 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <XCircle className="w-5 h-5" />
                                Rejeter
                            </button>
                            <button
                                onClick={onValidate}
                                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-medium hover:from-emerald-500 hover:to-emerald-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                <CheckCircle className="w-5 h-5" />
                                Valider & Livrer
                            </button>
                        </div>
                    )}

                    {state === 'completed' && (
                        <div className="text-center py-2">
                            <span className="text-emerald-400 font-medium flex items-center justify-center gap-2">
                                <CheckCircle className="w-5 h-5" />
                                Lecture livrée avec succès
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Rejection Modal */}
            <AnimatePresence>
                {showRejectModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowRejectModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700"
                            onClick={e => e.stopPropagation()}
                        >
                            <h4 className="text-lg font-semibold text-white mb-4">Raison du rejet</h4>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="Expliquez pourquoi cette lecture doit être régénérée..."
                                className="w-full h-32 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setShowRejectModal(false)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => {
                                        onReject(rejectionReason);
                                        setShowRejectModal(false);
                                        setRejectionReason('');
                                    }}
                                    disabled={!rejectionReason.trim()}
                                    className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-medium hover:bg-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Confirmer le rejet
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </GlassCard>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`
      backdrop-blur-xl bg-slate-800/60 
      border border-slate-700/50 
      rounded-xl 
      ${className}
    `}>
            {children}
        </div>
    );
}

function PendingState({ onGenerate, order }: { onGenerate: () => Promise<void>; order: OrderDetails }) {
    const canGenerate = ['PAID', 'PROCESSING'].includes(order.status);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full flex flex-col items-center justify-center text-center"
        >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/10 flex items-center justify-center mb-6 animate-pulse">
                <Sparkles className="w-12 h-12 text-amber-400" />
            </div>

            <h4 className="text-xl font-semibold text-white mb-2">
                Prêt pour la génération
            </h4>
            <p className="text-slate-400 max-w-sm mb-8">
                Cliquez sur le bouton ci-dessous pour déclencher l&apos;Oracle Vertex AI et générer la lecture spirituelle personnalisée.
            </p>

            <button
                onClick={onGenerate}
                disabled={!canGenerate}
                className="group relative px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-bold text-lg hover:from-amber-400 hover:to-amber-500 transition-all shadow-2xl shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span className="relative z-10 flex items-center gap-3">
                    <Sparkles className="w-6 h-6" />
                    GÉNÉRER AVEC L&apos;IA
                </span>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-300 to-amber-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity" />
            </button>

            {!canGenerate && (
                <p className="text-sm text-slate-500 mt-4">
                    Le statut de la commande ne permet pas la génération.
                </p>
            )}
        </motion.div>
    );
}

function GeneratingState() {
    const messages = [
        'Vertex canalise les énergies cosmiques...',
        'Analyse des lignes de vie en cours...',
        'Interprétation des archétypes...',
        'Génération du parcours spirituel...',
        'Création du PDF personnalisé...',
    ];

    const [messageIndex, setMessageIndex] = useState(0);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex(i => (i + 1) % messages.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [messages.length]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full flex flex-col items-center justify-center text-center"
        >
            {/* Mystical Loader */}
            <div className="relative w-32 h-32 mb-8">
                <div className="absolute inset-0 rounded-full border-2 border-amber-400/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-amber-400/40 animate-pulse" />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-amber-400/20 to-amber-600/10 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
                </div>

                {/* Orbiting dots */}
                <div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400" />
                </div>
                <div className="absolute inset-0 animate-[spin_6s_linear_infinite_reverse]">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-500" />
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.p
                    key={messageIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-amber-400 font-medium text-lg"
                >
                    {messages[messageIndex]}
                </motion.p>
            </AnimatePresence>

            <p className="text-slate-500 text-sm mt-4">
                Cette opération peut prendre 30-60 secondes
            </p>
        </motion.div>
    );
}

function PreviewState({
    pdfUrl,
    order,
    activeTab,
    setActiveTab,
    state,
}: {
    pdfUrl: string;
    order: OrderDetails;
    activeTab: 'preview' | 'content';
    setActiveTab: (tab: 'preview' | 'content') => void;
    state: 'preview' | 'completed';
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="h-full flex flex-col"
        >
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                <TabButton
                    active={activeTab === 'preview'}
                    onClick={() => setActiveTab('preview')}
                    icon={<Eye className="w-4 h-4" />}
                    label="Aperçu PDF"
                />
                <TabButton
                    active={activeTab === 'content'}
                    onClick={() => setActiveTab('content')}
                    icon={<FileText className="w-4 h-4" />}
                    label="Contenu"
                />
                <div className="flex-1" />
                <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm"
                >
                    <Download className="w-4 h-4" />
                    Télécharger
                </a>
            </div>

            {/* Content */}
            <div className="flex-1 rounded-xl overflow-hidden border border-slate-700/50">
                {activeTab === 'preview' ? (
                    <iframe
                        src={pdfUrl}
                        className="w-full h-full bg-slate-900"
                        title="PDF Preview"
                    />
                ) : (
                    <div className="h-full overflow-auto p-4 bg-slate-900/50">
                        <ContentPreview order={order} />
                    </div>
                )}
            </div>

            {/* Generation info */}
            {order.generatedContent?.synthesis && (
                <div className="mt-4 p-3 rounded-lg bg-slate-700/30 border border-slate-700/50">
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-400">
                            Archétype: <span className="text-amber-400 font-medium">{order.generatedContent.synthesis.archetype}</span>
                        </span>
                        <span className="text-slate-400">
                            État: <span className="text-slate-300">{order.generatedContent.synthesis.emotional_state}</span>
                        </span>
                        {order.generatedContent.synthesis.keywords && (
                            <span className="text-slate-400">
                                Mots-clés: {order.generatedContent.synthesis.keywords.slice(0, 3).join(', ')}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
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
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors ${active
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-700/30 text-slate-400 hover:bg-slate-700/50'
                }`}
        >
            {icon}
            {label}
        </button>
    );
}

function ContentPreview({ order }: { order: OrderDetails }) {
    const content = order.generatedContent?.pdf_content;

    if (!content) {
        return (
            <div className="text-center text-slate-500 py-8">
                Contenu non disponible
            </div>
        );
    }

    return (
        <div className="prose prose-invert prose-sm max-w-none">
            <h2 className="text-amber-400">{content.archetype_reveal}</h2>
            <p className="text-slate-300">{content.introduction}</p>

            {content.sections?.map((section, i) => (
                <div key={i} className="mt-6">
                    <h3 className="text-white">{section.title}</h3>
                    <p className="text-slate-400">{section.content}</p>
                </div>
            ))}

            {content.karmic_insights && (
                <div className="mt-6">
                    <h3 className="text-white">Révélations Karmiques</h3>
                    <ul className="text-slate-400">
                        {content.karmic_insights.map((insight, i) => (
                            <li key={i}>{insight}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="mt-6">
                <h3 className="text-white">Mission de Vie</h3>
                <p className="text-slate-300">{content.life_mission}</p>
            </div>

            <div className="mt-6">
                <h3 className="text-white">Conclusion</h3>
                <p className="text-slate-300">{content.conclusion}</p>
            </div>
        </div>
    );
}

export default CreationEngine;
