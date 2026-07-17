'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, MessageCircle, Send } from 'lucide-react';
import sanctuaireApi from '../../../lib/sanctuaireApi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function normalizeHistory(messages: unknown): Message[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(
      (message): message is { role: 'user' | 'assistant'; content: string; timestamp?: string } =>
        Boolean(message) &&
        typeof message === 'object' &&
        ((message as { role?: string }).role === 'user' ||
          (message as { role?: string }).role === 'assistant') &&
        typeof (message as { content?: unknown }).content === 'string',
    )
    .map((message, index) => ({
      id: `${message.timestamp || 'history'}-${index}`,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
    }));
}

export default function GuidancePage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    sanctuaireApi
      .get('/client/chat/history')
      .then(({ data }) => {
        if (!active) return;
        setSessionId(data.sessionId || null);
        setMessages(normalizeHistory(data.messages));
      })
      .catch(() => {
        if (active)
          setError(
            'Votre historique n’est pas disponible pour le moment. Vous pouvez tout de même envoyer un nouvel éclairage.',
          );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  const send = async () => {
    const content = input.trim();
    if (!content || isSending) return;
    const optimistic: Message = {
      id: `local-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((current) => [...current, optimistic]);
    setInput('');
    setError(null);
    setIsSending(true);
    try {
      const { data } = await sanctuaireApi.post('/client/chat', { message: content, sessionId });
      if (data.sessionId) setSessionId(data.sessionId);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        },
      ]);
    } catch {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setInput(content);
      setError('Votre demande n’a pas pu être envoyée. Vérifiez votre connexion puis réessayez.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="shrink-0 rounded-3xl border border-white/[0.08] bg-abyss-600/50 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-horizon-400/15 text-horizon-300">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-300">
              Sanctuaire Lumira
            </p>
            <h1 className="mt-1 font-playfair text-2xl italic text-stellar-100">
              Demander un éclairage
            </h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-stellar-400">
          Une question sur votre lecture ou une situation particulière ? Décrivez-la simplement ici.
        </p>
      </header>

      <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-abyss-600/50">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="grid min-h-[240px] place-items-center">
              <Loader2 className="h-7 w-7 animate-spin text-horizon-300" />
            </div>
          ) : messages.length === 0 ? (
            <p className="mx-auto mt-12 max-w-md text-center text-sm leading-6 text-stellar-500">
              Vos échanges seront conservés ici pour vous permettre de reprendre une réflexion quand
              vous le souhaitez.
            </p>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${message.role === 'user' ? 'rounded-br-sm bg-horizon-400/15 text-stellar-100' : 'rounded-bl-sm bg-white/[0.05] text-stellar-300'}`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <time className="mt-2 block text-right text-[10px] text-stellar-600">
                      {message.timestamp.toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          )}
          {isSending && (
            <div className="mt-4 flex items-center gap-2 text-xs text-stellar-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Votre éclairage est en cours de
              préparation…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/[0.06] p-3 sm:p-4">
          {error && (
            <p
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-200"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-white/[0.1] bg-abyss-700 p-2 focus-within:border-horizon-400/50">
            <label className="sr-only" htmlFor="guidance-message">
              Votre question
            </label>
            <textarea
              id="guidance-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Décrivez votre question ou votre situation…"
              rows={2}
              disabled={isSending}
              className="min-h-[48px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-stellar-100 placeholder:text-stellar-600 outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || isSending}
              aria-label="Envoyer ma demande d’éclairage"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-horizon-400 text-abyss-900 hover:bg-horizon-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
