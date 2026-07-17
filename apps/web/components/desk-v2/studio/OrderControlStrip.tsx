'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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
import type { OrderControlCenter, ProductionJob } from '../production/types';

interface ControlCenterResponse extends OrderControlCenter {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

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

  const launchReading = async () => {
    setBusy(true);
    try {
      await expertApi.post(`/expert/orders/${orderId}/jobs/reading`, {});
      toast.success('Production lancée', {
        description: 'Elle continue côté serveur, même si vous changez de page.',
      });
      await refresh();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error('Lancement impossible', { description: message });
    } finally {
      setBusy(false);
    }
  };

  const launchAudio = async () => {
    setBusy(true);
    try {
      await expertApi.post(`/expert/orders/${orderId}/jobs/audio`);
      toast.success('Audio ajouté à la file', {
        description: 'Vous pouvez continuer à travailler sur une autre commande.',
      });
      await refresh();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error('Génération audio impossible', { description: message });
    } finally {
      setBusy(false);
    }
  };

  const retry = async (job: ProductionJob) => {
    setBusy(true);
    try {
      await expertApi.post(`/expert/production/jobs/${job.id}/retry`);
      toast.success('Traitement relancé');
      await refresh();
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error('Relance impossible', { description: message });
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

  const audioStatus = String(data.assets.audio?.status || 'MISSING');
  const currentJob = data.production;
  const presentation = workflowPresentation(data.workflowState);

  return (
    <section className={`flex-shrink-0 border-b ${presentation.border} ${presentation.background}`}>
      <div className="flex min-h-[56px] flex-wrap items-center gap-3 px-3 py-2 sm:px-4">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${presentation.iconBg}`}>
          {presentation.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-desk-text">{presentation.title}</p>
            {currentJob?.status === 'RUNNING' && (
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                {stageLabel(currentJob.stage)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-desk-muted">{presentation.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {data.workflowState === 'READY_FOR_PRODUCTION' && (
            <button
              type="button"
              onClick={() => void launchReading()}
              disabled={busy}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Lancer la production
            </button>
          )}

          {data.workflowState === 'INCIDENT' && currentJob?.status === 'FAILED' && (
            <button
              type="button"
              onClick={() => void retry(currentJob)}
              disabled={busy}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Réessayer
            </button>
          )}

          {data.order.status === 'COMPLETED' && audioStatus !== 'READY' && !currentJob && (
            <button
              type="button"
              onClick={() => void launchAudio()}
              disabled={busy}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Headphones className="h-4 w-4" />
              )}
              Générer l’audio
            </button>
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
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-desk-border text-desk-muted hover:bg-desk-hover"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t border-desk-border/70 px-4 py-3 lg:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-desk-subtle">
              Dossier client
            </p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <ChecklistItem label="Paiement" done={data.checklist.paymentConfirmed} />
              <ChecklistItem label="Profil validé" done={data.checklist.profileValidated} />
              <ChecklistItem label="Naissance" done={data.checklist.birthData} />
              <ChecklistItem label="Visage" done={data.checklist.facePhoto} />
              <ChecklistItem label="Paume" done={data.checklist.palmPhoto} />
              <ChecklistItem label="Consentement" done={data.checklist.consent} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-desk-subtle">
              Assets
            </p>
            <div className="space-y-1.5 text-xs">
              <AssetRow label="PDF" status={String(data.assets.pdf?.status || 'MISSING')} />
              <AssetRow label="Audio" status={audioStatus} />
              <AssetRow label="E-mail" status={String(data.assets.email?.status || 'PENDING')} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-desk-subtle">
              Traitement courant
            </p>
            {currentJob ? (
              <div className="rounded-lg border border-desk-border bg-desk-card p-2.5 text-xs">
                <p className="font-semibold text-desk-text">
                  {currentJob.type === 'READING_GENERATION' ? 'Lecture' : 'Audio'} ·{' '}
                  {currentJob.status}
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
              <p className="text-xs text-desk-muted">Aucun traitement actif.</p>
            )}
          </div>
        </div>
      )}
    </section>
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

function workflowPresentation(state: OrderControlCenter['workflowState']) {
  switch (state) {
    case 'WAITING_CLIENT':
      return {
        title: 'Éléments client incomplets',
        description: 'La production ne doit pas commencer avant la validation des éléments essentiels.',
        border: 'border-amber-500/30',
        background: 'bg-amber-500/5',
        iconBg: 'bg-amber-500/15 text-amber-600',
        icon: <Circle className="h-4 w-4" />,
      };
    case 'READY_FOR_PRODUCTION':
      return {
        title: 'Dossier prêt à produire',
        description: 'La prise en charge est distincte du lancement de la génération.',
        border: 'border-emerald-500/30',
        background: 'bg-emerald-500/5',
        iconBg: 'bg-emerald-500/15 text-emerald-600',
        icon: <Play className="h-4 w-4" />,
      };
    case 'IN_PRODUCTION':
    case 'ASSETS_IN_PRODUCTION':
      return {
        title: 'Production serveur en cours',
        description: 'Vous pouvez quitter cette commande : le traitement continue indépendamment.',
        border: 'border-blue-500/30',
        background: 'bg-blue-500/5',
        iconBg: 'bg-blue-500/15 text-blue-600',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
      };
    case 'AWAITING_REVIEW':
      return {
        title: 'Lecture prête à réviser',
        description: 'Vérifiez le contenu dans le Studio avant de le sceller.',
        border: 'border-purple-500/30',
        background: 'bg-purple-500/5',
        iconBg: 'bg-purple-500/15 text-purple-600',
        icon: <CheckCircle2 className="h-4 w-4" />,
      };
    case 'READY_FOR_DELIVERY':
      return {
        title: 'PDF prêt · audio à produire',
        description: 'Générez et contrôlez l’audio pour compléter la livraison.',
        border: 'border-amber-500/30',
        background: 'bg-amber-500/5',
        iconBg: 'bg-amber-500/15 text-amber-600',
        icon: <Headphones className="h-4 w-4" />,
      };
    case 'DELIVERED':
      return {
        title: 'Lecture et assets disponibles',
        description: 'Le dossier livré reste accessible dans l’historique client.',
        border: 'border-emerald-500/30',
        background: 'bg-emerald-500/5',
        iconBg: 'bg-emerald-500/15 text-emerald-600',
        icon: <CheckCircle2 className="h-4 w-4" />,
      };
    default:
      return {
        title: 'Incident de production',
        description: 'Consultez l’erreur puis relancez uniquement l’étape concernée.',
        border: 'border-red-500/30',
        background: 'bg-red-500/5',
        iconBg: 'bg-red-500/15 text-red-600',
        icon: <AlertTriangle className="h-4 w-4" />,
      };
  }
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
    GENERATING: 'En cours',
    PENDING: 'En attente',
    SENDING: 'Envoi',
    FAILED: 'Erreur',
  };
  return labels[status] || status;
}
