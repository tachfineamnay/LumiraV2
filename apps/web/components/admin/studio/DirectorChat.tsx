'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send,
    Sparkles,
    Minimize2,
    Expand,
    Heart,
    Wand2,
    MessageCircle,
    Bot,
    User,
    Loader2,
} from 'lucide-react';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface QuickAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    action: string;
    color: string;
}

interface DirectorChatProps {
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    onQuickAction: (action: string) => void;
    isProcessing: boolean;
}

const quickActions: QuickAction[] = [
    {
        id: 'shorten',
        label: 'Raccourcir',
        icon: <Minimize2 className="w-3.5 h-3.5" />,
        action: 'shorten',
        color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 hover:border-blue-400',
    },
    {
        id: 'mystify',
        label: 'Plus Mystique',
        icon: <Sparkles className="w-3.5 h-3.5" />,
        action: 'mystify',
        color: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 hover:border-purple-400',
    },
    {
        id: 'tone',
        label: 'Corriger Ton',
        icon: <Heart className="w-3.5 h-3.5" />,
        action: 'tone',
        color: 'from-rose-500/20 to-rose-600/20 border-rose-500/30 hover:border-rose-400',
    },
    {
        id: 'expand',
        label: 'Développer',
        icon: <Expand className="w-3.5 h-3.5" />,
        action: 'expand',
        color: 'from-emerald-500/20 to-emerald-600/20 border-emerald-500/30 hover:border-emerald-400',
    },
    {
        id: 'simplify',
        label: 'Simplifier',
        icon: <Wand2 className="w-3.5 h-3.5" />,
        action: 'simplify',
        color: 'from-amber-500/20 to-amber-600/20 border-amber-500/30 hover:border-amber-400',
    },
];

export function DirectorChat({
    messages,
    onSendMessage,
    onQuickAction,
    isProcessing,
}: DirectorChatProps) {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        }
    }, [inputValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isProcessing) return;

        onSendMessage(inputValue.trim());
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gold/20 bg-void-dark/50">
                <div className="p-2 rounded-lg bg-gradient-to-br from-gold/20 to-amber-500/20">
                    <MessageCircle className="w-5 h-5 text-gold" />
                </div>
                <div>
                    <h3 className="font-medium text-divine">Direction IA</h3>
                    <p className="text-xs text-divine/50">Affinez le contenu avec l'Oracle</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="px-3 py-3 border-b border-gold/10 bg-void-dark/30">
                <p className="text-xs text-divine/50 mb-2 px-1">Actions rapides</p>
                <div className="flex flex-wrap gap-2">
                    {quickActions.map((action) => (
                        <button
                            key={action.id}
                            onClick={() => onQuickAction(action.action)}
                            disabled={isProcessing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full 
                                bg-gradient-to-r ${action.color} border text-divine/80 
                                transition-all duration-200 hover:scale-105 hover:text-divine
                                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <AnimatePresence initial={false}>
                    {messages.map((message) => (
                        <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            {/* Avatar */}
                            <div
                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                    message.role === 'assistant'
                                        ? 'bg-gradient-to-br from-gold/30 to-amber-500/30'
                                        : 'bg-gradient-to-br from-blue-500/30 to-indigo-500/30'
                                }`}
                            >
                                {message.role === 'assistant' ? (
                                    <Bot className="w-4 h-4 text-gold" />
                                ) : (
                                    <User className="w-4 h-4 text-blue-400" />
                                )}
                            </div>

                            {/* Message Bubble */}
                            <div
                                className={`flex-1 max-w-[85%] ${
                                    message.role === 'user' ? 'text-right' : ''
                                }`}
                            >
                                <div
                                    className={`inline-block px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                        message.role === 'assistant'
                                            ? 'bg-void-dark border border-gold/20 text-divine/90 rounded-tl-sm'
                                            : 'bg-gradient-to-r from-blue-600/80 to-indigo-600/80 text-white rounded-tr-sm'
                                    }`}
                                >
                                    {/* Simple markdown-like rendering */}
                                    {message.content.split('\n').map((line, i) => (
                                        <React.Fragment key={i}>
                                            {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                                            {i < message.content.split('\n').length - 1 && <br />}
                                        </React.Fragment>
                                    ))}
                                </div>
                                <p className="text-xs text-divine/40 mt-1 px-2">
                                    {formatTime(message.timestamp)}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Processing Indicator */}
                {isProcessing && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3"
                    >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-gold/30 to-amber-500/30">
                            <Bot className="w-4 h-4 text-gold" />
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-sm bg-void-dark border border-gold/20">
                            <Loader2 className="w-4 h-4 text-gold animate-spin" />
                            <span className="text-sm text-divine/60">L'Oracle réfléchit...</span>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form
                onSubmit={handleSubmit}
                className="border-t border-gold/20 bg-void-dark/50 p-3"
            >
                <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Décrivez vos ajustements..."
                            disabled={isProcessing}
                            rows={1}
                            className="w-full px-4 py-2.5 pr-12 bg-void border border-gold/20 rounded-xl 
                                text-divine placeholder-divine/40 text-sm resize-none
                                focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30
                                disabled:opacity-50 disabled:cursor-not-allowed
                                transition-all duration-200"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isProcessing}
                        aria-label="Envoyer le message"
                        title="Envoyer"
                        className="flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-r from-gold to-amber-500 
                            text-void font-medium transition-all duration-200
                            hover:shadow-lg hover:shadow-gold/25 hover:scale-105
                            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-xs text-divine/40 mt-2 px-1">
                    Appuyez sur Entrée pour envoyer, Shift+Entrée pour un retour à la ligne
                </p>
            </form>
        </div>
    );
}
