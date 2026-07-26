'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  Eye,
  FolderOpen,
  History,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import expertApi from '@/lib/expertApi';
import { useSocket } from '../hooks/useSocket';
import { ReadingDossierDrawer } from './ReadingDossierDrawer';
import { ReadingHistoryPanel } from './ReadingHistoryPanel';
import { ReadingQualityPanel } from './ReadingQualityPanel';
import { SealReadingModal } from './SealReadingModal';
import { StructuredReadingEditor } from './StructuredReadingEditor';
import type { ReadingWorkspacePayload } from './reading-workspace.types';

interface OrderWorkflowProps {
  orderId: string;
}

const PRIORITIES = ['Mission', 'Relations', 'Travail', 'Énergie', 'Créativité', 'Finance'];
const TONES = [
  { value: 'DOUX_ET_CLAIR', label: 'Doux et clair' },
  { value: 'DIRECT_ET_CONCRET', label: 'Direct et concret' },
  { value: 'SYMBOLIQUE_ET_PROFOND', label: 'Symbolique et profond' },
] as const;

type Tone = (typeof TONES)[number]['value'];

type BlockMutationResponse = Pick<
  ReadingWorkspacePayload,
  'reading' | 'revision' | 'quality' | 'restorableBlocks'
>;

export function OrderWorkflow({ orderId }: OrderWorkflowProps) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<ReadingWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState('');
  const [priorities, setPriorities] = useState<string[]>([]);
  const [tone, setTone] = useState<Tone>('DOUX_ET_CLAIR');
  const [dossierOpen, setDossierOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sealModalOpen, setSealModalOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [savingBlockId, setSavingBlockId] = useState<string | null>(null);
  const [revisingBlockId, setRevisingBlockId] = useState<string | null>(null);
  const [restoringBlockId, setRestoringBlockId] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [sendingToScribe, setSendingToScribe] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWorkspace = useCallback(async () => {
    try {
      const { data } = await expertApi.get<ReadingWorkspacePayload>(
        `/expert/orders/${orderId}/reading`,
      );
      setWorkspace(data);
      setOrientation((current) => current || data.order.expertPrompt || '');
      setError(null);
      return data;
    } catch (requestError) {
      console.error(requestError);
      setError('Impossible de charger l’espace de lecture.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const loadWorkspaceRef = useRef(loadWorkspace);
  useEffect(() => {
    loadWorkspaceRef.current = loadWorkspace;
  }, [loadWorkspace]);

  useSocket({
    onGenerationComplete: (event) => {
      if (event.orderId !== orderId) return;
      if (event.success) {
        toast.success('Lecture prête pour révision');
      } else {
        toast.error('La production a échoué', { description: event.error });
      }
      void loadWorkspaceRef.current();
    },
  });

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const processing = workspace?.order.status === 'PROCESSING';
  useEffect(() => {
    if (!processing) {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      pollingRef.current = null;
      return;
    }

    const poll = async () => {
      const next = await loadWorkspaceRef.current();
      if (next?.order.status === 'PROCESSING') {
        pollingRef.current = setTimeout(poll, 5000);
      }
    };
    pollingRef.current = setTimeout(poll, 5000);
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [processing]);

  const applyMutation = (data: BlockMutationResponse) => {
    setWorkspace((current) =>
      current
        ? {
            ...current,
            reading: data.reading,
            revision: data.revision,
            quality: data.quality,
            restorableBlocks: data.restorableBlocks,
          }
        : current,
    );
  };

  const launch = async () => {
    if (orientation.trim().length < 3) {
      toast.error('Ajoutez une orientation experte, même courte.');
      return;
    }
    setLaunching(true);
    try {
      await expertApi.post(`/expert/orders/${orderId}/reading/generate`, {
        orientation: orientation.trim(),
        priorities,
        tone,
      });
      toast.success('Production lancée', {
        description: 'Vous pouvez quitter : le traitement continue côté serveur.',
      });
      await loadWorkspace();
    } catch (requestError: unknown) {
      toast.error('Impossible de lancer la lecture', {
        description: responseMessage(requestError),
      });
    } finally {
      setLaunching(false);
    }
  };

  const saveBlock = async (blockId: string, value: unknown) => {
    if (!workspace) return;
    setSavingBlockId(blockId);
    try {
      const { data } = await expertApi.patch<BlockMutationResponse>(
        `/expert/orders/${orderId}/reading/blocks/${encodeURIComponent(blockId)}`,
        { value, expectedRevision: workspace.revision },
      );
      applyMutation(data);
      toast.success('Bloc enregistré');
    } catch (requestError: unknown) {
      const status = (requestError as { response?: { status?: number } })?.response?.status;
      toast.error(
        status === 409 ? 'La lecture a changé : rechargement nécessaire.' : 'Échec de sauvegarde',
      );
      if (status === 409) await loadWorkspace();
      throw requestError;
    } finally {
      setSavingBlockId(null);
    }
  };

  const reviseBlock = async (blockId: string, instruction: string) => {
    if (!workspace) return;
    setRevisingBlockId(blockId);
    try {
      const { data } = await expertApi.post<BlockMutationResponse>(
        `/expert/orders/${orderId}/reading/blocks/${encodeURIComponent(blockId)}/revise`,
        { instruction, expectedRevision: workspace.revision },
      );
      applyMutation(data);
      toast.success('Bloc corrigé par EDITOR');
    } catch (requestError) {
      toast.error('La correction ciblée a échoué');
      throw requestError;
    } finally {
      setRevisingBlockId(null);
    }
  };

  const restoreBlock = async (blockId: string) => {
    if (!workspace) return;
    setRestoringBlockId(blockId);
    try {
      const { data } = await expertApi.post<BlockMutationResponse>(
        `/expert/orders/${orderId}/reading/blocks/${encodeURIComponent(blockId)}/restore`,
        { expectedRevision: workspace.revision },
      );
      applyMutation(data);
      toast.success('Version précédente restaurée');
    } catch (requestError) {
      toast.error('La restauration a échoué');
      throw requestError;
    } finally {
      setRestoringBlockId(null);
    }
  };

  const repairSafeIssues = async () => {
    setRepairing(true);
    try {
      const { data } = await expertApi.post<BlockMutationResponse>(
        `/expert/orders/${orderId}/reading/quality/repair`,
        { expectedRevision: workspace?.revision },
      );
      applyMutation(data);
      toast.success('Défauts de formatage nettoyés');
    } catch {
      toast.error('Le nettoyage automatique a échoué');
    } finally {
      setRepairing(false);
    }
  };

  const previewPdf = async () => {
    setPreviewing(true);
    try {
      const { data } = await expertApi.post(
        `/expert/orders/${orderId}/reading/preview`,
        {},
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError: unknown) {
      toast.error('Aperçu PDF indisponible', { description: responseMessage(requestError) });
    } finally {
      setPreviewing(false);
    }
  };

  const seal = async () => {
    if (!workspace?.quality) return;
    setSealing(true);
    try {
      await expertApi.post(`/expert/orders/${orderId}/reading/seal`, {
        acknowledgeWarnings: workspace.quality.status === 'WARNING',
      });
      setSealModalOpen(false);
      toast.success('Lecture scellée et envoyée');
      await loadWorkspace();
    } catch (requestError: unknown) {
      toast.error('Scellement impossible', { description: responseMessage(requestError) });
    } finally {
      setSealing(false);
    }
  };

  const reopen = async () => {
    setReopening(true);
    try {
      await expertApi.post(`/expert/orders/${orderId}/reading/reopen`, {});
      toast.success('Lecture réouverte');
      await loadWorkspace();
    } catch {
      toast.error('Réouverture impossible');
    } finally {
      setReopening(false);
    }
  };

  const sendBackToScribe = async () => {
    const instruction = window.prompt('Nouvelles instructions pour SCRIBE', orientation);
    if (instruction === null || instruction.trim().length < 3) return;
    setSendingToScribe(true);
    try {
      await expertApi.post(`/expert/orders/${orderId}/reading/scribe`, {
        orientation: instruction.trim(),
        priorities,
        tone,
      });
      setOrientation(instruction.trim());
      toast.success('Lecture renvoyée au SCRIBE', {
        description:
          'La version actuelle reste disponible jusqu’à la réussite du nouveau brouillon.',
      });
      await loadWorkspace();
    } catch (requestError: unknown) {
      toast.error('Renvoi au SCRIBE impossible', { description: responseMessage(requestError) });
    } finally {
      setSendingToScribe(false);
    }
  };

  if (loading) {
    return (
      <CenteredState
        icon={<Loader2 className="h-8 w-8 animate-spin" />}
        text="Chargement de la lecture…"
      />
    );
  }
  if (error || !workspace) {
    return (
      <CenteredState
        icon={<AlertCircle className="h-10 w-10 text-red-500" />}
        text={error ?? 'Lecture introuvable'}
      />
    );
  }

  const { order, reading, quality, history, restorableBlocks } = workspace;
  const visualWarnings = (
    (
      order.generatedContent as {
        pipeline?: {
          visualObservations?: Array<{ role?: string; imageQuality?: string; warnings?: string[] }>;
        };
      } | null
    )?.pipeline?.visualObservations ?? []
  )
    .filter(
      (observation) =>
        observation.role?.startsWith('PALM_') && observation.imageQuality !== 'USABLE',
    )
    .flatMap((observation) => observation.warnings ?? ['Analyse de la main limitée.']);
  const readOnly = order.status === 'COMPLETED';
  const canSeal = order.status === 'AWAITING_VALIDATION' && quality?.status !== 'BLOCKED';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-desk-bg">
      <header className="flex-shrink-0 border-b border-desk-border bg-desk-surface px-3 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/board')}
              aria-label="Retour au board"
              className="rounded-lg p-2 text-desk-muted hover:bg-desk-hover hover:text-desk-text"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-semibold text-desk-text">
                  {order.user.firstName} {order.user.lastName}
                </h1>
                <StatusBadge status={order.status} quality={quality?.status} />
              </div>
              <p className="truncate text-xs text-desk-muted">
                {order.orderNumber} · espace de supervision
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <HeaderButton
              onClick={() => setDossierOpen(true)}
              icon={<FolderOpen className="h-4 w-4" />}
              label="Dossier"
            />
            <HeaderButton
              onClick={() => setHistoryOpen(true)}
              icon={<History className="h-4 w-4" />}
              label="Historique"
            />
            <button
              type="button"
              onClick={() => void loadWorkspace()}
              aria-label="Actualiser"
              className="rounded-lg p-2.5 text-desk-muted hover:bg-desk-hover hover:text-desk-text"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {!reading && order.status !== 'PROCESSING' ? (
          <PreparationPanel
            orientation={orientation}
            priorities={priorities}
            tone={tone}
            launching={launching}
            onOrientationChange={setOrientation}
            onTogglePriority={(priority) =>
              setPriorities((current) =>
                current.includes(priority)
                  ? current.filter((item) => item !== priority)
                  : [...current, priority],
              )
            }
            onToneChange={setTone}
            onLaunch={() => void launch()}
            onOpenDossier={() => setDossierOpen(true)}
          />
        ) : order.status === 'PROCESSING' ? (
          <ProcessingPanel onReturn={() => router.push('/admin/board')} />
        ) : reading ? (
          <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 p-3 sm:p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <StructuredReadingEditor
              reading={reading}
              readOnly={readOnly}
              savingBlockId={savingBlockId}
              revisingBlockId={revisingBlockId}
              restoringBlockId={restoringBlockId}
              restorableBlocks={restorableBlocks}
              onSaveBlock={saveBlock}
              onReviseBlock={reviseBlock}
              onRestoreBlock={restoreBlock}
            />
            <div className="xl:sticky xl:top-4 xl:self-start">
              <ReadingQualityPanel
                quality={quality}
                isRepairing={repairing}
                onRepair={() => void repairSafeIssues()}
              />
            </div>
          </div>
        ) : null}
      </main>

      {reading && (
        <footer className="flex-shrink-0 border-t border-desk-border bg-desk-surface px-3 py-3 sm:px-5">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-desk-muted">
              Révision {workspace.revision} · sauvegarde et restauration par bloc
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void previewPdf()}
                disabled={previewing || quality?.status === 'BLOCKED'}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-desk-border px-3 text-sm text-desk-muted hover:bg-desk-hover disabled:opacity-50"
              >
                {previewing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Aperçu PDF
              </button>
              {readOnly ? (
                <button
                  type="button"
                  onClick={() => void reopen()}
                  disabled={reopening}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {reopening ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Réouvrir
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void sendBackToScribe()}
                    disabled={sendingToScribe || order.status !== 'AWAITING_VALIDATION'}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-500/40 px-3 text-sm font-semibold text-amber-700 hover:bg-amber-500/10 disabled:opacity-40"
                  >
                    {sendingToScribe ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Renvoyer au SCRIBE
                  </button>
                  <button
                    type="button"
                    onClick={() => setSealModalOpen(true)}
                    disabled={!canSeal || sealing}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" /> Sceller et envoyer
                  </button>
                </>
              )}
            </div>
          </div>
        </footer>
      )}

      <ReadingDossierDrawer
        order={order}
        open={dossierOpen}
        onClose={() => setDossierOpen(false)}
      />
      <ReadingHistoryPanel
        events={history}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
      {quality && (
        <SealReadingModal
          open={sealModalOpen}
          clientName={`${order.user.firstName} ${order.user.lastName}`.trim()}
          orderNumber={order.orderNumber}
          quality={quality}
          isSealing={sealing}
          onCancel={() => setSealModalOpen(false)}
          onConfirm={() => void seal()}
        />
      )}
      {visualWarnings.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 sm:mx-6">
          <strong>Analyse de la main limitée.</strong> {visualWarnings.join(' ')} La lecture reste
          disponible sans chiromancie non vérifiable.
        </div>
      )}
    </div>
  );
}

function HeaderButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-desk-border px-3 text-sm text-desk-muted hover:bg-desk-hover hover:text-desk-text"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function PreparationPanel({
  orientation,
  priorities,
  tone,
  launching,
  onOrientationChange,
  onTogglePriority,
  onToneChange,
  onLaunch,
  onOpenDossier,
}: {
  orientation: string;
  priorities: string[];
  tone: Tone;
  launching: boolean;
  onOrientationChange: (value: string) => void;
  onTogglePriority: (value: string) => void;
  onToneChange: (value: Tone) => void;
  onLaunch: () => void;
  onOpenDossier: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <div className="rounded-3xl border border-desk-border bg-desk-surface p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
              Préparation
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-desk-text">
              Orientez la lecture, puis lancez.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-desk-muted">
              Le dossier complet reste accessible sans imposer une étape supplémentaire.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenDossier}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-desk-border px-3 text-sm text-desk-muted hover:bg-desk-hover"
          >
            <FolderOpen className="h-4 w-4" /> Voir le dossier
          </button>
        </div>

        <div className="mt-7 space-y-6">
          <div>
            <label className="text-sm font-medium text-desk-text">Orientation de l’expert</label>
            <textarea
              value={orientation}
              onChange={(event) => onOrientationChange(event.target.value)}
              rows={6}
              placeholder="Ex. Approfondir la transition professionnelle et la question de la juste place."
              className="mt-2 w-full resize-y rounded-2xl border border-desk-border bg-desk-input px-4 py-3 text-sm leading-6 text-desk-text outline-none focus:border-amber-500/50"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-desk-text">Priorités</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => onTogglePriority(priority)}
                  className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                    priorities.includes(priority)
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-700'
                      : 'border-desk-border bg-desk-card text-desk-muted hover:bg-desk-hover'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-desk-text">Ton</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {TONES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onToneChange(item.value)}
                  className={`rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                    tone === item.value
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-700'
                      : 'border-desk-border bg-desk-card text-desk-muted hover:bg-desk-hover'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onLaunch}
            disabled={launching || orientation.trim().length < 3}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
          >
            {launching ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Play className="h-5 w-5" />
            )}
            Lancer la lecture
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcessingPanel({ onReturn }: { onReturn: () => void }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border border-blue-500/20 bg-desk-surface p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-desk-text">Lecture en production</h2>
        <p className="mt-2 text-sm leading-6 text-desk-muted">
          SCRIBE analyse et rédige, puis EDITOR contrôle la structure et la qualité.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-blue-600">
          <Clock3 className="h-4 w-4" /> Vous pouvez quitter cet écran.
        </div>
        <button
          type="button"
          onClick={onReturn}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" /> Retour au Board
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status, quality }: { status: string; quality?: string }) {
  if (status === 'COMPLETED') {
    return <Badge className="bg-emerald-500/15 text-emerald-700" label="Livrée" />;
  }
  if (status === 'PROCESSING') {
    return <Badge className="bg-blue-500/15 text-blue-700" label="Production" />;
  }
  if (quality === 'BLOCKED') {
    return <Badge className="bg-red-500/15 text-red-700" label="Bloquée" />;
  }
  if (quality === 'WARNING') {
    return <Badge className="bg-amber-500/15 text-amber-700" label="À examiner" />;
  }
  if (quality === 'PASS') {
    return <Badge className="bg-emerald-500/15 text-emerald-700" label="Prête" />;
  }
  return <Badge className="bg-desk-hover text-desk-muted" label={status} />;
}

function Badge({ className, label }: { className: string; label: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  );
}

function CenteredState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-desk-bg p-6 text-center text-desk-muted">
      {icon}
      <p>{text}</p>
    </div>
  );
}

function responseMessage(error: unknown): string | undefined {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
}
