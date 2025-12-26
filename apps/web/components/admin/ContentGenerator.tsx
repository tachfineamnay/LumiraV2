'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, Sparkles, FileText, User, Calendar } from 'lucide-react';
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

    if (!selectedOrder) {
        return (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                <div className="flex flex-col items-center justify-center py-12 text-white/40">
                    <FileText className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm text-center">
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
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
        >
            {/* Header with order info */}
            <div className="p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-white font-bold">{selectedOrder.orderNumber}</span>
                    <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg text-white text-xs font-bold">
                        {levelNames[selectedOrder.level] || 'N/A'}
                    </span>
                </div>
                <div className="flex items-center gap-4 text-white/60 text-sm">
                    <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {selectedOrder.userName || selectedOrder.userEmail}
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(selectedOrder.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                </div>
            </div>

            {/* Client Profile Info */}
            {selectedOrder.user?.profile && (
                <div className="p-4 border-b border-white/10 bg-purple-500/5">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">
                        <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                        Profil Client
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
                        {selectedOrder.user.profile.birthDate && (
                            <p><span className="text-white/40">Naissance:</span> {selectedOrder.user.profile.birthDate}</p>
                        )}
                        {selectedOrder.user.profile.birthTime && (
                            <p><span className="text-white/40">Heure:</span> {selectedOrder.user.profile.birthTime}</p>
                        )}
                        {selectedOrder.user.profile.birthPlace && (
                            <p className="col-span-2"><span className="text-white/40">Lieu:</span> {selectedOrder.user.profile.birthPlace}</p>
                        )}
                        {selectedOrder.user.profile.objective && (
                            <p className="col-span-2"><span className="text-white/40">Objectif:</span> {selectedOrder.user.profile.objective}</p>
                        )}
                        {selectedOrder.user.profile.specificQuestion && (
                            <p className="col-span-2"><span className="text-white/40">Question:</span> {selectedOrder.user.profile.specificQuestion}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Form */}
            <div className="p-4 space-y-4">
                <div>
                    <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                        Prompt Expert *
                    </label>
                    <textarea
                        value={expertPrompt}
                        onChange={(e) => setExpertPrompt(e.target.value)}
                        placeholder="Écrivez le prompt personnalisé pour cette lecture..."
                        rows={6}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
                    />
                    <p className="text-xs text-white/40 mt-1">{expertPrompt.length} caractères (min. 10)</p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                        Instructions supplémentaires (optionnel)
                    </label>
                    <textarea
                        value={expertInstructions}
                        onChange={(e) => setExpertInstructions(e.target.value)}
                        placeholder="Instructions spécifiques pour le modèle IA..."
                        rows={3}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
                    />
                </div>

                <motion.button
                    onClick={handleSubmit}
                    disabled={loading || expertPrompt.length < 10}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Envoi en cours...
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            Générer la Lecture
                        </>
                    )}
                </motion.button>
            </div>
        </motion.div>
    );
}
