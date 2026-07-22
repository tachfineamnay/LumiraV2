'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Infinity as InfinityIcon,
  Loader2,
  MessageCircle,
  RefreshCw,
} from 'lucide-react';
import expertApi from '@/lib/expertApi';

interface ClientReadingSummary {
  id: string;
  orderNumber: string;
  title: string;
  state:
    | 'WAITING_CLIENT'
    | 'READY_FOR_PRODUCTION'
    | 'IN_PRODUCTION'
    | 'AWAITING_REVIEW'
    | 'ASSETS_PENDING'
    | 'DELIVERED'
    | 'INCIDENT'
    | 'REFUNDED';
  orderedAt: string;
  assignedExpert?: { name: string } | null;
  versions: { count: number; sealedVersionNumber?: number | null };
  assets: {
    pdf: { status?: string };
    audio: { status?: string };
    email: { status?: string };
  };
}

interface ClientConversationSummary {
  id: string;
  title: string;
  type: 'AI_ASSISTANT' | 'EXPERT_REQUEST';
  status: string;
  category?: string;
  assignedExpert?: { id: string; name: string } | null;
  messageCount: number;
  unreadByExpert: number;
  unreadByClient: number;
  lastSender?: string | null;
  lastMessageAt: string;
  relatedOrderId?: string | null;
}

interface ClientTimelineItem {
  id: string;
  type: string;
  title: string;
  occurredAt: string;
  orderId?: string;
  conversationId?: string;
}

interface ClientControlData {
  client: {
    id: string;
    refId?: string | null;
    firstName: string;
    lastName: string;
    email: string;
    access: 'EARLY_3M' | 'NONE';
  };
  readiness: {
    profileCompleted: boolean;
    onboardingStatus?: string | null;
    birthData: boolean;
    facePhoto: boolean;
    palmPhoto: boolean;
    activeConsent: boolean;
  };
  summary: {
    totalReadings: number;
    deliveredReadings: number;
    openReadings: number;
    incidents: number;
    conversations: number;
    guidanceRequests?: number;
    openGuidanceRequests?: number;
    unreadGuidanceForExpert?: number;
    unreadNotifications: number;
  };
  readings: ClientReadingSummary[];
  conversations: ClientConversationSummary[];
  timeline: ClientTimelineItem[];
}

export function ClientControlOverview({ clientId }: { clientId: string }) {
  const [data, setData] = useState<ClientControlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllTimeline, setShowAllTimeline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await expertApi.get<ClientControlData>(
        `/expert/clients/${clientId}/control-center`,
      );
      setData(response.data);
      setError(null);
    } catch (requestError) {
      console.error('[ClientControlOverview] Load failed', requestError);
      setError('Impossible de synchroniser la vue opérationnelle');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const actionableReadings = useMemo(
    () =>
      data?.readings.filter((reading) => !['DELIVERED', 'REFUNDED'].includes(reading.state)) || [],
    [data],
  );
  const guidanceRequests = useMemo(
    () =>
      data?.conversations.filter((conversation) => conversation.type === 'EXPERT_REQUEST') || [],
    [data],
  );
  const aiConversations = useMemo(
    () => data?.conversations.filter((conversation) => conversation.type === 'AI_ASSISTANT') || [],
    [data],
  );

  if (loading) {
    return (
      <section className="flex min-h-32 items-center justify-center rounded-xl border border-desk-border bg-desk-surface">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-amber-600" />
        <span className="text-sm text-desk-muted">Construction de la vue client 360…</span>
      </section>
    );
  }

  if (!data || error) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-600">
        <span>{error || 'Vue client indisponible'}</span>
        <button
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 font-medium"
        >
          <RefreshCw className="h-4 w-4" /> Réessayer
        </button>
      </section>
    );
  }

  const openGuidance =
    data.summary.openGuidanceRequests ??
    guidanceRequests.filter((request) => !['RESOLVED', 'ARCHIVED'].includes(request.status)).length;
  const unreadGuidance =
    data.summary.unreadGuidanceForExpert ??
    guidanceRequests.reduce((total, request) => total + request.unreadByExpert, 0);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Accès"
          value={data.client.access === 'EARLY_3M' ? 'Early 3 mois' : 'Aucun'}
          icon={<InfinityIcon className="h-5 w-5" />}
          positive={data.client.access === 'EARLY_3M'}
        />
        <MetricCard
          label="Lectures"
          value={data.summary.totalReadings}
          icon={<BookOpen className="h-5 w-5" />}
        />
        <MetricCard
          label="Livrées"
          value={data.summary.deliveredReadings}
          icon={<CheckCircle2 className="h-5 w-5" />}
          positive={data.summary.deliveredReadings > 0}
        />
        <MetricCard
          label="À traiter"
          value={data.summary.openReadings}
          icon={<Clock3 className="h-5 w-5" />}
        />
        <MetricCard
          label="Demandes Desk"
          value={openGuidance}
          icon={<MessageCircle className="h-5 w-5" />}
          danger={unreadGuidance > 0}
        />
        <MetricCard
          label="Incidents"
          value={data.summary.incidents}
          icon={<AlertTriangle className="h-5 w-5" />}
          danger={data.summary.incidents > 0}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          <Panel
            title="Ce qui demande une action"
            description="Production, validation, assets ou éléments client."
            badge={actionableReadings.length}
          >
            {actionableReadings.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-8 w-8 text-emerald-600" />}
                title="Aucune lecture en attente"
                description="Toutes les lectures sont livrées ou archivées."
              />
            ) : (
              <div className="divide-y divide-desk-border">
                {actionableReadings.map((reading) => (
                  <ReadingRow key={reading.id} reading={reading} />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Historique des lectures"
            description="Versions, PDF, audio et livraison restent liés à chaque dossier."
          >
            {data.readings.length === 0 ? (
              <p className="p-5 text-sm text-desk-muted">Aucune lecture enregistrée.</p>
            ) : (
              <div className="divide-y divide-desk-border">
                {data.readings.map((reading) => (
                  <ReadingRow key={reading.id} reading={reading} compact />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Demandes d’éclairage"
            description="Conversations humaines adressées au Desk, séparées du chat IA."
            action={
              <Link
                href="/admin/messages"
                className="text-xs font-semibold text-amber-600 hover:underline"
              >
                Ouvrir l’inbox
              </Link>
            }
          >
            {guidanceRequests.length === 0 ? (
              <p className="p-5 text-sm text-desk-muted">Aucune demande adressée au Desk.</p>
            ) : (
              <div className="divide-y divide-desk-border">
                {guidanceRequests.slice(0, 8).map((conversation) => (
                  <ConversationRow key={conversation.id} conversation={conversation} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-desk-border bg-desk-surface p-4">
            <h2 className="font-semibold text-desk-text">Dossier essentiel</h2>
            <p className="mt-1 text-xs text-desk-muted">
              Conditions nécessaires avant la production.
            </p>
            <div className="mt-4 space-y-2">
              <ReadinessRow label="Profil validé" done={data.readiness.profileCompleted} />
              <ReadinessRow label="Date et lieu de naissance" done={data.readiness.birthData} />
              <ReadinessRow label="Photo du visage" done={data.readiness.facePhoto} />
              <ReadinessRow label="Photo de la paume" done={data.readiness.palmPhoto} />
              <ReadinessRow label="Consentement actif" done={data.readiness.activeConsent} />
            </div>
          </div>

          <Panel title="Activité récente" description="Chronologie métier, sans contenu privé.">
            <div className="divide-y divide-desk-border">
              {(showAllTimeline ? data.timeline : data.timeline.slice(0, 8)).map((event) => (
                <TimelineRow key={event.id} event={event} />
              ))}
              {data.timeline.length === 0 && (
                <p className="p-4 text-sm text-desk-muted">Aucune activité enregistrée.</p>
              )}
            </div>
            {data.timeline.length > 8 && (
              <button
                type="button"
                onClick={() => setShowAllTimeline((value) => !value)}
                className="w-full border-t border-desk-border px-4 py-3 text-sm font-medium text-amber-600 hover:bg-desk-hover"
              >
                {showAllTimeline ? 'Réduire' : `Afficher les ${data.timeline.length} événements`}
              </button>
            )}
          </Panel>

          <Panel
            title="Conversations IA"
            description="Historique du confident IA, distinct des réponses humaines."
          >
            {aiConversations.length === 0 ? (
              <p className="p-4 text-sm text-desk-muted">Aucune conversation IA enregistrée.</p>
            ) : (
              <div className="divide-y divide-desk-border">
                {aiConversations.slice(0, 5).map((conversation) => (
                  <ConversationRow key={conversation.id} conversation={conversation} />
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
}

function Panel({
  title,
  description,
  badge,
  action,
  children,
}: {
  title: string;
  description: string;
  badge?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-desk-border bg-desk-surface">
      <div className="flex items-center justify-between gap-3 border-b border-desk-border px-4 py-3">
        <div>
          <h2 className="font-semibold text-desk-text">{title}</h2>
          <p className="mt-0.5 text-xs text-desk-muted">{description}</p>
        </div>
        {action}
        {badge !== undefined && (
          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center p-5 text-center">
      {icon}
      <p className="mt-2 font-medium text-desk-text">{title}</p>
      <p className="mt-1 text-xs text-desk-muted">{description}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  positive = false,
  danger = false,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  positive?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${
        danger
          ? 'border-red-500/30 bg-red-500/5 text-red-600'
          : positive
            ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-600'
            : 'border-desk-border bg-desk-surface text-desk-text'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-desk-muted">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ReadingRow({
  reading,
  compact = false,
}: {
  reading: ClientReadingSummary;
  compact?: boolean;
}) {
  const state = readingStatePresentation(reading.state);
  return (
    <div
      className={`grid gap-3 px-4 py-3 ${compact ? 'lg:grid-cols-[1fr_auto]' : 'lg:grid-cols-[1fr_auto_auto]'}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-desk-text">{reading.title}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${state.className}`}>
            {state.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-desk-muted">
          {reading.orderNumber} · {formatDate(reading.orderedAt)}
          {reading.assignedExpert?.name ? ` · ${reading.assignedExpert.name}` : ''}
        </p>
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <AssetBadge label="PDF" status={reading.assets.pdf.status} />
          <AssetBadge label="Audio" status={reading.assets.audio.status} />
          <AssetBadge label="E-mail" status={reading.assets.email.status} />
          <span className="rounded-full bg-desk-card px-2 py-1 text-desk-muted">
            v{reading.versions.sealedVersionNumber || reading.versions.count || '—'}
          </span>
        </div>
      )}

      <Link
        href={`/admin/studio/${reading.id}`}
        className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-desk-border px-3 py-2 text-sm text-desk-text hover:bg-desk-hover"
      >
        Ouvrir <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function ConversationRow({ conversation }: { conversation: ClientConversationSummary }) {
  const isGuidance = conversation.type === 'EXPERT_REQUEST';
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          isGuidance ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'
        }`}
      >
        {isGuidance ? <MessageCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-desk-text">{conversation.title}</p>
          {conversation.unreadByExpert > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {conversation.unreadByExpert}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-desk-muted">
          {formatDateTime(conversation.lastMessageAt)} · {conversation.messageCount} message
          {conversation.messageCount > 1 ? 's' : ''} · {conversation.status}
        </p>
      </div>
      {isGuidance && (
        <Link
          href="/admin/messages"
          className="text-xs font-semibold text-amber-600 hover:underline"
        >
          Inbox
        </Link>
      )}
    </div>
  );
}

function ReadinessRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-desk-card px-3 py-2 text-sm">
      <span className="text-desk-muted">{label}</span>
      {done ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Circle className="h-4 w-4 text-amber-600" />
      )}
    </div>
  );
}

function TimelineRow({ event }: { event: ClientTimelineItem }) {
  const content = (
    <div className="flex gap-3 px-4 py-3">
      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0">
        <p className="text-sm text-desk-text">{event.title}</p>
        <p className="mt-1 text-xs text-desk-subtle">{formatDateTime(event.occurredAt)}</p>
      </div>
    </div>
  );
  return event.orderId ? <Link href={`/admin/studio/${event.orderId}`}>{content}</Link> : content;
}

function AssetBadge({ label, status }: { label: string; status?: string }) {
  const ready = status === 'READY' || status === 'SENT';
  const failed = status === 'FAILED';
  return (
    <span
      className={`rounded-full px-2 py-1 ${
        ready
          ? 'bg-emerald-500/10 text-emerald-600'
          : failed
            ? 'bg-red-500/10 text-red-600'
            : 'bg-amber-500/10 text-amber-600'
      }`}
    >
      {label}: {ready ? 'prêt' : failed ? 'erreur' : 'attente'}
    </span>
  );
}

function readingStatePresentation(state: ClientReadingSummary['state']) {
  const states: Record<ClientReadingSummary['state'], { label: string; className: string }> = {
    WAITING_CLIENT: { label: 'Éléments client', className: 'bg-amber-500/10 text-amber-600' },
    READY_FOR_PRODUCTION: {
      label: 'Prête à produire',
      className: 'bg-emerald-500/10 text-emerald-600',
    },
    IN_PRODUCTION: { label: 'En production', className: 'bg-blue-500/10 text-blue-600' },
    AWAITING_REVIEW: { label: 'À valider', className: 'bg-purple-500/10 text-purple-600' },
    ASSETS_PENDING: { label: 'Assets à compléter', className: 'bg-amber-500/10 text-amber-600' },
    DELIVERED: { label: 'Livrée', className: 'bg-emerald-500/10 text-emerald-600' },
    INCIDENT: { label: 'Incident', className: 'bg-red-500/10 text-red-600' },
    REFUNDED: { label: 'Remboursée', className: 'bg-slate-500/10 text-slate-500' },
  };
  return states[state];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
