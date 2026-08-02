'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import expertApi from '@/lib/expertApi';
import { ExpertPrivatePhoto } from '@/components/private-media/ExpertPrivatePhoto';

interface ReadingAmendment {
  id: string;
  orderId: string;
  kind: 'PALM_PHOTO';
  reason: string;
  status: 'REQUESTED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  displayStatus: string;
  data: Record<string, unknown>;
  revision: number;
  requestedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  expiresAt: string;
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'En attente du client',
  DRAFT: 'Brouillon client',
  SUBMITTED: 'Reçu · à vérifier',
  APPROVED: 'Approuvé',
  REJECTED: 'Photo à reprendre',
  CANCELLED: 'Annulé',
  EXPIRED: 'Expiré',
};

export function ReadingAmendmentPanel({ orderId }: { orderId: string }) {
  const [items, setItems] = useState<ReadingAmendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [reason, setReason] = useState('La photo de votre paume manque au dossier.');
  const [expiresAt, setExpiresAt] = useState(() => {
    const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await expertApi.get<ReadingAmendment[]>(
        `/expert/orders/${orderId}/amendments`,
      );
      setItems(data);
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger les demandes de complément');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasOpenPalmRequest = useMemo(
    () => items.some((item) => ['REQUESTED', 'DRAFT', 'SUBMITTED'].includes(item.status)),
    [items],
  );

  const createRequest = async () => {
    if (reason.trim().length < 3) {
      toast.error('Précisez brièvement pourquoi la paume est nécessaire.');
      return;
    }
    setCreating(true);
    try {
      await expertApi.post(`/expert/orders/${orderId}/amendments/palm-photo`, {
        reason: reason.trim(),
        expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString(),
      });
      toast.success('Demande envoyée au Sanctuaire');
      setShowRequest(false);
      await load();
    } catch (error: unknown) {
      toast.error('Demande impossible', { description: responseMessage(error) });
    } finally {
      setCreating(false);
    }
  };

  const review = async (
    item: ReadingAmendment,
    action: 'approve' | 'reject' | 'retake' | 'cancel' | 'create-revision',
  ) => {
    let actionReason: string | undefined;
    if (action === 'reject' || action === 'retake') {
      const answer = window.prompt(
        action === 'reject' ? 'Pourquoi refusez-vous cette photo ?' : 'Que doit corriger le client ?',
      );
      if (answer === null || answer.trim().length < 3) return;
      actionReason = answer.trim();
    }
    if (action === 'create-revision') {
      const confirmed = window.confirm(
        'Créer une version révisée avec cette paume ? La lecture, le PDF et les livraisons précédentes resteront conservés.',
      );
      if (!confirmed) return;
      actionReason = 'Révision fondée sur le complément de paume approuvé';
    }
    if (action === 'cancel' && !window.confirm('Annuler cette demande de complément ?')) return;

    setBusyId(item.id);
    try {
      await expertApi.post(`/expert/orders/${orderId}/amendments/${item.id}/${action}`, {
        expectedRevision: item.revision,
        reason: actionReason,
      });
      toast.success(
        action === 'approve'
          ? 'Photo approuvée'
          : action === 'create-revision'
            ? 'Version révisée envoyée en production'
            : action === 'retake'
              ? 'Nouvelle photo demandée'
              : action === 'reject'
                ? 'Photo refusée'
                : 'Demande annulée',
      );
      await load();
    } catch (error: unknown) {
      toast.error('Action impossible', { description: responseMessage(error) });
      if ((error as { response?: { status?: number } })?.response?.status === 409) await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
            <ImagePlus className="h-4 w-4" /> Compléments du dossier
          </p>
          <p className="mt-1 text-xs leading-relaxed text-desk-muted">
            Demandez uniquement l’élément manquant. Le dossier scellé et les lectures livrées ne sont jamais écrasés.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Actualiser les compléments"
          className="rounded-lg p-2 text-desk-muted hover:bg-desk-hover"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-desk-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const busy = busyId === item.id;
            const reviewReason =
              typeof item.data.reviewReason === 'string'
                ? item.data.reviewReason
                : typeof item.data.retakeReason === 'string'
                  ? item.data.retakeReason
                  : null;
            return (
              <article key={item.id} className="rounded-xl border border-desk-border bg-desk-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-desk-text">Photo de la paume</p>
                    <p className="mt-0.5 text-xs text-desk-muted">{item.reason}</p>
                  </div>
                  <span className="rounded-full border border-desk-border px-2.5 py-1 text-[11px] font-medium text-desk-muted">
                    {STATUS_LABELS[item.displayStatus] ?? item.displayStatus}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-desk-subtle">
                  <Clock3 className="h-3.5 w-3.5" />
                  Échéance {new Date(item.expiresAt).toLocaleDateString('fr-FR')}
                </div>

                {reviewReason && (
                  <p className="mt-2 rounded-lg bg-rose-500/5 px-3 py-2 text-xs text-rose-600">
                    {reviewReason}
                  </p>
                )}

                {['SUBMITTED', 'APPROVED'].includes(item.status) && (
                  <div className="mt-3 max-w-[220px]">
                    <ExpertPrivatePhoto
                      orderId={orderId}
                      amendmentId={item.id}
                      kind="palm"
                      alt="Paume transmise en complément"
                      aspectClassName="aspect-[4/5]"
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status === 'SUBMITTED' && (
                    <>
                      <ActionButton
                        disabled={busy}
                        onClick={() => void review(item, 'approve')}
                        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      >
                        Approuver
                      </ActionButton>
                      <ActionButton
                        disabled={busy}
                        onClick={() => void review(item, 'retake')}
                        icon={<RotateCcw className="h-3.5 w-3.5" />}
                      >
                        À reprendre
                      </ActionButton>
                      <ActionButton
                        disabled={busy}
                        onClick={() => void review(item, 'reject')}
                        icon={<XCircle className="h-3.5 w-3.5" />}
                      >
                        Refuser
                      </ActionButton>
                    </>
                  )}
                  {item.status === 'APPROVED' && !item.data.revisionQueuedAt && (
                    <ActionButton
                      disabled={busy}
                      onClick={() => void review(item, 'create-revision')}
                      icon={<Send className="h-3.5 w-3.5" />}
                    >
                      Créer une version révisée
                    </ActionButton>
                  )}
                  {item.data.revisionQueuedAt && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Révision lancée
                    </span>
                  )}
                  {['REQUESTED', 'DRAFT', 'SUBMITTED'].includes(item.status) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void review(item, 'cancel')}
                      className="rounded-lg px-3 py-2 text-xs text-desk-muted hover:bg-desk-hover disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  )}
                  {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-amber-600" />}
                </div>
              </article>
            );
          })}

          {!showRequest && !hasOpenPalmRequest && (
            <button
              type="button"
              onClick={() => setShowRequest(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
            >
              <ImagePlus className="h-4 w-4" /> Demander une photo de la paume
            </button>
          )}

          {showRequest && (
            <div className="space-y-3 rounded-xl border border-amber-500/20 bg-desk-card p-3">
              <label className="block text-xs font-medium text-desk-muted">
                Message au client
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-desk-border bg-desk-surface px-3 py-2 text-sm text-desk-text outline-none focus:border-amber-500"
                />
              </label>
              <label className="block text-xs font-medium text-desk-muted">
                Date limite
                <input
                  type="date"
                  value={expiresAt}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-lg border border-desk-border bg-desk-surface px-3 py-2 text-sm text-desk-text"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => void createRequest()}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequest(false)}
                  className="min-h-11 rounded-lg border border-desk-border px-3 py-2 text-sm text-desk-muted"
                >
                  Fermer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ActionButton({
  children,
  icon,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-desk-border px-3 py-2 text-xs font-medium text-desk-text hover:bg-desk-hover disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}

function responseMessage(error: unknown): string {
  const value = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof value === 'string' ? value : 'Réessayez après actualisation.';
}
