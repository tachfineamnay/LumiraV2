'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Headphones,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import expertApi from '@/lib/expertApi';
import type { OrderControlCenter } from '../production/types';

interface ControlCenterResponse extends OrderControlCenter {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    user: { firstName: string; lastName: string };
  };
}

type WorkflowPresentation = {
  title: string;
  description: string;
  border: string;
  background: string;
  iconBg: string;
  icon: ReactNode;
};

const WORKFLOW_PRESENTATIONS: Record<
  OrderControlCenter['workflowState'],
  WorkflowPresentation
> = {
  WAITING_CLIENT: {
    title: 'Éléments client incomplets',
    description: 'La production attend la validation des éléments essentiels.',
    border: 'border-amber-500/30',
    background: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/15 text-amber-600',
    icon: <Circle className="h-4 w-4" />,
  },
  READY_FOR_PRODUCTION: {
    title: 'Dossier prêt à produire',
    description: 'La prise en charge est distincte du lancement.',
    border: 'border-emerald-500/30',
    background: 'bg-emerald-500/5',
    iconBg: 'bg-emerald-500/15 text-emerald-600',
    icon: <Play className="h-4 w-4" />,
  },
  IN_PRODUCTION: {
    title: 'Production serveur en cours',
    description: 'Vous pouvez quitter cette commande : le traitement continue.',
    border: 'border-blue-500/30',
    background: 'bg-blue-500/5',
    iconBg: 'bg-blue-500/15 text-blue-600',
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
  },
  AWAITING_REVIEW: {
    title: 'Lecture prête à réviser',
    description: 'Vérifiez le contenu avant de le sceller.',
    border: 'border-purple-500/30',
    background: 'bg-purple-500/5',
    iconBg: 'bg-purple-500/15 text-purple-600',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  ASSETS_IN_PRODUCTION: {
    title: 'Assets en production',
    description: 'Le PDF ou l’audio continue côté serveur.',
    border: 'border-blue-500/30',
    background: 'bg-blue-500/5',
    iconBg: 'bg-blue-500/15 text-blue-600',
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
  },
  READY_FOR_DELIVERY: {
    title: 'PDF prêt · audio à produire',
    description: 'Complétez et contrôlez les assets promis.',
    border: 'border-amber-500/30',
    background: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/15 text-amber-600',
    icon: <Headphones className="h-4 w-4" />,
  },
  DELIVERED: {
    title: 'Lecture et assets disponibles',
    description: 'Le dossier livré reste dans l’historique client.',
    border: 'border-emerald-500/30',
    background: 'bg-emerald-500/5',
    iconBg: 'bg-emerald-500/15 text-emerald-600',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  INCIDENT: {
    title: 'Incident de production',
    description: 'Consultez l’erreur puis relancez uniquement cette étape.',
    border: 'border-red-500/30',
    background: 'bg-red-500/5',
    iconBg: 'bg-red-500/15 text-red-600',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
};

export function OrderControlStrip({ orderId }: { orderId: string }) {
  const [data, setData] = useState<ControlCenterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await expertApi.get<ControlCenterResponse>(
        `/expert/orders/${orderId}/control-center`,
      );
      setData(response.data);
    } catch (error) {
      console.error('[OrderControlStrip] Failed to load', error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const execute = async (action: () => Promise<unknown>, success: string, failure: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success, {
        description: 'Le traitement continue côté serveur, indépendamment de cette page.',
      });
      await refresh();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(failure, { description: message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[52px] items-center gap-2 border-b border-desk-border bg-desk-surface px-4 text-sm text-desk-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Synchronisation du dossier…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/5 px-4 text-sm text-red-600">
        <span>Le centre de contrôle de cette commande est indisponible.</span>
        <button onClick={() => void refresh()} className="inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Réessayer
        </button>
      </div>
    );
  }

  const currentJob = data.production;
  const activeJob =
    currentJob?.status === 'QUEUED' || currentJob?.status === 'RUNNING' ? currentJob : null;
  const failedJob = currentJob?.status === 'FAILED' ? currentJob : null;
  const audioStatus = String(data.assets.audio?.status || 'MISSING');
  const presentation = WORKFLOW_PRESENTATIONS[data.workflowState];
  const canLaunchAudio =
    data.order.status === 'COMPLETED' && audioStatus !== 'READY' && activeJob === null;

  return (
    <section className={`flex-shrink-0 border-b ${presentation.border} ${presentation.background}`}>
      <div className="flex min-h-[56px] flex-wrap items-center gap-3 px-3 py-2 sm:px-4">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${presentation.iconBg}`}>
          {presentation.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-desk-text">{presentation.title}</p>
            {activeJob && (
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                {stageLabel(activeJob.stage)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-desk-muted">{presentation.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {data.workflowState === 'READY_FOR_PRODUCTION' && !activeJob && (
            <ActionButton
              busy={busy}
              icon={<Play className="h-4 w-4" />}
              label="Lancer la production"
              onClick={() =>
                void execute(
                  () => expertApi.post(`/expert/orders/${orderId}/jobs/reading`, {}),
                  'Production lancée',
                  'Lancement impossible',
                )
              }
            />
          )}

          {failedJob && (
            <ActionButton
              busy={busy}
              danger
              icon={<RotateCcw className="h-4 w-4" />}
              label="Réessayer"
              onClick={() =>
                void execute(
                  () => expertApi.post(`/expert/production/jobs/${failedJob.id}/retry`),
                  'Traitement relancé',
                  'Relance impossible',
                )
              }
            />
          )}

          {canLaunchAudio && (
            <ActionButton
              busy={busy}
              icon={<Headphones className="h-4 w-4" />}
              label="Générer l’audio"
              onClick={() =>
                void execute(
                  () => expertApi.post(`/expert/orders/${orderId}/jobs/audio`),
                  'Audio ajouté à la file',
                  'Génération audio impossible',
                )
              }
            />
          )}

          <Link
            href="/admin/production"
            className="hidden min-h-[40px] items-center rounded-lg border border-desk-border px-3 py-2 text-sm text-desk-muted hover:bg-desk-hover sm:inline-flex"
          >
            Production globale
          </Link>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Réduire le contrôle' : 'Afficher le contrôle détaillé'}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-desk-border text-desk-muted hover:bg-desk-hover"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t border-desk-border/70 px-4 py-3 lg:grid-cols-3">
          <DetailGroup title="Dossier client">
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <ChecklistItem label="Paiement" done={data.checklist.paymentConfirmed} />
              <ChecklistItem label="Profil validé" done={data.checklist.profileValidated} />
              <ChecklistItem label="Naissance" done={data.checklist.birthData} />
              <ChecklistItem label="Visage" done={data.checklist.facePhoto} />
              <ChecklistItem label="Paume" done={data.checklist.palmPhoto} />
              <ChecklistItem label="Consentement" done={data.checklist.consent} />
            </div>
          </DetailGroup>

          <DetailGroup title="Assets">
            <div className="space-y-1.5 text-xs">
              <AssetRow label="PDF" status={String(data.assets.pdf?.status || 'MISSING')} />
              <AssetRow label="Audio" status={audioStatus} />
              <AssetRow label="E-mail" status={String(data.assets.email?.status || 'PENDING')} />
            </div>
          </DetailGroup>

          <DetailGroup title="Dernier traitement">
            {currentJob ? (
              <div className="rounded-lg border border-desk-border bg-desk-card p-2.5 text-xs">
                <p className="font-semibold text-desk-text">
                  {currentJob.type === 'READING_GENERATION' ? 'Lecture' : 'Audio'} ·{' '}
                  {statusLabel(currentJob.status)}
                </p>
                <p className="mt-1 text-desk-muted">{stageLabel(currentJob.stage)}</p>
                <p className="mt-1 text-desk-subtle">
                  Tentative {currentJob.attempts}/{currentJob.maxAttempts}
                </p>
                {currentJob.error?.message && (
                  <p className="mt-2 text-red-600">{currentJob.error.message}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-desk-muted">Aucun traitement enregistré.</p>
            )}
          </DetailGroup>
        </div>
      )}
    </section>
  );
}

function ActionButton({
  busy,
  danger = false,
  icon,
  label,
  onClick,
}: {
  busy: boolean;
  danger?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
        danger ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950'
      }`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function DetailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-desk-subtle">{title}</p>
      {children}
    </div>
  );
}

function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-desk-muted">
      {done ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-desk-subtle" />
      )}
      {label}
    </div>
  );
}

function AssetRow({ label, status }: { label: string; status: string }) {
  const ready = status === 'READY' || status === 'SENT';
  const failed = status === 'FAILED';
  return (
    <div className="flex items-center justify-between rounded-lg bg-desk-card px-2.5 py-2">
      <span className="text-desk-muted">{label}</span>
      <span
        className={
          ready
            ? 'font-semibold text-emerald-600'
            : failed
              ? 'font-semibold text-red-600'
              : 'font-semibold text-amber-600'
        }
      >
        {statusLabel(status)}
      </span>
    </div>
  );
}

function stageLabel(stage: string) {
  const labels: Record<string, string> = {
    QUEUED: 'En attente du moteur',
    STARTING: 'Démarrage sécurisé',
    GENERATING_READING: 'Génération de la lecture',
    GENERATING_AUDIO: 'Génération de l’audio',
    RECOVERED_AFTER_RESTART: 'Reprise après interruption',
    COMPLETED: 'Terminé',
    FAILED: 'Échec',
  };
  return labels[stage] || stage.replaceAll('_', ' ').toLowerCase();
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    READY: 'Prêt',
    SENT: 'Envoyé',
    MISSING: 'Manquant',
    QUEUED: 'En file',
    RUNNING: 'En cours',
    SUCCEEDED: 'Terminé',
    CANCELLED: 'Annulé',
    GENERATING: 'En cours',
    PENDING: 'En attente',
    SENDING: 'Envoi',
    FAILED: 'Erreur',
  };
  return labels[status] || status;
}
