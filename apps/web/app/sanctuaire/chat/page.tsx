'use client';

export const dynamic = 'force-dynamic';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  X,
} from 'lucide-react';
import sanctuaireApi from '../../../lib/sanctuaireApi';

type RequestStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'WAITING_EXPERT'
  | 'WAITING_CLIENT'
  | 'RESOLVED'
  | 'ARCHIVED';

type RequestCategory = 'READING_CLARIFICATION' | 'PERSONAL_SITUATION' | 'TECHNICAL_HELP' | 'OTHER';

interface GuidanceMessage {
  id: string;
  senderType: 'CLIENT' | 'EXPERT';
  senderName?: string | null;
  content: string;
  createdAt: string;
}

interface GuidanceRequest {
  id: string;
  subject: string;
  status: RequestStatus;
  category: RequestCategory;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  assignedExpert?: { id: string; name: string } | null;
  relatedReading?: { id: string; orderNumber?: string | null } | null;
  unreadCount: number;
  messageCount: number;
  lastSender?: 'CLIENT' | 'EXPERT' | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messages?: GuidanceMessage[];
}

interface ReadingOption {
  id: string;
  orderNumber: string;
  title: string;
}

const CATEGORY_OPTIONS: Array<{ value: RequestCategory; label: string }> = [
  { value: 'READING_CLARIFICATION', label: 'Comprendre un passage de ma lecture' },
  { value: 'PERSONAL_SITUATION', label: 'Éclairer une situation personnelle' },
  { value: 'TECHNICAL_HELP', label: 'Accès, PDF ou audio' },
  { value: 'OTHER', label: 'Autre demande' },
];

export default function GuidancePage() {
  const [requests, setRequests] = useState<GuidanceRequest[]>([]);
  const [selected, setSelected] = useState<GuidanceRequest | null>(null);
  const [readings, setReadings] = useState<ReadingOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<RequestCategory>('READING_CLARIFICATION');
  const [relatedOrderId, setRelatedOrderId] = useState('');

  const loadDetail = useCallback(async (requestId: string) => {
    setIsDetailLoading(true);
    setError(null);
    try {
      const { data } = await sanctuaireApi.get(`/client/requests/${requestId}`);
      setSelected(data);
      await sanctuaireApi.post(`/client/requests/${requestId}/read`).catch(() => undefined);
      setRequests((current) =>
        current.map((item) => (item.id === requestId ? { ...item, unreadCount: 0 } : item)),
      );
    } catch {
      setError('Cette demande ne peut pas être chargée pour le moment.');
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [requestsResponse, readingsResponse] = await Promise.all([
        sanctuaireApi.get('/client/requests'),
        sanctuaireApi.get('/client/readings'),
      ]);
      const requestList: GuidanceRequest[] = requestsResponse.data?.data || [];
      const readingList: ReadingOption[] = (readingsResponse.data?.readings || []).map(
        (reading: { id: string; orderNumber: string; title: string }) => ({
          id: reading.id,
          orderNumber: reading.orderNumber,
          title: reading.title,
        }),
      );
      setRequests(requestList);
      setReadings(readingList);
    } catch {
      setError(
        'Vos demandes ne peuvent pas être chargées. Vérifiez votre connexion puis réessayez.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createRequest = async () => {
    if (subject.trim().length < 3 || content.trim().length < 10 || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      const { data } = await sanctuaireApi.post('/client/requests', {
        subject: subject.trim(),
        content: content.trim(),
        category,
        priority: 'NORMAL',
        relatedOrderId: relatedOrderId || undefined,
      });
      setRequests((current) => [data, ...current.filter((item) => item.id !== data.id)]);
      setSelected(data);
      setSubject('');
      setContent('');
      setRelatedOrderId('');
      setCategory('READING_CLARIFICATION');
      setShowComposer(false);
    } catch {
      setError('Votre demande n’a pas pu être créée. Votre texte est conservé pour réessayer.');
    } finally {
      setIsCreating(false);
    }
  };

  const sendReply = async () => {
    const message = reply.trim();
    if (!selected || !message || isSending || selected.status === 'ARCHIVED') return;
    setIsSending(true);
    setError(null);
    try {
      const { data } = await sanctuaireApi.post(`/client/requests/${selected.id}/messages`, {
        content: message,
      });
      setSelected(data);
      setRequests((current) =>
        current
          .map((item) => (item.id === data.id ? { ...item, ...data, messages: undefined } : item))
          .sort(
            (left, right) =>
              new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime(),
          ),
      );
      setReply('');
    } catch {
      setError('Votre message n’a pas pu être envoyé. Votre texte est conservé.');
    } finally {
      setIsSending(false);
    }
  };

  const status = selected ? statusPresentation(selected.status) : null;
  const selectedMessages = useMemo(() => selected?.messages || [], [selected]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-3 py-5 pb-28 sm:px-6 sm:py-8 lg:pb-8">
      <header className="rounded-3xl border border-ivoire-500/[0.06] glass-aube p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-ivoire-400/10 text-ivoire-400">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ivoire-400">
                Sanctuaire Lumira
              </p>
              <h1 className="mt-1 font-playfair text-2xl italic text-ivoire-100">
                Demander un éclairage
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-brume-200">
                Votre demande est transmise à l’équipe Lumira et reste liée à votre dossier. Il ne
                s’agit pas d’une réponse automatique.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowComposer(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-horizon-400 px-4 py-2 text-sm font-semibold text-abyss-900 hover:bg-horizon-300"
          >
            <Plus className="h-4 w-4" /> Nouvelle demande
          </button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {showComposer && (
        <section className="mt-4 rounded-3xl border border-ivoire-400/20 bg-brume-800/40 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-playfair text-xl italic text-ivoire-100">Nouvelle demande</h2>
              <p className="mt-1 text-xs text-brume-300">Décrivez un seul sujet clairement.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              aria-label="Fermer le formulaire"
              className="grid h-10 w-10 place-items-center rounded-xl text-brume-200 hover:bg-brume-800/25"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-ivoire-200">
              Type de demande
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as RequestCategory)}
                className="mt-2 w-full rounded-xl border border-ivoire-500/[0.08] bg-abyss-700 px-3 py-3 text-ivoire-100 outline-none focus:border-horizon-400/50"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-ivoire-200">
              Lecture concernée, facultatif
              <select
                value={relatedOrderId}
                onChange={(event) => setRelatedOrderId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-ivoire-500/[0.08] bg-abyss-700 px-3 py-3 text-ivoire-100 outline-none focus:border-horizon-400/50"
              >
                <option value="">Aucune lecture précise</option>
                {readings.map((reading) => (
                  <option key={reading.id} value={reading.id}>
                    {reading.orderNumber} — {reading.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block text-sm text-ivoire-200">
            Sujet
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={120}
              placeholder="Ex. Comprendre le passage sur ma mission"
              className="mt-2 w-full rounded-xl border border-ivoire-500/[0.08] bg-abyss-700 px-3 py-3 text-ivoire-100 placeholder:text-brume-400 outline-none focus:border-horizon-400/50"
            />
          </label>
          <label className="mt-4 block text-sm text-ivoire-200">
            Votre message
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              maxLength={5000}
              placeholder="Expliquez ce que vous souhaitez clarifier et le contexte utile."
              className="mt-2 w-full resize-y rounded-xl border border-ivoire-500/[0.08] bg-abyss-700 px-3 py-3 text-ivoire-100 placeholder:text-brume-400 outline-none focus:border-horizon-400/50"
            />
          </label>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void createRequest()}
              disabled={subject.trim().length < 3 || content.trim().length < 10 || isCreating}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-horizon-400 px-5 py-2 text-sm font-semibold text-abyss-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Envoyer à l’équipe
            </button>
          </div>
        </section>
      )}

      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.55fr)]">
        <aside
          className={`overflow-hidden rounded-3xl border border-ivoire-500/[0.06] glass-aube ${
            selected ? 'hidden lg:block' : 'block'
          }`}
        >
          <div className="border-b border-ivoire-500/[0.05] px-4 py-3">
            <h2 className="text-sm font-semibold text-ivoire-200">Mes demandes</h2>
          </div>
          {isLoading ? (
            <RequestListSkeleton />
          ) : requests.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="mx-auto h-7 w-7 text-brume-400" />
              <p className="mt-3 text-sm text-brume-300">Aucune demande pour le moment.</p>
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-ivoire-500/[0.08] px-4 text-sm text-ivoire-200 hover:bg-brume-800/25"
              >
                <Plus className="h-4 w-4" /> Créer ma première demande
              </button>
            </div>
          ) : (
            <div className="max-h-[calc(100dvh-17rem)] divide-y divide-ivoire-500/[0.05] overflow-y-auto lg:max-h-none">
              {requests.map((item) => {
                const itemStatus = statusPresentation(item.status);
                const active = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void loadDetail(item.id)}
                    className={`flex min-h-[72px] w-full items-center gap-3 px-4 py-4 text-left transition-colors ${
                      active ? 'bg-ivoire-400/8' : 'hover:bg-brume-800/22'
                    }`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${itemStatus.dot}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ivoire-200">
                        {item.subject}
                      </span>
                      <span className="mt-1 block text-xs text-brume-300">
                        {itemStatus.label} · {formatDate(item.lastMessageAt)}
                      </span>
                    </span>
                    {item.unreadCount > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-horizon-400 px-1 text-[11px] font-bold text-abyss-900">
                        {item.unreadCount}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-brume-400" />
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section
          className={`min-h-[min(500px,calc(100dvh-10rem))] min-w-0 flex-col overflow-hidden rounded-3xl border border-ivoire-500/[0.06] glass-aube lg:flex lg:min-h-[500px] ${
            selected ? 'flex' : 'hidden'
          }`}
        >
          {isDetailLoading ? (
            <div className="grid flex-1 place-items-center" role="status">
              <Loader2 className="h-7 w-7 animate-spin text-ivoire-400" />
            </div>
          ) : !selected ? (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <MessageCircle className="mx-auto h-8 w-8 text-brume-400" />
                <p className="mt-4 text-sm text-brume-300">
                  Sélectionnez une demande ou créez-en une nouvelle.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-b border-ivoire-500/[0.05] px-4 py-4 sm:px-6">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Retour à mes demandes"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-ivoire-500/[0.06] text-brume-200 hover:bg-brume-800/25 lg:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words font-playfair text-xl italic text-ivoire-100">
                        {selected.subject}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-brume-300">
                        <span className={`rounded-full px-2 py-1 ${status?.badge}`}>
                          {status?.label}
                        </span>
                        {selected.relatedReading?.orderNumber && (
                          <span className="inline-flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />{' '}
                            {selected.relatedReading.orderNumber}
                          </span>
                        )}
                        {selected.assignedExpert?.name && (
                          <span>Suivi par {selected.assignedExpert.name}</span>
                        )}
                      </div>
                    </div>
                    {selected.status === 'RESOLVED' && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" /> Demande résolue
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="space-y-4">
                  {selectedMessages.map((message) => {
                    const clientMessage = message.senderType === 'CLIENT';
                    return (
                      <article
                        key={message.id}
                        className={`flex ${clientMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[76%] ${
                            clientMessage
                              ? 'rounded-br-sm bg-ivoire-400/10 text-ivoire-100'
                              : 'rounded-bl-sm bg-brume-700/20 text-ivoire-200'
                          }`}
                        >
                          {!clientMessage && (
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ivoire-400">
                              {message.senderName || 'Équipe Lumira'}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <time className="mt-2 block text-right text-[10px] text-brume-400">
                            {formatDateTime(message.createdAt)}
                          </time>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-ivoire-500/[0.05] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
                {selected.status === 'ARCHIVED' ? (
                  <p className="rounded-xl bg-brume-800/22 p-3 text-center text-xs text-brume-300">
                    Cette demande est archivée.
                  </p>
                ) : (
                  <div className="flex items-end gap-2 rounded-2xl border border-ivoire-500/[0.08] bg-abyss-700 p-2 focus-within:border-horizon-400/50">
                    <label className="sr-only" htmlFor="guidance-reply">
                      Ajouter un message
                    </label>
                    <textarea
                      id="guidance-reply"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      rows={2}
                      maxLength={5000}
                      placeholder={
                        selected.status === 'RESOLVED'
                          ? 'Ajouter un message pour rouvrir la demande…'
                          : 'Ajouter une précision ou répondre…'
                      }
                      className="min-h-[48px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-ivoire-100 placeholder:text-brume-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={!reply.trim() || isSending}
                      aria-label="Envoyer mon message à l’équipe"
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-horizon-400 text-abyss-900 hover:bg-horizon-300 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                )}
                {selected.status === 'WAITING_EXPERT' && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-brume-300">
                    <Clock3 className="h-3.5 w-3.5" /> Votre message est en attente de réponse de
                    l’équipe.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function RequestListSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-ivoire-500/[0.05]">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex min-h-[72px] items-center gap-3 px-4 py-4">
          <div className="h-2.5 w-2.5 rounded-full bg-ivoire-500/[0.06]" />
          <div className="flex-1">
            <div className="h-4 w-3/4 rounded-full bg-brume-700/20" />
            <div className="mt-2 h-3 w-1/2 rounded-full bg-brume-800/25" />
          </div>
        </div>
      ))}
    </div>
  );
}

function statusPresentation(status: RequestStatus) {
  const map: Record<RequestStatus, { label: string; dot: string; badge: string }> = {
    NEW: {
      label: 'Nouvelle',
      dot: 'bg-horizon-300',
      badge: 'bg-ivoire-400/10 text-ivoire-300',
    },
    IN_PROGRESS: {
      label: 'Prise en charge',
      dot: 'bg-violet-300',
      badge: 'bg-violet-400/15 text-violet-200',
    },
    WAITING_EXPERT: {
      label: 'En attente de l’équipe',
      dot: 'bg-amber-300',
      badge: 'bg-amber-400/15 text-amber-200',
    },
    WAITING_CLIENT: {
      label: 'Votre réponse est attendue',
      dot: 'bg-sky-300',
      badge: 'bg-sky-400/15 text-sky-200',
    },
    RESOLVED: {
      label: 'Résolue',
      dot: 'bg-emerald-300',
      badge: 'bg-emerald-400/15 text-emerald-200',
    },
    ARCHIVED: {
      label: 'Archivée',
      dot: 'bg-brume-400',
      badge: 'bg-brume-700/20 text-brume-200',
    },
  };
  return map[status];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
