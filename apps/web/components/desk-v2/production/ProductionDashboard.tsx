'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cog,
  Headphones,
  Loader2,
  RefreshCw,
  RotateCcw,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProductionJob, ProductionJobStatus } from './types';
import { useProductionControl } from './useProductionControl';

const FILTERS: Array<{ value: ProductionJobStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Tous' },
  { value: 'RUNNING', label: 'En cours' },
  { value: 'QUEUED', label: 'En attente' },
  { value: 'FAILED', label: 'Incidents' },
  { value: 'SUCCEEDED', label: 'Terminés' },
];

export function ProductionDashboard() {
  const { summary, jobs, isLoading, error, refresh, retry, cancel } = useProductionControl();
  const [filter, setFilter] = useState<ProductionJobStatus | 'ALL'>('ALL');
  const [busyJobId, setBusyJobId] = useState<string | null>(null);

  const visibleJobs = useMemo(
    () => jobs.filter((job) => filter === 'ALL' || job.status === filter),
    [filter, jobs],
  );

  const runAction = async (job: ProductionJob, action: 'retry' | 'cancel') => {
    setBusyJobId(job.id);
    try {
      if (action === 'retry') {
        await retry(job.id);
        toast.success(`Relance ajoutée pour ${job.orderNumber}`);
      } else {
        await cancel(job.id);
        toast.success(`Traitement annulé pour ${job.orderNumber}`);
      }
    } catch (actionError) {
      console.error(actionError);
      toast.error(action === 'retry' ? 'Relance impossible' : 'Annulation impossible');
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-3 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-desk-text">Centre de production</h1>
          <p className="mt-1 text-sm text-desk-muted">
            Les traitements continuent côté serveur même lorsque vous changez de page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-desk-border bg-desk-card px-4 py-2 text-sm text-desk-text transition-colors hover:bg-desk-hover disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="En cours" value={summary.running} icon={<Cog className="h-5 w-5" />} />
        <SummaryCard label="En attente" value={summary.queued} icon={<Clock3 className="h-5 w-5" />} />
        <SummaryCard
          label="À valider"
          value={summary.awaitingReview}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <SummaryCard
          label="Audio manquant"
          value={summary.audioMissing}
          icon={<Headphones className="h-5 w-5" />}
        />
        <SummaryCard
          label="Incidents"
          value={summary.failed}
          icon={<AlertTriangle className="h-5 w-5" />}
          danger={summary.failed > 0}
        />
      </section>

      <section className="rounded-xl border border-desk-border bg-desk-surface">
        <div className="flex flex-col gap-3 border-b border-desk-border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-desk-card p-1">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`min-h-[36px] flex-shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  filter === item.value
                    ? 'bg-amber-500 font-semibold text-slate-950'
                    : 'text-desk-muted hover:bg-desk-hover hover:text-desk-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-desk-subtle">{visibleJobs.length} traitement(s)</span>
        </div>

        {error && (
          <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="divide-y divide-desk-border">
          {isLoading && jobs.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-desk-muted">
              <Loader2 className="h-5 w-5 animate-spin" /> Synchronisation de la production…
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-600" />
              <p className="font-medium text-desk-text">Aucun traitement dans cette vue</p>
              <p className="mt-1 text-sm text-desk-muted">Le moteur est à jour.</p>
            </div>
          ) : (
            visibleJobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                busy={busyJobId === job.id}
                onRetry={() => void runAction(job, 'retry')}
                onCancel={() => void runAction(job, 'cancel')}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        danger
          ? 'border-red-500/30 bg-red-500/5 text-red-600'
          : 'border-desk-border bg-desk-surface text-desk-text'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-desk-muted">{label}</span>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function JobRow({
  job,
  busy,
  onRetry,
  onCancel,
}: {
  job: ProductionJob;
  busy: boolean;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const relativeTime = formatDistanceToNow(new Date(job.heartbeatAt || job.queuedAt), {
    addSuffix: true,
    locale: fr,
  });
  const status = statusPresentation(job.status);

  return (
    <article className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/studio/${job.orderId}`}
            className="font-mono text-sm font-semibold text-amber-600 hover:underline"
          >
            {job.orderNumber}
          </Link>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
            {status.label}
          </span>
          <span className="rounded-full bg-desk-card px-2 py-0.5 text-xs text-desk-muted">
            {job.type === 'READING_GENERATION' ? 'Lecture' : 'Audio'}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-desk-text">
          {job.user.firstName} {job.user.lastName}
        </p>
        <p className="truncate text-xs text-desk-subtle">{job.user.email}</p>
      </div>

      <div>
        <p className="text-sm font-medium text-desk-text">{stageLabel(job.stage)}</p>
        <p className="mt-1 text-xs text-desk-subtle">
          Tentative {job.attempts}/{job.maxAttempts} · mise à jour {relativeTime}
        </p>
        {job.error?.message && (
          <p className="mt-2 line-clamp-2 text-xs text-red-600">{job.error.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2 lg:justify-end">
        {(job.status === 'FAILED' || job.status === 'CANCELLED') && (
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Réessayer
          </button>
        )}
        {job.status === 'QUEUED' && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-desk-border px-3 py-2 text-sm text-desk-muted hover:bg-desk-hover disabled:opacity-50"
          >
            <Square className="h-4 w-4" /> Annuler
          </button>
        )}
        <Link
          href={`/admin/studio/${job.orderId}`}
          className="inline-flex min-h-[40px] items-center rounded-lg border border-desk-border px-3 py-2 text-sm text-desk-text hover:bg-desk-hover"
        >
          Ouvrir
        </Link>
      </div>
    </article>
  );
}

function statusPresentation(status: ProductionJobStatus) {
  switch (status) {
    case 'RUNNING':
      return { label: 'En cours', className: 'bg-blue-500/15 text-blue-600' };
    case 'QUEUED':
      return { label: 'En attente', className: 'bg-amber-500/15 text-amber-600' };
    case 'FAILED':
      return { label: 'Incident', className: 'bg-red-500/15 text-red-600' };
    case 'SUCCEEDED':
      return { label: 'Terminé', className: 'bg-emerald-500/15 text-emerald-600' };
    default:
      return { label: 'Annulé', className: 'bg-slate-500/15 text-slate-500' };
  }
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    QUEUED: 'En attente du moteur',
    STARTING: 'Démarrage sécurisé',
    GENERATING_READING: 'Génération de la lecture',
    GENERATING_AUDIO: 'Génération de l’audio',
    RECOVERED_AFTER_RESTART: 'Repris après interruption',
    COMPLETED: 'Traitement terminé',
    FAILED: 'Traitement interrompu',
    STALE_MAX_ATTEMPTS: 'Reprises automatiques épuisées',
    CANCELLED: 'Traitement annulé',
  };
  return labels[stage] || stage.replaceAll('_', ' ').toLowerCase();
}
