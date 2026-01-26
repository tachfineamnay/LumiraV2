'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, Sparkles, FileText, User, Calendar, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { Order } from '../../lib/types';

interface ContentGeneratorProps {
    selectedOrder: Order | null;
    onProcess: (orderId: string, expertPrompt: string, expertInstructions?: string) => Promise<void>;
}

const levelNames: Record<number, string> = {
    1: 'Initié',
    2: 'Mystique',
    3: 'Profond',
    4: 'Intégrale',
};

const levelColors: Record<number, string> = {
    1: 'from-horizon-400 to-horizon-500',
    2: 'from-serenity-400 to-serenity-500',
    3: 'from-violet-400 to-violet-500',
    4: 'from-emerald-400 to-emerald-500',
};

export function ContentGenerator({ selectedOrder, onProcess }: ContentGeneratorProps) {
    const [expertPrompt, setExpertPrompt] = useState('');
    const [expertInstructions, setExpertInstructions] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!selectedOrder) {
            toast.error('Sélectionnez une commande');
            return;
        }

        if (expertPrompt.length < 10) {
            toast.error('Le prompt doit contenir au moins 10 caractères');
            return;
        }

        setLoading(true);
        try {
            await onProcess(selectedOrder.id, expertPrompt, expertInstructions || undefined);
            toast.success('Commande envoyée à n8n !');
            setExpertPrompt('');
            setExpertInstructions('');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Erreur lors de l\'envoi';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const isReady = expertPrompt.length >= 10;

    if (!selectedOrder) {
        return (
            <div className="glass-desk rounded-2xl p-8">
                <div className="flex flex-col items-center justify-center py-12 text-stellar-500">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-stellar-500" />
                    </div>
                    <p className="text-sm text-center text-stellar-400">
                        Sélectionnez une commande pour<br />
                        générer le contenu
                    </p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-desk rounded-2xl overflow-hidden"
        >
            {/* Header with order info */}
            <div className="p-5 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent">
                <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-stellar-100 font-bold tracking-wide">{selectedOrder.orderNumber}</span>
                    <span className={`px-3 py-1.5 bg-gradient-to-r ${levelColors[selectedOrder.level] || levelColors[1]} rounded-lg text-abyss-900 text-xs font-bold shadow-sm`}>
                        {levelNames[selectedOrder.level] || 'N/A'}
                    </span>
                </div>
                <div className="flex items-center gap-4 text-stellar-400 text-sm">
                    <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {selectedOrder.userName || selectedOrder.userEmail}
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(selectedOrder.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                </div>
            </div>

            {/* Client Profile Info */}
            {selectedOrder.user?.profile && (
                <div className="p-5 border-b border-white/[0.06] bg-serenity-500/5">
                    <h3 className="text-xs font-bold text-serenity-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Profil Client
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs text-stellar-300">
                        {selectedOrder.user.profile.birthDate && (
                            <p><span className="text-stellar-500">Naissance:</span> {selectedOrder.user.profile.birthDate}</p>
                        )}
                        {selectedOrder.user.profile.birthTime && (
                            <p><span className="text-stellar-500">Heure:</span> {selectedOrder.user.profile.birthTime}</p>
                        )}
                        {selectedOrder.user.profile.birthPlace && (
                            <p className="col-span-2"><span className="text-stellar-500">Lieu:</span> {selectedOrder.user.profile.birthPlace}</p>
                        )}
                        {selectedOrder.user.profile.objective && (
                            <p className="col-span-2"><span className="text-stellar-500">Objectif:</span> {selectedOrder.user.profile.objective}</p>
                        )}
                        {selectedOrder.user.profile.specificQuestion && (
                            <p className="col-span-2"><span className="text-stellar-500">Question:</span> {selectedOrder.user.profile.specificQuestion}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Form */}
            <div className="p-5 space-y-5">
                <div>
                    <label className="block text-xs font-bold text-stellar-400 uppercase tracking-wider mb-2">
                        Prompt Expert *
                    </label>
                    <textarea
                        value={expertPrompt}
                        onChange={(e) => setExpertPrompt(e.target.value)}
                        placeholder="Écrivez le prompt personnalisé pour cette lecture..."
                        rows={6}
                        className="w-full px-4 py-3 bg-abyss-600/40 border border-white/[0.06] rounded-xl text-stellar-100 placeholder:text-stellar-600 focus:outline-none focus:border-horizon-500/50 focus:ring-2 focus:ring-horizon-500/20 transition-all resize-none"
                    />
                    <p className="text-xs text-stellar-500 mt-1.5">{expertPrompt.length} caractères (min. 10)</p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-stellar-400 uppercase tracking-wider mb-2">
                        Instructions supplémentaires (optionnel)
                    </label>
                    <textarea
                        value={expertInstructions}
                        onChange={(e) => setExpertInstructions(e.target.value)}
                        placeholder="Instructions spécifiques pour le modèle IA..."
                        rows={3}
                        className="w-full px-4 py-3 bg-abyss-600/40 border border-white/[0.06] rounded-xl text-stellar-100 placeholder:text-stellar-600 focus:outline-none focus:border-horizon-500/50 focus:ring-2 focus:ring-horizon-500/20 transition-all resize-none"
                    />
                </div>

                <motion.button
                    onClick={handleSubmit}
                    disabled={loading || !isReady}
                    whileHover={{ scale: isReady ? 1.02 : 1 }}
                    whileTap={{ scale: isReady ? 0.98 : 1 }}
                    className={`
                        relative w-full py-4 rounded-xl font-bold text-base
                        flex items-center justify-center gap-2.5
                        transition-all duration-300
                        disabled:cursor-not-allowed
                        ${isReady && !loading
                            ? 'bg-gradient-to-r from-horizon-400 via-horizon-500 to-horizon-400 text-abyss-900 shadow-gold-glow hover:shadow-gold-glow-lg btn-pulse'
                            : 'bg-abyss-600/60 text-stellar-500 border border-white/[0.06]'
                        }
                    `}
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Génération en cours...</span>
                        </>
                    ) : (
                        <>
                            <Wand2 className="w-5 h-5" />
                            <span>Générer la Lecture</span>
                            {isReady && (
                                <Sparkles className="w-4 h-4 absolute right-4 animate-pulse" />
                            )}
                        </>
                    )}
                </motion.button>
            </div>
        </motion.div>
    );
}
