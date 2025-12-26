'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader2, Eye, FileText, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Order {
    id: string;
    orderNumber: string;
    userName: string | null;
    userEmail: string;
    level: number;
    status: string;
    generatedContent?: {
        lecture?: string;
        audio?: string;
        mandala?: string;
        rituals?: string[];
        generatedAt?: string;
    };
    revisionCount?: number;
}

interface ContentValidatorProps {
    selectedOrder: Order | null;
    onValidate: (orderId: string, action: 'approve' | 'reject', notes?: string, reason?: string) => Promise<void>;
}

const levelNames: Record<number, string> = {
    1: 'Initié',
    2: 'Mystique',
    3: 'Profond',
    4: 'Intégrale',
};

export function ContentValidator({ selectedOrder, onValidate }: ContentValidatorProps) {
    const [loading, setLoading] = useState(false);
    const [action, setAction] = useState<'approve' | 'reject' | null>(null);
    const [validationNotes, setValidationNotes] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [showContent, setShowContent] = useState(false);

    const handleValidate = async (selectedAction: 'approve' | 'reject') => {
        if (!selectedOrder) return;

        if (selectedAction === 'reject' && !rejectionReason) {
            toast.error('Veuillez indiquer la raison du rejet');
            return;
        }

        setLoading(true);
        setAction(selectedAction);

        try {
            await onValidate(
                selectedOrder.id,
                selectedAction,
                validationNotes || undefined,
                rejectionReason || undefined
            );
            toast.success(selectedAction === 'approve' ? 'Lecture approuvée !' : 'Lecture rejetée - Régénération lancée');
            setValidationNotes('');
            setRejectionReason('');
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Erreur lors de la validation';
            toast.error(message);
        } finally {
            setLoading(false);
            setAction(null);
        }
    };

    if (!selectedOrder) {
        return (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
                <div className="flex flex-col items-center justify-center py-12 text-white/40">
                    <FileText className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm text-center">
                        Sélectionnez une commande pour<br />
                        valider le contenu
                    </p>
                </div>
            </div>
        );
    }

    const content = selectedOrder.generatedContent;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden"
        >
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-white font-bold">{selectedOrder.orderNumber}</span>
                    <div className="flex items-center gap-2">
                        {selectedOrder.revisionCount && selectedOrder.revisionCount > 0 && (
                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-full text-xs">
                                Rev. {selectedOrder.revisionCount}
                            </span>
                        )}
                        <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg text-white text-xs font-bold">
                            {levelNames[selectedOrder.level]}
                        </span>
                    </div>
                </div>
                <p className="text-white/60 text-sm">{selectedOrder.userName || selectedOrder.userEmail}</p>
            </div>

            {/* Content Preview */}
            <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        Contenu Généré
                    </h3>
                    <button
                        onClick={() => setShowContent(!showContent)}
                        className="text-xs text-white/60 hover:text-white flex items-center gap-1 transition-colors"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        {showContent ? 'Masquer' : 'Afficher'}
                    </button>
                </div>

                {content ? (
                    <div className={`${showContent ? 'max-h-96' : 'max-h-24'} overflow-y-auto transition-all`}>
                        {content.lecture && (
                            <div className="bg-white/5 rounded-xl p-4 mb-3">
                                <h4 className="text-xs font-bold text-white/60 mb-2">Lecture</h4>
                                <p className="text-white/80 text-sm whitespace-pre-wrap">{content.lecture}</p>
                            </div>
                        )}
                        {content.audio && (
                            <div className="bg-white/5 rounded-xl p-4 mb-3">
                                <h4 className="text-xs font-bold text-white/60 mb-2">Audio</h4>
                                <audio controls className="w-full">
                                    <source src={content.audio} type="audio/mpeg" />
                                </audio>
                            </div>
                        )}
                        {content.mandala && (
                            <div className="bg-white/5 rounded-xl p-4 mb-3">
                                <h4 className="text-xs font-bold text-white/60 mb-2">Mandala</h4>
                                <Image
                                    src={content.mandala}
                                    alt="Mandala"
                                    width={400}
                                    height={400}
                                    className="max-w-full h-auto rounded-lg"
                                />
                            </div>
                        )}
                        {content.generatedAt && (
                            <p className="text-xs text-white/40 mt-2">
                                Généré le {new Date(content.generatedAt).toLocaleString('fr-FR')}
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-white/40 text-sm italic">Aucun contenu généré</p>
                )}
            </div>

            {/* Validation Form */}
            <div className="p-4 space-y-4">
                <div>
                    <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                        Notes de validation (optionnel)
                    </label>
                    <textarea
                        value={validationNotes}
                        onChange={(e) => setValidationNotes(e.target.value)}
                        placeholder="Commentaires sur le contenu..."
                        rows={2}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                        Raison du rejet (si rejet)
                    </label>
                    <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Expliquez pourquoi le contenu doit être régénéré..."
                        rows={2}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/20 transition-all resize-none"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <motion.button
                        onClick={() => handleValidate('reject')}
                        disabled={loading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="py-3 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {loading && action === 'reject' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <XCircle className="w-5 h-5" />
                        )}
                        Rejeter
                    </motion.button>

                    <motion.button
                        onClick={() => handleValidate('approve')}
                        disabled={loading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {loading && action === 'approve' ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <CheckCircle className="w-5 h-5" />
                        )}
                        Approuver
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
}
