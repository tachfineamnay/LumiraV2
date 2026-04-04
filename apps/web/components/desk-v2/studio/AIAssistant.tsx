'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Send,
  Sparkles,
  Loader2,
  Wand2,
  MessageSquare,
  Copy,
  Check,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestedEdit?: string; // AI-suggested content to insert
}

interface AIAssistantProps {
  orderId: string;
  clientContext?: {
    firstName: string;
    birthDate?: string;
    question?: string;
    objective?: string;
  };
  onInsertText?: (text: string) => void;
}

const QUICK_PROMPTS = [
  { icon: '🔮', label: 'Archétype', prompt: 'Décris l\'archétype dominant de ce client' },
  { icon: '⚡', label: 'Forces', prompt: 'Quelles sont les forces principales à mettre en avant ?' },
  { icon: '🌙', label: 'Défis', prompt: 'Quels défis karmiques ce client doit-il surmonter ?' },
  { icon: '✨', label: 'Mission', prompt: 'Quelle est la mission de vie de ce client ?' },
  { icon: '🕯️', label: 'Rituel', prompt: 'Propose un rituel personnalisé pour ce client' },
  { icon: '💫', label: 'Mantra', prompt: 'Crée un mantra puissant pour ce client' },
];

export function AIAssistant({ orderId, clientContext, onInsertText }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data } = await api.post(`/expert/orders/${orderId}/chat`, {
        message: content,
        context: clientContext,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || 'Pas de réponse',
        timestamp: new Date(),
        suggestedEdit: data.suggestedEdit || null, // Capture suggested edit from API
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast.error('Erreur de communication avec l\'Oracle');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, messageId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(messageId);
    toast.success('Copié dans le presse-papier');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = (text: string) => {
    onInsertText?.(text);
    toast.success('Texte inséré dans l\'éditeur');
  };

  return (
    <div className="flex flex-col h-full bg-desk-surface rounded-xl border border-desk-border">
      {/* Header */}
      <div className="px-4 py-3 border-b border-desk-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 
                          flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-desk-text">Oracle Assistant</h3>
            <p className="text-xs text-desk-subtle">IA contextuelle</p>
          </div>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="px-3 py-2 border-b border-desk-border">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map(prompt => (
            <button
              key={prompt.label}
              onClick={() => sendMessage(prompt.prompt)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                         bg-desk-card border border-desk-border
                         text-xs text-desk-muted hover:text-desk-text hover:border-desk-border
                         transition-colors disabled:opacity-50"
            >
              <span>{prompt.icon}</span>
              <span>{prompt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-amber-600/50" />
            </div>
            <h4 className="text-sm font-medium text-desk-text mb-1">
              Commencez une conversation
            </h4>
            <p className="text-xs text-desk-subtle max-w-[200px]">
              Posez une question ou utilisez les suggestions rapides ci-dessus
            </p>
          </div>
        ) : (
          messages.map(message => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[85%] rounded-2xl px-4 py-2.5
                  ${message.role === 'user'
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-desk-card text-desk-text border border-desk-border'
                  }
                `}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                
                {message.role === 'assistant' && (
                  <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-desk-border">
                    {/* Suggested edit highlight */}
                    {message.suggestedEdit && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-2">
                        <p className="text-xs text-amber-600 font-medium mb-1">💡 Suggestion à insérer:</p>
                        <p className="text-xs text-desk-muted line-clamp-3">{message.suggestedEdit.substring(0, 150)}...</p>
                        <button
                          onClick={() => handleInsert(message.suggestedEdit!)}
                          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg
                                     bg-amber-500 text-slate-900 text-xs font-bold
                                     hover:bg-amber-400 transition-colors"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>Insérer cette suggestion</span>
                        </button>
                      </div>
                    )}
                    
                    {/* Standard actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(message.content, message.id)}
                        className="flex items-center gap-1 text-xs text-desk-muted hover:text-desk-text transition-colors"
                      >
                        {copiedId === message.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>Copier</span>
                      </button>
                      {onInsertText && !message.suggestedEdit && (
                        <button
                          onClick={() => handleInsert(message.content)}
                          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-500 transition-colors"
                        >
                          <Wand2 className="w-3 h-3" />
                          <span>Insérer</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-desk-card rounded-2xl px-4 py-3 border border-desk-border">
              <div className="flex items-center gap-2 text-amber-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">L&apos;Oracle réfléchit...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-desk-border">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Posez une question à l'Oracle..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-desk-card border border-desk-border
                       text-sm text-desk-text placeholder-desk-subtle
                       focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            title="Envoyer"
            className="p-2.5 rounded-xl bg-amber-500 text-slate-900
                       hover:bg-amber-400 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
