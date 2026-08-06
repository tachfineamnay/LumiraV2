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
  | 'intention'
  | 'facePhotoUrl'
  | 'palmPhotoUrl';
type FieldStatus =
  | 'PRESENT'
  | 'MISSING'
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

type IntentionValue = {
  intentionMode?: 'QUESTION' | 'SITUATION' | 'OPEN';
  openReading?: boolean;
  specificQuestion?: string | null;
  objective?: string | null;
};

interface CompletenessField {
  key: FieldKey;
  label: string;
  inputType: 'date' | 'text' | 'intention' | 'photo';
  required: true;
  status: FieldStatus;
  hasValue: boolean;
  displayValue: string | null;
  currentValue: unknown;
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
    requirementsComplete?: boolean;
    missingFields?: string[];
    invalidFields?: string[];
    [key: string]: unknown;
  };
  revision: number;
  requestedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  expiresAt: string;
  updatedAt: string;
}

const FIELD_LABELS: Record<FieldKey, string> = {
  birthDate: 'Date de naissance',
  birthPlace: 'Lieu de naissance',
  intention: 'Intention de lecture',
  facePhotoUrl: 'Photo du visage',
  palmPhotoUrl: 'Photo de la paume',
};

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'En attente du client',
  DRAFT: 'Brouillon client',
  SUBMITTED: 'Reçu · à vérifier',
  APPROVED: 'Approuvé',
  REJECTED: 'Refusé',
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
          expertApi.get<IntakeCompleteness>(`/expert/orders/${orderId}/intake-completeness`),
        ]);
        setItems(amendments.data);
        setCompleteness(diagnostic.data);
        if (!showRequest) {
          setSelected(
            diagnostic.data.fields
              .filter((field) =>
                ['MISSING', 'INVALID'].includes(field.status) && field.requestable,
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

  const candidateFields = useMemo(
    () => completeness?.fields.filter((field) => field.requestable || field.canMarkInvalid) ?? [],
    [completeness],
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
    const invalidFields = selected.filter((key) => {
      const field = completeness.fields.find((candidate) => candidate.key === key);
      return field?.status === 'INVALID' || field?.status === 'PRESENT';
    });
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
            Les cinq éléments obligatoires sont contrôlés sur la dernière projection effective.
            Toute approbation crée un snapshot distinct sans écraser le dossier scellé.
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
          {completeness && <CompletenessCard completeness={completeness} orderId={orderId} />}

          {items.map((item) => (
            <AmendmentCard
              key={item.id}
              item={item}
              orderId={orderId}
              busy={busyId === item.id}
              onReview={review}
            />
          ))}

          {!showRequest && !hasOpenRequest && candidateFields.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRequest(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
            >
              <Send className="h-4 w-4" />
              {completeness?.complete
                ? 'Demander une correction'
                : 'Demander les informations manquantes'}
            </button>
          )}

          {showRequest && completeness && (
            <RequestForm
              fields={candidateFields}
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

function CompletenessCard({ completeness, orderId }: { completeness: IntakeCompleteness; orderId: string }) {
  return (
    <div className="rounded-xl border border-desk-border bg-desk-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-desk-text">
          {completeness.summary.present}/{completeness.summary.required} éléments obligatoires complets
        </p>
        <span className="text-[11px] text-desk-subtle">{sourceLabel(completeness.source)}</span>
      </div>
      {!completeness.complete && (
        <p className="mt-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-rose-600">
          Production bloquée tant que le dossier n’est pas complet.
        </p>
      )}
      <div className="mt-3 space-y-2">
        {completeness.fields.map((field) => (
          <div key={field.key} className="rounded-lg border border-desk-border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-desk-text">{field.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${fieldStatusClass(field.status)}`}>
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
                  Photo obligatoire non transmise.
                </p>
              )
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-desk-muted">
                {field.displayValue || 'Aucune valeur exploitable transmise'}
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
          <label key={field.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-desk-border px-3 py-2">
            <input
              type="checkbox"
              checked={selected.includes(field.key)}
              onChange={() => onToggle(field.key)}
              className="mt-1 h-4 w-4"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-desk-text">{field.label}</span>
              <span className="block text-xs text-desk-muted">
                {field.status === 'MISSING'
                  ? 'Information obligatoire absente du dossier effectif.'
                  : 'Valeur présente ou invalide : elle sera remplacée après vérification.'}
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
          className="mt-1.5 w-full rounded-lg border border-desk-border bg-desk-surface px-3 py-2 text-sm text-desk-text outline-none focus:border-amber-500"
        />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-desk-border px-3 text-sm text-desk-muted">
          Annuler
        </button>
        <button
          type="button"
          disabled={creating || selected.length === 0}
          onClick={onSubmit}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer
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
  const fields = (
    item.kind === 'PALM_PHOTO' ? ['palmPhotoUrl'] : item.requestedFields.filter((field) => field !== 'palmRole')
  ).filter(isFieldKey);
  const submitted = item.status === 'SUBMITTED';
  const approved = item.status === 'APPROVED';
  const canCreateRevision =
    approved &&
    !item.data.revisionQueuedAt &&
    (item.kind === 'PALM_PHOTO' || item.data.requirementsComplete === true);

  return (
    <article className="rounded-xl border border-desk-border bg-desk-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-desk-text">{fields.map((field) => FIELD_LABELS[field]).join(', ')}</p>
          <p className="mt-1 text-xs leading-relaxed text-desk-muted">{item.reason}</p>
        </div>
        <span className="rounded-full bg-desk-hover px-2 py-1 text-[10px] text-desk-muted">
          {STATUS_LABELS[item.displayStatus] ?? item.displayStatus}
        </span>
      </div>

      {(submitted || approved) && (
        <div className="mt-3 space-y-3">
          {fields.map((field) => (
            <ComparisonRow key={field} item={item} orderId={orderId} field={field} />
          ))}
        </div>
      )}

      {item.data.retakeReason && <Notice>{String(item.data.retakeReason)}</Notice>}
      {item.data.reviewReason && <Notice>{String(item.data.reviewReason)}</Notice>}
      {approved && item.data.requirementsComplete === false && (
        <Notice>
          Ce complément est approuvé, mais le dossier reste incomplet : {(item.data.missingFields ?? []).map(fieldLabel).join(', ')}.
        </Notice>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {submitted && (
          <>
            <ActionButton busy={busy} onClick={() => void onReview(item, 'approve')} icon={<CheckCircle2 className="h-4 w-4" />}>
              Approuver
            </ActionButton>
            <ActionButton busy={busy} onClick={() => void onReview(item, 'retake')} icon={<RotateCcw className="h-4 w-4" />}>
              Reprise
            </ActionButton>
            <ActionButton busy={busy} onClick={() => void onReview(item, 'reject')} icon={<XCircle className="h-4 w-4" />}>
              Refuser
            </ActionButton>
          </>
        )}
        {['REQUESTED', 'DRAFT', 'SUBMITTED'].includes(item.status) && (
          <ActionButton busy={busy} onClick={() => void onReview(item, 'cancel')} icon={<XCircle className="h-4 w-4" />}>
            Annuler
          </ActionButton>
        )}
        {canCreateRevision && (
          <ActionButton busy={busy} onClick={() => void onReview(item, 'create-revision')} icon={<RefreshCw className="h-4 w-4" />}>
            Créer une version révisée
          </ActionButton>
        )}
        {approved && item.data.revisionQueuedAt && (
          <span className="inline-flex items-center gap-2 text-xs text-emerald-600">
            <Clock3 className="h-4 w-4" /> Révision lancée
          </span>
        )}
      </div>
    </article>
  );
}

function ComparisonRow({ item, orderId, field }: { item: ReadingAmendment; orderId: string; field: FieldKey }) {
  const previous = item.data.previousValues?.[field];
  const current = item.data.values?.[field];
  const kind = field === 'facePhotoUrl' ? 'face' : field === 'palmPhotoUrl' ? 'palm' : null;
  return (
    <div className="rounded-lg border border-desk-border p-3">
      <p className="text-xs font-semibold text-desk-text">{FIELD_LABELS[field]}</p>
      {kind ? (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <PhotoColumn label="Avant">
            <ExpertPrivatePhoto orderId={orderId} kind={kind} alt={`${FIELD_LABELS[field]} actuelle`} aspectClassName="aspect-[4/5]" />
          </PhotoColumn>
          <PhotoColumn label="Proposé">
            <ExpertPrivatePhoto orderId={orderId} amendmentId={item.id} kind={kind} alt={`${FIELD_LABELS[field]} proposée`} aspectClassName="aspect-[4/5]" />
          </PhotoColumn>
        </div>
      ) : (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <ValueColumn label="Avant" value={formatValue(field, previous)} />
          <ValueColumn label="Proposé" value={formatValue(field, current)} />
        </div>
      )}
    </div>
  );
}

function PhotoColumn({ label, children }: { label: string; children: ReactNode }) {
  return <div><p className="mb-1 text-[10px] uppercase tracking-wide text-desk-subtle">{label}</p>{children}</div>;
}

function ValueColumn({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-desk-hover p-2"><p className="text-[10px] uppercase tracking-wide text-desk-subtle">{label}</p><p className="mt-1 whitespace-pre-wrap text-xs text-desk-text">{value || 'Non renseigné'}</p></div>;
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-lg bg-desk-hover px-3 py-2 text-xs leading-relaxed text-desk-muted">{children}</p>;
}

function ActionButton({ busy, onClick, icon, children }: { busy: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return <button type="button" disabled={busy} onClick={onClick} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-desk-border px-3 text-xs font-medium text-desk-text hover:bg-desk-hover disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{children}</button>;
}

function formatValue(field: FieldKey, value: unknown): string {
  if (field !== 'intention') return typeof value === 'string' ? value : '';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const intention = value as IntentionValue;
  if (intention.intentionMode === 'OPEN') return 'Lecture ouverte';
  if (intention.intentionMode === 'SITUATION') return `Situation — ${intention.objective ?? ''}`;
  if (intention.intentionMode === 'QUESTION') return `Question — ${intention.specificQuestion ?? ''}`;
  return '';
}

function fieldStatusLabel(status: FieldStatus): string {
  const labels: Record<FieldStatus, string> = {
    PRESENT: 'Présent',
    MISSING: 'Manquant',
    INVALID: 'Inexploitable',
    REQUESTED: 'Demandé',
    DRAFT: 'Brouillon',
    SUBMITTED: 'À vérifier',
    APPROVED: 'Approuvé',
  };
  return labels[status];
}

function fieldStatusClass(status: FieldStatus): string {
  if (status === 'PRESENT' || status === 'APPROVED') return 'bg-emerald-500/10 text-emerald-600';
  if (status === 'SUBMITTED') return 'bg-blue-500/10 text-blue-600';
  if (status === 'REQUESTED' || status === 'DRAFT') return 'bg-amber-500/10 text-amber-600';
  return 'bg-rose-500/10 text-rose-600';
}

function sourceLabel(source: IntakeCompleteness['source']): string {
  if (source === 'EFFECTIVE_SNAPSHOT') return 'Snapshot effectif';
  if (source === 'SEALED_INTAKE') return 'Dossier scellé';
  if (source === 'LEGACY_PROFILE') return 'Profil historique';
  return 'Dossier invalide';
}

function isFieldKey(value: string): value is FieldKey {
  return value in FIELD_LABELS;
}

function fieldLabel(value: string): string {
  return isFieldKey(value) ? FIELD_LABELS[value] : value;
}

function actionSuccess(action: string): string {
  if (action === 'approve') return 'Informations approuvées';
  if (action === 'reject') return 'Informations refusées';
  if (action === 'retake') return 'Reprise demandée';
  if (action === 'create-revision') return 'Version révisée lancée';
  return 'Demande annulée';
}

function responseMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.filter((entry): entry is string => typeof entry === 'string').join(' ');
  return typeof message === 'string' ? message : 'Vérifiez le dossier puis réessayez.';
}
