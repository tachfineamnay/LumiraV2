'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    MessageCircle,
    Sparkles,
    Check,
    Lock,
    Plus,
    Send,
    Bot,
} from 'lucide-react';
import type { SpiritualPathData, ChatSessionData, OrderDetails } from './ExpertWorkspace';

// =============================================================================
// TYPES
// =============================================================================

interface ClientContinuumProps {
    spiritualPath?: SpiritualPathData;
    chatSession?: ChatSessionData;
    order: OrderDetails;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ClientContinuum({ spiritualPath, chatSession, order }: ClientContinuumProps) {
    const [activeTab, setActiveTab] = useState<'timeline' | 'chat'>('timeline');

    return (
        <GlassCard className="h-full flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-slate-700/50">
                <TabButton
                    active={activeTab === 'timeline'}
                    onClick={() => setActiveTab('timeline')}
                    icon={<Calendar className="w-4 h-4" />}
                    label="Timeline"
                />
                <TabButton
                    active={activeTab === 'chat'}
                    onClick={() => setActiveTab('chat')}
                    icon={<MessageCircle className="w-4 h-4" />}
                    label="Oracle Chat"
                    badge={chatSession?.messages?.length}
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    {activeTab === 'timeline' ? (
                        <TimelinePanel key="timeline" spiritualPath={spiritualPath} />
                    ) : (
                        <ChatPanel key="chat" chatSession={chatSession} order={order} />
                    )}
                </AnimatePresence>
            </div>
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

function TabButton({
    active,
    onClick,
    icon,
    label,
    badge,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    badge?: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 text-sm transition-colors relative ${active
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-300'
                }`}
        >
            {icon}
            {label}
            {badge && badge > 0 && (
                <span className="absolute top-2 right-4 w-5 h-5 rounded-full bg-amber-500 text-slate-900 text-xs flex items-center justify-center font-medium">
                    {badge}
                </span>
            )}
        </button>
    );
}

// =============================================================================
// TIMELINE PANEL
// =============================================================================

function TimelinePanel({ spiritualPath }: { spiritualPath?: SpiritualPathData }) {
    if (!spiritualPath || !spiritualPath.steps?.length) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-center p-6"
            >
                <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-slate-500" />
                </div>
                <h4 className="text-slate-300 font-medium mb-2">Pas de timeline</h4>
                <p className="text-slate-500 text-sm">
                    Générez une lecture pour créer le parcours 30 jours.
                </p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col"
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-700/30">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                        {spiritualPath.steps.filter(s => s.isCompleted).length} / {spiritualPath.steps.length} étapes
                    </span>
                    <button className="p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors" title="Ajouter une étape">
                        <Plus className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Steps List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {spiritualPath.steps.map((step) => (
                    <StepCard key={step.id} step={step} />
                ))}
            </div>
        </motion.div>
    );
}

function StepCard({
    step,
}: {
    step: SpiritualPathData['steps'][0];
}) {
    const isLocked = !step.unlockedAt;
    const isCompleted = step.isCompleted;

    const actionIcons: Record<string, string> = {
        MANTRA: '🕉️',
        RITUAL: '🕯️',
        JOURNALING: '📝',
        MEDITATION: '🧘',
        REFLECTION: '💭',
    };

    return (
        <div
            className={`p-3 rounded-xl border transition-colors ${isCompleted
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : isLocked
                    ? 'bg-slate-800/30 border-slate-700/30 opacity-60'
                    : 'bg-slate-700/30 border-slate-600/30 hover:border-amber-500/30'
                }`}
        >
            <div className="flex items-start gap-3">
                {/* Day Number */}
                <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCompleted
                        ? 'bg-emerald-500 text-white'
                        : isLocked
                            ? 'bg-slate-700 text-slate-500'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                >
                    {isCompleted ? <Check className="w-4 h-4" /> : isLocked ? <Lock className="w-3 h-3" /> : step.dayNumber}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs">{actionIcons[step.actionType] || '✨'}</span>
                        <h5 className="text-sm font-medium text-white truncate">{step.title}</h5>
                    </div>
                    {!isLocked && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{step.description}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// CHAT PANEL
// =============================================================================

function ChatPanel({
    chatSession,
    order,
}: {
    chatSession?: ChatSessionData;
    order: OrderDetails;
}) {
    const [message, setMessage] = useState('');
    const messages = chatSession?.messages || [];

    const handleSend = () => {
        if (!message.trim()) return;
        // TODO: Implement send message
        console.log('Send:', message);
        setMessage('');
    };

    const handleAiSuggest = () => {
        // TODO: Implement AI suggestion
        console.log('AI Suggest');
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col"
        >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4">
                            <MessageCircle className="w-8 h-8 text-slate-500" />
                        </div>
                        <h4 className="text-slate-300 font-medium mb-2">Chat Oracle</h4>
                        <p className="text-slate-500 text-sm">
                            Communiquez avec {order.user.firstName} via l&apos;Oracle.
                        </p>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <MessageBubble key={i} message={msg} />
                    ))
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-700/30">
                <div className="flex gap-2 mb-2">
                    <button
                        onClick={handleAiSuggest}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex items-center gap-2 text-xs"
                    >
                        <Sparkles className="w-3 h-3" />
                        AI Suggest
                    </button>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Votre message..."
                        className="flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500/50"
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!message.trim()}
                        className="px-4 py-2 rounded-xl bg-amber-500 text-slate-900 hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Envoyer le message"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

function MessageBubble({
    message,
}: {
    message: ChatSessionData['messages'][0];
}) {
    const isUser = message.role === 'user';
    const isExpert = message.role === 'expert';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl ${isUser
                    ? 'bg-slate-700 text-white rounded-br-md'
                    : isExpert
                        ? 'bg-amber-500/20 text-amber-100 border border-amber-500/30 rounded-bl-md'
                        : 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-100 border border-amber-500/30 rounded-bl-md'
                    }`}
            >
                {!isUser && (
                    <div className="flex items-center gap-1.5 mb-1">
                        {message.role === 'assistant' ? (
                            <Bot className="w-3 h-3 text-amber-400" />
                        ) : (
                            <span className="text-xs">👤</span>
                        )}
                        <span className="text-xs text-amber-400/80">
                            {message.role === 'assistant' ? 'Oracle' : 'Expert'}
                        </span>
                    </div>
                )}
                <p className="text-sm">{message.content}</p>
                <span className="text-xs opacity-50 mt-1 block">
                    {new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>
    );
}

export default ClientContinuum;
