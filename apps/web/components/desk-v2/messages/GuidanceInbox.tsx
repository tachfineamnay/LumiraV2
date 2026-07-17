'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import expertApi from '@/lib/expertApi';
import { useExpertAuth } from '@/context/ExpertAuthContext';
import type { GuidanceRequest, GuidanceRequestStatus } from './types';
import { useGuidanceRequests } from './useGuidanceRequests';

type InboxFilter =
  | 'ALL'
  | 'UNREAD'
  | 'MINE'
  | 'NEW'
  | 'WAITING_EXPERT'
  | 'WAITING_CLIENT'
  | 'RESOLVED';

const FILTERS: Array<{ value: InboxFilter; label: string }> = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'UNREAD', label: 'Non lues' },
  { value: 'MINE', label: 'À moi' },
  { value: 'NEW', label: 'Nouvelles' },
  { value: 'WAITING_EXPERT', label: 'À répondre' },
  { value: 'WAITING_CLIENT', label: 'Client' },
  { value: 'RESOLVED', label: 'Résolues' },
];

export function GuidanceInbox() {
  const { expert } = useExpertAuth();
  const { requests, loading, error, unreadCount, openCount, refresh } = useGuidanceRequests();
  const [filter, setFilter] = useState<InboxFilter>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<GuidanceRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    return requests.filter((request) => {
      if (filter === 'UNREAD') return request.unreadCount > 0;
      if (filter === 'MINE') return request.assignedExpert?.id === expert?.id;
      if (filter === 'ALL') return true;
      return request.status === filter;
    });
  }, [expert?.id, filter, requests]);

  useEffect(() => {
    if (selectedId && !requests.some((request) => request.id === selectedId)) {
      setSelectedId(null);
      setSelected(null);
    }
  }, [requests, selectedId]);

  const openRequest = async (requestId: string) => {
    setSelectedId(requestId);
    setDetailLoading(true);
    try {
      const response = await expertApi.get<GuidanceRequest>(`/expert/requests/${requestId}`);
      setSelected(response.data);
      await expertApi.post(`/expert/requests/${requestId}/read`);
      await refresh();
    } catch (requestError) {
      console.error(requestError);
      toast.error('Impossible d’ouvrir la demande');
    } finally {
      setDetailLoading(false);
    }
  };

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      if (selectedId) {
        const response = await expertApi.get<GuidanceRequest>(`/expert/requests/${selectedId}`);
        setSelected(response.data);
      }
      await refresh();
    } catch (actionError: unknown) {
      const message = (actionError as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error('Action impossible', { description: message });
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    const content = reply.trim();
    if (!selectedId || content.length < 2) return;
    await runAction(
      () => expertApi.post(`/expert/requests/${selectedId}/messages`, { content }),
      'Réponse envoyée',
    );
    setReply('');
  };

  const changeStatus = async (status: GuidanceRequestStatus) => {
    if (!selectedId) return;
    await runAction(
      () => expertApi.patch(`/expert/requests/${selectedId}/status`, { status }),
      status === 'RESOLVED' ? 'Demande résolue' : 'Statut mis à jour',
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-desk-bg">
      <header className="flex flex-col gap-3 border-b border-desk-border px-3 py-3 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-desk-text">Demandes d’éclairage</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-950">
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-desk-muted">
            {openCount} demande{openCount > 1 ? 's' : ''} ouverte{openCount > 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-desk-border bg-desk-card px-3 py-2 text-sm text-desk-text hover:bg-desk-hover disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-desk-border bg-desk-surface px-3 py-2 sm:px-6">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`min-h-[36px] flex-shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              filter === item.value
                ? 'bg-amber-500 font-semibold text-slate-950'
                : 'text-desk-muted hover:bg-desk-hover hover:text-desk-text'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.6fr)]">
        <section
          className={`${selectedId ? 'hidden lg:block' : 'block'} min-h-0 overflow-y-auto border-r border-desk-border bg-desk-surface`}
        >
          {loading && requests.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-desk-muted">
              <Loader2 className="h-5 w-5 animate-spin" /> Chargement des demandes…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
              <Inbox className="mb-3 h-10 w-10 text-desk-subtle" />
              <p className="font-medium text-desk-text">Aucune demande dans cette vue</p>
              <p className="mt-1 text-sm text-desk-muted">Le filtre sélectionné est à jour.</p>
            </div>
          ) : (
            <div className="divide-y divide-desk-border">
              {visible.map((request) => (
                <RequestListItem
                  key={request.id}
                  request={request}
                  selected={selectedId === request.id}
                  onClick={() => void openRequest(request.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className={`${selectedId ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col bg-desk-bg`}>
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <MessageCircle className="mb-4 h-12 w-12 text-desk-subtle" />
              <h2 className="text-lg font-semibold text-desk-text">Sélectionnez une demande</h2>
              <p className="mt-2 max-w-sm text-sm text-desk-muted">
                Le contexte client, la lecture associée et l’historique apparaîtront ici.
              </p>
            </div>
          ) : detailLoading || !selected ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-desk-muted">
              <Loader2 className="h-5 w-5 animate-spin" /> Ouverture de la demande…
            </div>
          ) : (
            <>
              <RequestHeader
                request={selected}
                busy={busy}
                onBack={() => {
                  setSelectedId(null);
                  setSelected(null);
                }}
                onAssign={() =>
                  void runAction(
                    () => expertApi.post(`/expert/requests/${selected.id}/assign`),
                    'Demande prise en charge',
                  )
                }
                onStatus={changeStatus}
              />

              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
                <div className="mx-auto max-w-3xl space-y-3">
                  {(selected.messages || []).map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderType === 'EXPERT' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                          message.senderType === 'EXPERT'
                            ? 'bg-amber-500 text-slate-950'
                            : message.senderType === 'SYSTEM'
                              ? 'border border-desk-border bg-desk-card text-desk-muted'
                              : 'border border-desk-border bg-desk-surface text-desk-text'
                        }`}
                      >
                        <p>{message.content}</p>
                        <p
                          className={`mt-2 text-[11px] ${
                            message.senderType === 'EXPERT' ? 'text-slate-700' : 'text-desk-subtle'
                          }`}
                        >
                          {message.senderName || (message.senderType === 'CLIENT' ? 'Client' : 'Système')} ·{' '}
                          {formatDateTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {!['RESOLVED', 'ARCHIVED'].includes(selected.status) && (
                <div className="border-t border-desk-border bg-desk-surface p-3 sm:p-4">
                  <div className="mx-auto flex max-w-3xl items-end gap-2">
                    <textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Écrire une réponse claire et précise…"
                      rows={2}
                      className="min-h-[52px] flex-1 resize-y rounded-xl border border-desk-border bg-desk-card px-3 py-2.5 text-sm text-desk-text outline-none placeholder:text-desk-subtle focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={busy || reply.trim().length < 2}
                      className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                      aria-label="Envoyer la réponse"
                    >
                      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function RequestListItem({
  request,
  selected,
  onClick,
}: {
  request: GuidanceRequest;
  selected: boolean;
  onClick: () => void;
}) {
  const status = statusPresentation(request.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-3 text-left transition-colors ${
        selected ? 'bg-amber-500/10' : 'hover:bg-desk-hover'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-desk-text">{request.subject}</p>
            {request.unreadCount > 0 && (
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber-500" />
            )}
          </div>
          <p className="mt-1 truncate text-xs text-desk-muted">
            {request.client
              ? `${request.client.firstName} ${request.client.lastName}`
              : 'Client'}
            {request.relatedReading?.orderNumber
              ? ` · ${request.relatedReading.orderNumber}`
              : ''}
          </p>
        </div>
        <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
          {status.label}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-desk-subtle">
        <span>{categoryLabel(request.category)}</span>
        <span>{formatRelative(request.lastMessageAt)}</span>
      </div>
    </button>
  );
}

function RequestHeader({
  request,
  busy,
  onBack,
  onAssign,
  onStatus,
}: {
  request: GuidanceRequest;
  busy: boolean;
  onBack: () => void;
  onAssign: () => void;
  onStatus: (status: GuidanceRequestStatus) => Promise<void>;
}) {
  return (
    <header className="border-b border-desk-border bg-desk-surface px-3 py-3 sm:px-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-desk-muted hover:bg-desk-hover lg:hidden"
          aria-label="Retour aux demandes"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-desk-text">{request.subject}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-desk-muted">
            {request.client && (
              <Link href={`/admin/clients/${request.client.id}`} className="hover:text-amber-600 hover:underline">
                {request.client.firstName} {request.client.lastName}
              </Link>
            )}
            {request.relatedReading && (
              <Link
                href={`/admin/studio/${request.relatedReading.id}`}
                className="hover:text-amber-600 hover:underline"
              >
                {request.relatedReading.orderNumber || 'Lecture associée'}
              </Link>
            )}
            <span>{categoryLabel(request.category)}</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {!request.assignedExpert && (
            <button
              type="button"
              onClick={onAssign}
              disabled={busy}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-desk-border px-3 py-2 text-xs font-medium text-desk-text hover:bg-desk-hover disabled:opacity-50"
            >
              <UserCheck className="h-4 w-4" /> Prendre
            </button>
          )}
          {!['RESOLVED', 'ARCHIVED'].includes(request.status) ? (
            <button
              type="button"
              onClick={() => void onStatus('RESOLVED')}
              disabled={busy}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> Résoudre
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onStatus('IN_PROGRESS')}
              disabled={busy}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-desk-border px-3 py-2 text-xs font-medium text-desk-text hover:bg-desk-hover disabled:opacity-50"
            >
              <Clock3 className="h-4 w-4" /> Rouvrir
            </button>
          )}
        </div>
      </div>
      {request.assignedExpert && (
        <p className="mt-2 text-xs text-desk-subtle">
          Assignée à <span className="font-medium text-desk-muted">{request.assignedExpert.name}</span>
        </p>
      )}
    </header>
  );
}

function statusPresentation(status: GuidanceRequestStatus) {
  const states: Record<GuidanceRequestStatus, { label: string; className: string }> = {
    NEW: { label: 'Nouvelle', className: 'bg-amber-500/15 text-amber-600' },
    IN_PROGRESS: { label: 'En cours', className: 'bg-blue-500/15 text-blue-600' },
    WAITING_CLIENT: { label: 'Client', className: 'bg-purple-500/15 text-purple-600' },
    WAITING_EXPERT: { label: 'À répondre', className: 'bg-red-500/15 text-red-600' },
    RESOLVED: { label: 'Résolue', className: 'bg-emerald-500/15 text-emerald-600' },
    ARCHIVED: { label: 'Archivée', className: 'bg-slate-500/15 text-slate-500' },
  };
  return states[status];
}

function categoryLabel(category: GuidanceRequest['category']) {
  const labels: Record<GuidanceRequest['category'], string> = {
    READING_CLARIFICATION: 'Clarification de lecture',
    SPECIFIC_SITUATION: 'Situation précise',
    INTEGRATION_ADVICE: 'Conseil d’intégration',
    OTHER: 'Autre demande',
  };
  return labels[category];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatRelative(value: string) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'maintenant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}
