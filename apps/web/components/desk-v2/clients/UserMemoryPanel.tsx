'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import expertApi from '@/lib/expertApi';
import { ConfirmModal } from '../shared/ConfirmModal';

type MemoryStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUPERSEDED' | 'DELETED' | 'SYNC_FAILED';

interface UserMemory {
  id: string;
  sourceType: string;
  sourceVersionId?: string | null;
  category: string;
  fact: string;
  status: MemoryStatus;
  confidence: number;
  approvedAt?: string | null;
  syncedAt?: string | null;
  lastSyncError?: string | null;
  vertexSynced: boolean;
  pendingOperation?: 'UPSERT' | 'DELETE' | 'SUPERSEDE' | null;
  conflictResolution?: 'SUPERSEDE' | 'KEEP_BOTH' | null;
  readingVersion?: { orderId: string; version: number } | null;
  conflictsWith?: Array<{ id: string; fact: string }>;
}

interface MemoryJob {
  id: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  queuedAt: string;
  lastError?: string | null;
}

interface MemoryDashboard {
  memories: UserMemory[];
  counts: Record<string, number>;
  jobs: MemoryJob[];
  readiness: { ready: boolean; code: string };
}

function errorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { message?: unknown } } })?.response;
  const message = response?.data?.message;
  return Array.isArray(message)
    ? message.filter((item): item is string => typeof item === 'string').join(' ')
    : typeof message === 'string'
      ? message
      : 'L’opération mémoire n’a pas abouti. Aucune action supplémentaire n’a été lancée.';
}

const STATUS_STYLE: Record<MemoryStatus, string> = {
  PENDING: 'bg-amber-500/10 text-amber-700',
  ACTIVE: 'bg-emerald-500/10 text-emerald-700',
  REJECTED: 'bg-slate-500/10 text-slate-600',
  SUPERSEDED: 'bg-violet-500/10 text-violet-700',
  DELETED: 'bg-red-500/10 text-red-700',
  SYNC_FAILED: 'bg-red-500/10 text-red-700',
};

export function UserMemoryPanel({ clientId }: { clientId: string }) {
  const [dashboard, setDashboard] = useState<MemoryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ label: string; request: () => Promise<void> } | null>(
    null,
  );
  const [running, setRunning] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [fact, setFact] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await expertApi.get<MemoryDashboard>(`/expert/clients/${clientId}/memories`);
      setDashboard(data);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ask = (label: string, request: () => Promise<void>) => setPending({ label, request });

  const confirm = async () => {
    if (!pending || running) return;
    try {
      setRunning(true);
      setError(null);
      await pending.request();
      setPending(null);
      setEditing(null);
      await load();
    } catch (mutationError) {
      setError(errorMessage(mutationError));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section
      className="rounded-xl border border-desk-border bg-desk-surface p-3 sm:p-5"
      aria-label="Mémoire de continuité"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-desk-text">Mémoire de continuité</h2>
          <p className="mt-1 text-xs leading-5 text-desk-muted">
            Source secondaire : chaque fait reste traçable, validable et supprimable depuis le Desk.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || running}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-desk-border px-3 text-sm text-desk-text disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </button>
      </header>

      {error && (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {dashboard && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Compteurs mémoire">
          {Object.entries(dashboard.counts).map(([status, count]) => (
            <span
              key={status}
              className="rounded-full bg-desk-card px-2.5 py-1 text-xs text-desk-muted"
            >
              {status}: {count}
            </span>
          ))}
          {Object.keys(dashboard.counts).length === 0 && (
            <span className="text-xs text-desk-muted">Aucune mémoire locale.</span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 text-xs ${dashboard.readiness.ready ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}
          >
            Agent MEMORY :{' '}
            {dashboard.readiness.ready ? 'prêt' : `bloqué (${dashboard.readiness.code})`}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-28 items-center justify-center text-desk-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {dashboard?.memories.map((memory) => (
            <article
              key={memory.id}
              className="rounded-lg border border-desk-border bg-desk-card p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-desk-muted">
                    <span>{memory.category}</span>
                    <span>· {memory.sourceType}</span>
                    {memory.readingVersion && (
                      <span>· version {memory.readingVersion.version}</span>
                    )}
                    <span>· confiance {Math.round(memory.confidence * 100)}%</span>
                  </div>
                  {editing === memory.id ? (
                    <textarea
                      value={fact}
                      onChange={(event) => setFact(event.target.value)}
                      maxLength={480}
                      className="mt-2 min-h-20 w-full rounded-md border border-desk-border bg-desk-surface p-2 text-sm text-desk-text"
                      aria-label="Modifier le fait mémoire"
                    />
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-desk-text">{memory.fact}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLE[memory.status]}`}
                >
                  {memory.status}
                </span>
              </div>
              <p className="mt-2 text-xs text-desk-muted">
                Vertex : {memory.vertexSynced ? 'synchronisée' : 'en attente ou absente'}
                {memory.pendingOperation ? ` · convergence ${memory.pendingOperation}` : ''}
                {memory.lastSyncError ? ` · erreur ${memory.lastSyncError}` : ''}
                {memory.approvedAt
                  ? ` · validée le ${new Date(memory.approvedAt).toLocaleDateString('fr-FR')}`
                  : ''}
              </p>
              {memory.conflictsWith && memory.conflictsWith.length > 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  Conflit potentiel avec {memory.conflictsWith.length} mémoire(s) active(s) de même
                  catégorie.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {memory.status === 'PENDING' && memory.lastSyncError !== 'potential_conflict' && (
                  <Action
                    label="Approuver"
                    icon={<Check className="h-3.5 w-3.5" />}
                    onClick={() =>
                      ask('Approuver cette mémoire et la synchroniser ?', () =>
                        expertApi
                          .post(`/expert/clients/${clientId}/memories/${memory.id}/approve`)
                          .then(() => undefined),
                      )
                    }
                    disabled={running}
                  />
                )}
                {memory.status === 'PENDING' &&
                  memory.conflictsWith?.map((conflict) => (
                    <Action
                      key={conflict.id}
                      label="Remplacer le conflit"
                      icon={<Check className="h-3.5 w-3.5" />}
                      onClick={() =>
                        ask('Remplacer la mémoire active conflictuelle par ce fait ?', () =>
                          expertApi
                            .post(`/expert/clients/${clientId}/memories/${memory.id}/approve`, {
                              conflictResolution: 'SUPERSEDE',
                              supersedeMemoryId: conflict.id,
                            })
                            .then(() => undefined),
                        )
                      }
                      disabled={running}
                    />
                  ))}
                {memory.status === 'PENDING' && memory.lastSyncError === 'potential_conflict' && (
                  <Action
                    label="Conserver les deux"
                    icon={<Check className="h-3.5 w-3.5" />}
                    onClick={() =>
                      ask(
                        'Conserver explicitement les deux faits malgré le conflit potentiel ?',
                        () =>
                          expertApi
                            .post(`/expert/clients/${clientId}/memories/${memory.id}/approve`, {
                              conflictResolution: 'KEEP_BOTH',
                              confirmKeepBoth: true,
                            })
                            .then(() => undefined),
                      )
                    }
                    disabled={running}
                  />
                )}
                {editing === memory.id ? (
                  <>
                    <Action
                      label="Enregistrer"
                      icon={<Check className="h-3.5 w-3.5" />}
                      onClick={() =>
                        ask(
                          'Enregistrer cette correction et mettre à jour Vertex si nécessaire ?',
                          () =>
                            expertApi
                              .patch(`/expert/clients/${clientId}/memories/${memory.id}`, { fact })
                              .then(() => undefined),
                        )
                      }
                      disabled={running || fact.trim().length < 16}
                    />
                    <Action
                      label="Annuler"
                      icon={<X className="h-3.5 w-3.5" />}
                      onClick={() => setEditing(null)}
                      disabled={running}
                    />
                  </>
                ) : (
                  <Action
                    label="Modifier"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => {
                      setFact(memory.fact);
                      setEditing(memory.id);
                    }}
                    disabled={
                      running || ['DELETED', 'REJECTED', 'SUPERSEDED'].includes(memory.status)
                    }
                  />
                )}
                <Action
                  label="Rejeter"
                  icon={<X className="h-3.5 w-3.5" />}
                  onClick={() =>
                    ask(
                      'Rejeter cette mémoire ? Toute copie Vertex sera supprimée avant le statut local.',
                      () =>
                        expertApi
                          .post(`/expert/clients/${clientId}/memories/${memory.id}/reject`)
                          .then(() => undefined),
                    )
                  }
                  disabled={
                    running || ['REJECTED', 'DELETED', 'SUPERSEDED'].includes(memory.status)
                  }
                />
                <Action
                  label="Resynchroniser"
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                  onClick={() =>
                    ask('Relancer la synchronisation de cette mémoire ?', () =>
                      expertApi
                        .post(`/expert/clients/${clientId}/memories/${memory.id}/resync`)
                        .then(() => undefined),
                    )
                  }
                  disabled={
                    running ||
                    (!['ACTIVE', 'SYNC_FAILED'].includes(memory.status) && !memory.pendingOperation)
                  }
                />
                <Action
                  label="Supprimer"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() =>
                    ask('Supprimer définitivement cette mémoire locale et sa copie Vertex ?', () =>
                      expertApi
                        .delete(`/expert/clients/${clientId}/memories/${memory.id}`)
                        .then(() => undefined),
                    )
                  }
                  disabled={running || memory.status === 'DELETED'}
                  danger
                />
                {memory.readingVersion && (
                  <Action
                    label="Ouvrir source"
                    icon={<ExternalLink className="h-3.5 w-3.5" />}
                    onClick={() =>
                      window.open(
                        `/admin/studio/${memory.readingVersion?.orderId}`,
                        '_blank',
                        'noopener,noreferrer',
                      )
                    }
                    disabled={running}
                  />
                )}
              </div>
            </article>
          ))}
          {!dashboard?.memories.length && (
            <p className="py-5 text-center text-sm text-desk-muted">
              Aucune mémoire de continuité pour ce client.
            </p>
          )}
        </div>
      )}

      {dashboard && dashboard.jobs.length > 0 && (
        <div className="mt-5 border-t border-desk-border pt-4">
          <h3 className="text-sm font-medium text-desk-text">Jobs mémoire</h3>
          <div className="mt-2 space-y-2">
            {dashboard.jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-desk-card p-2 text-xs text-desk-muted"
              >
                <span>
                  {job.status} · {job.attempts}/{job.maxAttempts}
                  {job.lastError ? ` · ${job.lastError}` : ''}
                </span>
                {['FAILED', 'CANCELLED'].includes(job.status) && (
                  <Action
                    label="Réessayer"
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                    onClick={() =>
                      ask('Relancer manuellement ce job mémoire ?', () =>
                        expertApi
                          .post(`/expert/clients/${clientId}/memory-jobs/${job.id}/retry`)
                          .then(() => undefined),
                      )
                    }
                    disabled={running}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(pending)}
        onClose={() => !running && setPending(null)}
        onConfirm={() => void confirm()}
        title="Confirmer l’action mémoire"
        description={pending?.label || ''}
        confirmLabel="Confirmer"
        variant="warning"
        isLoading={running}
      />
    </section>
  );
}

function Action({
  label,
  icon,
  onClick,
  disabled,
  danger = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-9 items-center gap-1 rounded-md border px-2 text-xs disabled:opacity-50 ${danger ? 'border-red-500/30 text-red-700' : 'border-desk-border text-desk-muted hover:text-desk-text'}`}
    >
      {icon}
      {label}
    </button>
  );
}
