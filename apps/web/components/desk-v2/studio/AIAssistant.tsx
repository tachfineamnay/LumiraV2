'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Sparkles,
  Loader2,
  Wand2,
  MessageSquare,
  Lightbulb,
  RefreshCw,
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
      const { data } = await api.post(`/api/expert/orders/${orderId}/chat`, {
        message: content,
        context: clientContext,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.message || 'Pas de réponse',
        timestamp: new Date(),
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
    <div className="flex flex-col h-full bg-slate-900/30 rounded-xl border border-white/5">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 
                          flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Oracle Assistant</h3>
            <p className="text-xs text-slate-500">IA contextuelle</p>
          </div>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="px-3 py-2 border-b border-white/5">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map(prompt => (
            <button
              key={prompt.label}
              onClick={() => sendMessage(prompt.prompt)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                         bg-slate-800/50 border border-white/5
                         text-xs text-slate-400 hover:text-white hover:border-white/10
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
              <MessageSquare className="w-8 h-8 text-amber-400/50" />
            </div>
            <h4 className="text-sm font-medium text-white mb-1">
              Commencez une conversation
            </h4>
            <p className="text-xs text-slate-500 max-w-[200px]">
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
                    : 'bg-slate-800 text-white border border-white/5'
                  }
                `}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                
                {message.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copier</span>
                    </button>
                    {onInsertText && (
                      <button
                        onClick={() => handleInsert(message.content)}
                        className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Insérer</span>
                      </button>
                    )}
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
            <div className="bg-slate-800 rounded-2xl px-4 py-3 border border-white/5">
              <div className="flex items-center gap-2 text-amber-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">L&apos;Oracle réfléchit...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Posez une question à l'Oracle..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/5
                       text-sm text-white placeholder-slate-500
                       focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
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
