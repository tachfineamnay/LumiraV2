'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    Eye,
    Edit3,
    Check,
    Shield,
    User,
    Hash,
    Loader2,
    AlertTriangle,
    Undo,
    Redo,
    Copy,
    CheckCheck,
} from 'lucide-react';

interface LiveDocumentProps {
    content: string;
    onChange: (content: string) => void;
    orderNumber: string;
    clientName: string;
    clientRefId?: string;
    onSeal: () => Promise<void>;
    isProcessing: boolean;
}

type ViewMode = 'preview' | 'edit';

export function LiveDocument({
    content,
    onChange,
    orderNumber,
    clientName,
    clientRefId,
    onSeal,
    isProcessing,
}: LiveDocumentProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('preview');
    const [isSealModalOpen, setIsSealModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [undoStack, setUndoStack] = useState<string[]>([]);
    const [redoStack, setRedoStack] = useState<string[]>([]);
    const editorRef = useRef<HTMLTextAreaElement>(null);

    // Handle content changes with undo/redo support
    const handleContentChange = useCallback(
        (newContent: string) => {
            setUndoStack((prev) => [...prev.slice(-19), content]);
            setRedoStack([]);
            onChange(newContent);
        },
        [content, onChange]
    );

    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        const previousContent = undoStack[undoStack.length - 1];
        setUndoStack((prev) => prev.slice(0, -1));
        setRedoStack((prev) => [...prev, content]);
        onChange(previousContent);
    }, [undoStack, content, onChange]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const nextContent = redoStack[redoStack.length - 1];
        setRedoStack((prev) => prev.slice(0, -1));
        setUndoStack((prev) => [...prev, content]);
        onChange(nextContent);
    }, [redoStack, content, onChange]);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [content]);

    // Simple markdown to HTML converter
    const renderMarkdown = (text: string) => {
        return text
            .split('\n\n')
            .map((paragraph, i) => {
                // Headers
                if (paragraph.startsWith('# ')) {
                    return (
                        <h1 key={i} className="text-2xl font-serif font-bold text-gold mb-4">
                            {paragraph.slice(2)}
                        </h1>
                    );
                }
                if (paragraph.startsWith('## ')) {
                    return (
                        <h2 key={i} className="text-xl font-serif font-semibold text-gold/90 mb-3 mt-6">
                            {paragraph.slice(3)}
                        </h2>
                    );
                }
                if (paragraph.startsWith('### ')) {
                    return (
                        <h3 key={i} className="text-lg font-serif font-medium text-gold/80 mb-2 mt-4">
                            {paragraph.slice(4)}
                        </h3>
                    );
                }

                // Lists
                if (paragraph.startsWith('- ') || paragraph.startsWith('* ')) {
                    const items = paragraph.split('\n').filter(Boolean);
                    return (
                        <ul key={i} className="list-disc list-inside space-y-1 mb-4 text-divine/80">
                            {items.map((item, j) => (
                                <li key={j}>{item.replace(/^[-*]\s/, '')}</li>
                            ))}
                        </ul>
                    );
                }

                // Blockquotes
                if (paragraph.startsWith('> ')) {
                    return (
                        <blockquote
                            key={i}
                            className="border-l-4 border-gold/50 pl-4 italic text-divine/70 my-4"
                        >
                            {paragraph.slice(2)}
                        </blockquote>
                    );
                }

                // Horizontal rule
                if (paragraph === '---' || paragraph === '***') {
                    return <hr key={i} className="border-gold/20 my-6" />;
                }

                // Regular paragraph with inline formatting
                let html = paragraph
                    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gold font-semibold">$1</strong>')
                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                    .replace(/`(.+?)`/g, '<code class="bg-void-dark px-1 rounded text-gold/80">$1</code>');

                return (
                    <p
                        key={i}
                        className="text-divine/80 leading-relaxed mb-4"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                );
            });
    };

    const handleSealClick = () => {
        setIsSealModalOpen(true);
    };

    const confirmSeal = async () => {
        setIsSealModalOpen(false);
        await onSeal();
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gold/20 bg-void-dark/50">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                        <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-medium text-divine">{orderNumber}</h3>
                            <span className="text-divine/30">•</span>
                            <div className="flex items-center gap-1 text-divine/60">
                                <User className="w-3.5 h-3.5" />
                                <span className="text-sm">{clientName}</span>
                            </div>
                            {clientRefId && (
                                <>
                                    <span className="text-divine/30">•</span>
                                    <div className="flex items-center gap-1 text-divine/50">
                                        <Hash className="w-3.5 h-3.5" />
                                        <span className="text-xs font-mono">{clientRefId}</span>
                                    </div>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-divine/50">Document de lecture spirituelle</p>
                    </div>
                </div>

                {/* View Mode Toggle & Actions */}
                <div className="flex items-center gap-2">
                    {/* Undo/Redo */}
                    <div className="flex items-center gap-1 mr-2">
                        <button
                            onClick={handleUndo}
                            disabled={undoStack.length === 0}
                            className="p-1.5 rounded-lg text-divine/50 hover:text-divine hover:bg-gold/10 
                                disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Annuler"
                        >
                            <Undo className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={redoStack.length === 0}
                            className="p-1.5 rounded-lg text-divine/50 hover:text-divine hover:bg-gold/10 
                                disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Rétablir"
                        >
                            <Redo className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Copy */}
                    <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-lg text-divine/50 hover:text-divine hover:bg-gold/10 transition-colors"
                        title="Copier le contenu"
                    >
                        {copied ? (
                            <CheckCheck className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>

                    {/* View Mode Toggle */}
                    <div className="flex rounded-lg bg-void border border-gold/20 p-0.5">
                        <button
                            onClick={() => setViewMode('preview')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                viewMode === 'preview'
                                    ? 'bg-gold/20 text-gold'
                                    : 'text-divine/60 hover:text-divine'
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5" />
                            Aperçu
                        </button>
                        <button
                            onClick={() => setViewMode('edit')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                viewMode === 'edit'
                                    ? 'bg-gold/20 text-gold'
                                    : 'text-divine/60 hover:text-divine'
                            }`}
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            Éditer
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto relative">
                {/* Shimmer Loading Overlay */}
                {isProcessing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 bg-void/80 backdrop-blur-sm flex flex-col items-center justify-center"
                    >
                        <div className="w-full max-w-md px-8 space-y-4">
                            {/* Shimmer skeleton lines */}
                            <div className="space-y-3">
                                <div className="h-6 bg-gradient-to-r from-gold/10 via-gold/30 to-gold/10 rounded animate-shimmer" />
                                <div className="h-4 bg-gradient-to-r from-gold/10 via-gold/20 to-gold/10 rounded w-3/4 animate-shimmer animation-delay-100" />
                                <div className="h-4 bg-gradient-to-r from-gold/10 via-gold/20 to-gold/10 rounded w-5/6 animate-shimmer animation-delay-200" />
                                <div className="h-4 bg-gradient-to-r from-gold/10 via-gold/20 to-gold/10 rounded w-2/3 animate-shimmer animation-delay-300" />
                            </div>
                            <div className="flex items-center justify-center gap-3 pt-4">
                                <Loader2 className="w-5 h-5 text-gold animate-spin" />
                                <span className="text-gold/80 text-sm font-medium">L'Oracle affine le texte sacré...</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {viewMode === 'preview' ? (
                    <div className="p-6 md:p-8 max-w-3xl mx-auto">
                        <article className="prose prose-invert prose-gold">
                            {renderMarkdown(content)}
                        </article>
                    </div>
                ) : (
                    <textarea
                        ref={editorRef}
                        value={content}
                        onChange={(e) => handleContentChange(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-full p-6 md:p-8 bg-transparent text-divine/90 font-mono text-sm 
                            leading-relaxed resize-none focus:outline-none disabled:opacity-50"
                        placeholder="Commencez à écrire..."
                    />
                )}
            </div>

            {/* Footer with Seal Button */}
            <div className="border-t border-gold/20 bg-void-dark/50 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="text-xs text-divine/40">
                        {content.split(/\s+/).filter(Boolean).length} mots •{' '}
                        {content.length} caractères
                    </div>
                    <button
                        onClick={handleSealClick}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold
                            bg-gradient-to-r from-emerald-500 to-teal-500 text-white
                            hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-105
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none
                            transition-all duration-200"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Scellement...
                            </>
                        ) : (
                            <>
                                <Shield className="w-4 h-4" />
                                SCELLER (VALIDER)
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Seal Confirmation Modal */}
            {isSealModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-md bg-void-dark border border-gold/30 rounded-2xl p-6 shadow-2xl"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 rounded-full bg-amber-500/20">
                                <AlertTriangle className="w-6 h-6 text-amber-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-divine">
                                Confirmer le Scellement
                            </h3>
                        </div>

                        <p className="text-divine/70 mb-6">
                            Êtes-vous sûr de vouloir sceller ce document ? Cette action validera
                            la lecture et la rendra disponible pour le client{' '}
                            <span className="text-gold font-medium">{clientName}</span>.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsSealModalOpen(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gold/30 text-divine/70
                                    hover:bg-gold/10 hover:text-divine transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmSeal}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                                    bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium
                                    hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                            >
                                <Check className="w-4 h-4" />
                                Confirmer
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
