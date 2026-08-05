'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FileQuestion,
  Loader2,
  RefreshCw,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import expertApi from '@/lib/expertApi';
import { ExpertPrivatePhoto } from '@/components/private-media/ExpertPrivatePhoto';

type FieldKey =
  | 'birthDate'
  | 'birthPlace'
  | 'specificQuestion'
  | 'facePhotoUrl'
  | 'palmPhotoUrl';
type FieldStatus =
  | 'PRESENT'
  | 'MISSING'
  | 'OPTIONAL'
  | 'INVALID'
  | 'REQUESTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED';
type AmendmentStatus =
  | 'REQUESTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

interface CompletenessField {
  key: FieldKey;
  label: string;
  inputType: 'date' | 'text' | 'textarea' | 'photo';
  required: boolean;
  status: FieldStatus;
  hasValue: boolean;
  displayValue: string | null;
  requestable: boolean;
  canMarkInvalid: boolean;
  activeAmendmentId: string | null;
  photoKind: 'face' | 'palm' | null;
}

interface IntakeCompleteness {
  orderId: string;
  source: 'EFFECTIVE_SNAPSHOT' | 'SEALED_INTAKE' | 'LEGACY_PROFILE' | 'INVALID_INTAKE';
  complete: boolean;
  summary: {
    required: number;
    present: number;
    missing: number;
    invalid: number;
    requested: number;
    submitted: number;
  };
  fields: CompletenessField[];
}

interface ReadingAmendment {
  id: string;
  orderId: string;
  kind: 'PALM_PHOTO' | 'PROFILE_FIELDS';
  requestedFields: string[];
  reason: string;
  status: AmendmentStatus;
  displayStatus: string;
  data: {
    values?: Record<string, unknown>;
    previousValues?: Record<string, unknown>;
    photoFields?: string[];
    fieldLabels?: string[];
    revisionQueuedAt?: string | null;
    reviewReason?: string;
    retakeReason?: string;
    [key: string]: unknown;
  };
  revision: number;
  expiresAt: string;
}

const FIELD_LABELS: Record<FieldKey, string> = {
  birthDate: 'Date de naissance',
  birthPlace: 'Lieu de naissance',
  specificQuestion: 'Question ou intention de lecture',
  facePhotoUrl: 'Photo du visage',
  palmPhotoUrl: 'Photo de la paume',
};

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'En attente du client',
  DRAFT: 'Brouillon client',
  SUBMITTED: 'Reçu · à vérifier',
  APPROVED: 'Approuvé',
  REJECTED: 'À reprendre',
  CANCELLED: 'Annulé',
  EXPIRED: 'Expiré',
};

export function ReadingAmendmentPanel({ orderId }: { orderId: string }) {
  const [items, setItems] = useState<ReadingAmendment[]>([]);
  const [completeness, setCompleteness] = useState<IntakeCompleteness | null>(null);
  const [selected, setSelected] = useState<FieldKey[]>([]);
  const [reason, setReason] = useState(
    'Merci de compléter les informations indispensables à votre lecture.',
  );
  const [expiresAt, setExpiresAt] = useState(() => {
    const date = new Date(Date.now() + 7 * 86_400_000);
    return date.toISOString().slice(0, 10);
  });
  const [showRequest, setShowRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      try {
        const [amendments, diagnostic] = await Promise.all([
          expertApi.get<ReadingAmendment[]>(`/expert/orders/${orderId}/amendments`),
          expertApi.get<IntakeCompleteness>(
            `/expert/orders/${orderId}/intake-completeness`,
          ),
        ]);
        setItems(amendments.data);
        setCompleteness(diagnostic.data);
        if (!showRequest) {
          setSelected(
            diagnostic.data.fields
              .filter(
                (field) =>
                  field.required && field.status === 'MISSING' && field.requestable,
              )
              .map((field) => field.key),
          );
        }
      } catch (error) {
        console.error(error);
        if (!silent) toast.error('Impossible de charger la complétude du dossier');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [orderId, showRequest],
  );

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const hasOpenRequest = useMemo(
    () => items.some((item) => ['REQUESTED', 'DRAFT', 'SUBMITTED'].includes(item.status)),
    [items],
  );

  const createRequest = async () => {
    if (!completeness || selected.length === 0) {
      toast.error('Sélectionnez au moins une information.');
      return;
    }
    if (reason.trim().length < 3) {
      toast.error('Ajoutez un message clair pour le client.');
      return;
    }
    const invalidFields = selected.filter(
      (key) => completeness.fields.find((field) => field.key === key)?.hasValue,
    );
    setCreating(true);
    try {
      await expertApi.post(`/expert/orders/${orderId}/amendments/required-fields`, {
        fields: selected,
        invalidFields,
        reason: reason.trim(),
        expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString(),
      });
      toast.success('Demande envoyée au Sanctuaire');
      setShowRequest(false);
      await load();
    } catch (error) {
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
        action === 'reject'
          ? 'Pourquoi refusez-vous ces informations ?'
          : 'Que doit corriger le client ?',
      );
      if (!answer?.trim() || answer.trim().length < 3) return;
      actionReason = answer.trim();
    }
    if (action === 'create-revision') {
      if (
        !window.confirm(
          'Créer une version révisée ? Les lectures, PDF, audios et livraisons précédents resteront conservés.',
        )
      ) {
        return;
      }
      actionReason = 'Révision fondée sur les informations complémentaires approuvées';
    }
    if (action === 'cancel' && !window.confirm('Annuler cette demande ?')) return;

    setBusyId(item.id);
    try {
      await expertApi.post(`/expert/orders/${orderId}/amendments/${item.id}/${action}`, {
        expectedRevision: item.revision,
        reason: actionReason,
      });
      toast.success(actionSuccess(action));
      await load();
    } catch (error) {
      toast.error('Action impossible', { description: responseMessage(error) });
      if ((error as { response?: { status?: number } })?.response?.status === 409) {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
            <FileQuestion className="h-4 w-4" /> Complétude du dossier
          </p>
          <p className="mt-1 text-xs leading-relaxed text-desk-muted">
            Valeurs effectives transmises par le client. Toute approbation crée un snapshot
            distinct sans écraser le dossier scellé.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Actualiser la complétude"
          className="rounded-lg p-2 text-desk-muted hover:bg-desk-hover"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-6 text-desk-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {completeness && (
            <CompletenessCard completeness={completeness} orderId={orderId} />
          )}

          {items.map((item) => (
            <AmendmentCard
              key={item.id}
              item={item}
              orderId={orderId}
              busy={busyId === item.id}
              onReview={review}
            />
          ))}

          {!showRequest &&
            !hasOpenRequest &&
            Boolean(completeness?.fields.some((field) => field.requestable)) && (
              <button
                type="button"
                onClick={() => setShowRequest(true)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
              >
                <Send className="h-4 w-4" />
                {completeness?.complete
                  ? 'Demander une photo ou une correction'
                  : 'Demander les informations manquantes'}
              </button>
            )}

          {showRequest && completeness && (
            <RequestForm
              fields={completeness.fields.filter((field) => field.requestable)}
              selected={selected}
              reason={reason}
              expiresAt={expiresAt}
              creating={creating}
              onToggle={(key) =>
                setSelected((current) =>
                  current.includes(key)
                    ? current.filter((field) => field !== key)
                    : [...current, key],
                )
              }
              onReason={setReason}
              onExpiresAt={setExpiresAt}
              onSubmit={() => void createRequest()}
              onClose={() => setShowRequest(false)}
            />
          )}
        </div>
      )}
    </section>
  );
}

function CompletenessCard({
  completeness,
  orderId,
}: {
  completeness: IntakeCompleteness;
  orderId: string;
}) {
  return (
    <div className="rounded-xl border border-desk-border bg-desk-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-desk-text">
          {completeness.summary.present}/{completeness.summary.required} éléments obligatoires complets
        </p>
        <span className="text-[11px] text-desk-subtle">
          {sourceLabel(completeness.source)}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {completeness.fields.map((field) => (
          <div key={field.key} className="rounded-lg border border-desk-border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-desk-text">{field.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${fieldStatusClass(field.status)}`}
              >
                {fieldStatusLabel(field.status)}
              </span>
            </div>
            {field.photoKind ? (
              field.hasValue ? (
                <div className="mt-2 max-w-[150px]">
                  <ExpertPrivatePhoto
                    orderId={orderId}
                    kind={field.photoKind}
                    alt={field.label}
                    aspectClassName="aspect-[4/5]"
                  />
                </div>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-desk-muted">
                  Photo facultative non transmise. L’expert peut la demander si elle est utile à la lecture.
                </p>
              )
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-desk-muted">
                {field.displayValue ||
                  (field.required ? 'Aucune valeur transmise' : 'Non requis pour ce dossier')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestForm({
  fields,
  selected,
  reason,
  expiresAt,
  creating,
  onToggle,
  onReason,
  onExpiresAt,
  onSubmit,
  onClose,
}: {
  fields: CompletenessField[];
  selected: FieldKey[];
  reason: string;
  expiresAt: string;
  creating: boolean;
  onToggle: (key: FieldKey) => void;
  onReason: (value: string) => void;
  onExpiresAt: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-amber-500/20 bg-desk-card p-3">
      <div className="space-y-2">
        <p className="text-xs font-medium text-desk-muted">Informations à demander</p>
        {fields.map((field) => (
          <label
            key={field.key}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-desk-border px-3 py-2"
          >
            <input
              type="checkbox"
              checked={selected.includes(field.key)}
              onChange={() => onToggle(field.key)}
              className="mt-1 h-4 w-4"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-desk-text">{field.label}</span>
              <span className="block text-xs text-desk-muted">
                {field.hasValue
                  ? 'Valeur présente : elle sera signalée comme inexploitable puis remplacée.'
                  : field.required
                    ? 'Information obligatoire absente du dossier effectif.'
                    : 'Photo facultative : demandez-la seulement si elle est nécessaire à cette lecture.'}
              </span>
            </span>
          </label>
        ))}
      </div>
      <label className="block text-xs font-medium text-desk-muted">
        Message au client
        <textarea
          value={reason}
          onChange={(event) => onReason(event.target.value)}
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
          onChange={(event) => onExpiresAt(event.target.value)}
          className="mt-1.5 min-h-11 w-full rounded-lg border border-desk-border bg-desk-surface px-3 py-2 text-sm text-desk-text"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={creating || selected.length === 0}
          onClick={onSubmit}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-lg border border-desk-border px-3 py-2 text-sm text-desk-muted"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

function AmendmentCard({
  item,
  orderId,
  busy,
  onReview,
}: {
  item: ReadingAmendment;
  orderId: string;
  busy: boolean;
  onReview: (
    item: ReadingAmendment,
    action: 'approve' | 'reject' | 'retake' | 'cancel' | 'create-revision',
  ) => Promise<void>;
}) {
  const requested = item.requestedFields.filter((field) => field !== 'palmRole');
  const values = item.data.values ?? {};
  const previous = item.data.previousValues ?? {};
  const photoFields = new Set(item.data.photoFields ?? []);
  const title =
    item.kind === 'PALM_PHOTO'
      ? FIELD_LABELS.palmPhotoUrl
      : (item.data.fieldLabels ?? requested.map((field) => fieldLabel(field))).join(' · ');
  const reviewReason =
    typeof item.data.reviewReason === 'string'
      ? item.data.reviewReason
      : typeof item.data.retakeReason === 'string'
        ? item.data.retakeReason
        : null;

  return (
    <article className="rounded-xl border border-desk-border bg-desk-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-desk-text">{title}</p>
          <p className="mt-0.5 text-xs text-desk-muted">{item.reason}</p>
        </div>
        <span className="rounded-full border border-desk-border px-2.5 py-1 text-[11px] font-medium text-desk-muted">
          {STATUS_LABELS[item.displayStatus] ?? item.displayStatus}
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-desk-subtle">
        <Clock3 className="h-3.5 w-3.5" />
        Échéance {new Date(item.expiresAt).toLocaleDateString('fr-FR')}
      </p>

      {reviewReason && (
        <p className="mt-2 rounded-lg bg-rose-500/5 px-3 py-2 text-xs text-rose-600">
          {reviewReason}
        </p>
      )}

      {['SUBMITTED', 'APPROVED'].includes(item.status) && (
        <div className="mt-3 space-y-2">
          {(item.kind === 'PALM_PHOTO' ? ['palmPhotoUrl'] : requested).map((field) => {
            if (field === 'facePhotoUrl' || field === 'palmPhotoUrl') {
              if (!photoFields.has(field)) return null;
              const kind = field === 'facePhotoUrl' ? 'face' : 'palm';
              return (
                <div key={field} className="max-w-[180px]">
                  <p className="mb-1 text-xs font-medium text-desk-subtle">
                    {fieldLabel(field)}
                  </p>
                  <ExpertPrivatePhoto
                    orderId={orderId}
                    amendmentId={item.id}
                    kind={kind}
                    alt={`${fieldLabel(field)} transmise en complément`}
                    aspectClassName="aspect-[4/5]"
                  />
                </div>
              );
            }
            return (
              <div key={field} className="rounded-lg border border-desk-border p-2">
                <p className="text-xs font-medium text-desk-subtle">{fieldLabel(field)}</p>
                {typeof previous[field] === 'string' && previous[field] && (
                  <p className="mt-1 text-xs text-desk-muted line-through opacity-70">
                    Ancien : {String(previous[field])}
                  </p>
                )}
                <p className="mt-1 whitespace-pre-wrap text-sm text-desk-text">
                  {typeof values[field] === 'string' ? String(values[field]) : 'Non renseigné'}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {item.status === 'SUBMITTED' && (
          <>
            <ActionButton
              disabled={busy}
              onClick={() => void onReview(item, 'approve')}
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Approuver
            </ActionButton>
            <ActionButton
              disabled={busy}
              onClick={() => void onReview(item, 'retake')}
              icon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              À reprendre
            </ActionButton>
            <ActionButton
              disabled={busy}
              onClick={() => void onReview(item, 'reject')}
              icon={<XCircle className="h-3.5 w-3.5" />}
            >
              Refuser
            </ActionButton>
          </>
        )}
        {item.status === 'APPROVED' && !item.data.revisionQueuedAt && (
          <ActionButton
            disabled={busy}
            onClick={() => void onReview(item, 'create-revision')}
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
            onClick={() => void onReview(item, 'cancel')}
            className="rounded-lg px-3 py-2 text-xs text-desk-muted hover:bg-desk-hover disabled:opacity-50"
          >
            Annuler
          </button>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-amber-600" />}
      </div>
    </article>
  );
}

function ActionButton({
  children,
  icon,
  disabled,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
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

function fieldLabel(field: string): string {
  return FIELD_LABELS[field as FieldKey] ?? field;
}

function fieldStatusLabel(status: FieldStatus): string {
  const labels: Record<FieldStatus, string> = {
    PRESENT: 'Présent',
    MISSING: 'Manquant',
    OPTIONAL: 'Facultatif',
    INVALID: 'Inexploitable',
    REQUESTED: 'Demandé',
    DRAFT: 'Brouillon',
    SUBMITTED: 'Reçu',
    APPROVED: 'Approuvé',
  };
  return labels[status];
}

function fieldStatusClass(status: FieldStatus): string {
  if (status === 'PRESENT' || status === 'APPROVED') {
    return 'bg-emerald-500/10 text-emerald-600';
  }
  if (status === 'MISSING' || status === 'INVALID') {
    return 'bg-rose-500/10 text-rose-600';
  }
  if (status === 'OPTIONAL') return 'bg-slate-500/10 text-desk-muted';
  if (status === 'SUBMITTED') return 'bg-blue-500/10 text-blue-600';
  return 'bg-amber-500/10 text-amber-600';
}

function sourceLabel(source: IntakeCompleteness['source']): string {
  return {
    EFFECTIVE_SNAPSHOT: 'Snapshot effectif',
    SEALED_INTAKE: 'Dossier scellé',
    LEGACY_PROFILE: 'Profil historique',
    INVALID_INTAKE: 'Dossier incomplet',
  }[source];
}

function actionSuccess(action: string): string {
  return {
    approve: 'Informations approuvées',
    reject: 'Informations refusées',
    retake: 'Correction demandée au client',
    cancel: 'Demande annulée',
    'create-revision': 'Version révisée envoyée en production',
  }[action] ?? 'Action terminée';
}

function responseMessage(error: unknown): string {
  const value = (error as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data?.message;
  if (Array.isArray(value)) return value.join(' ');
  return typeof value === 'string' ? value : 'Réessayez après actualisation.';
}
