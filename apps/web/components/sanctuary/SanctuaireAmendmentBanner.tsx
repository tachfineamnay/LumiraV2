'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileQuestion,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';
import {
  SmartPhotoUploader,
  type PhotoUploadState,
} from '@/components/onboarding/SmartPhotoUploader';
import sanctuaireApi from '@/lib/sanctuaireApi';

type PalmRole = 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';
type IntentionMode = 'QUESTION' | 'SITUATION' | 'OPEN';
type ProfileFieldKey =
  | 'birthDate'
  | 'birthPlace'
  | 'intention'
  | 'facePhotoUrl'
  | 'palmPhotoUrl'
  | 'palmRole';

type IntentionValue = {
  intentionMode?: IntentionMode;
  openReading?: boolean;
  specificQuestion?: string | null;
  objective?: string | null;
};

interface ReadingAmendment {
  id: string;
  orderId: string;
  kind: 'PALM_PHOTO' | 'PROFILE_FIELDS';
  requestedFields: string[];
  reason: string;
  status: 'REQUESTED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  displayStatus: string;
  data: {
    values?: Record<string, unknown>;
    photoFields?: string[];
    fieldLabels?: string[];
    palmRole?: PalmRole;
    reviewReason?: string;
    retakeReason?: string;
    [key: string]: unknown;
  };
  revision: number;
  expiresAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

export function SanctuaireAmendmentBanner() {
  const [items, setItems] = useState<ReadingAmendment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [photoStates, setPhotoStates] = useState<Record<string, PhotoUploadState>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await sanctuaireApi.get<ReadingAmendment[]>(
        '/users/reading-amendments',
      );
      setItems(data);
    } catch (requestError) {
      console.error(requestError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const current = useMemo(
    () =>
      items.find((item) => ['REQUESTED', 'DRAFT', 'SUBMITTED'].includes(item.status)) ??
      items.find(
        (item) =>
          item.status === 'APPROVED' &&
          Date.now() - new Date(item.updatedAt).getTime() < 7 * 86_400_000,
      ) ??
      null,
    [items],
  );

  useEffect(() => {
    if (!current) return;
    const nextValues = { ...(current.data.values ?? {}) };
    if (current.kind === 'PALM_PHOTO') {
      nextValues.palmRole = normalizePalmRole(current.data.palmRole);
    }
    if (current.requestedFields.includes('palmRole') && !nextValues.palmRole) {
      nextValues.palmRole = 'PALM_UNKNOWN';
    }
    setValues(nextValues);
    setFieldErrors({});
    setError(null);
    if (current.status === 'REQUESTED' || current.status === 'DRAFT') setExpanded(true);
  }, [current]);

  const showError = (message: string) => {
    setError(message);
    window.requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      errorRef.current?.focus();
    });
  };

  const updateValue = (key: string, value: unknown) => {
    setValues((currentValues) => ({ ...currentValues, [key]: value }));
    setFieldErrors((currentErrors) => {
      const next = { ...currentErrors };
      delete next[key];
      return next;
    });
    setError(null);
  };

  const photoBusy = Object.values(photoStates).some(
    (state) => state === 'preparing' || state === 'uploading',
  );

  const saveDraft = async () => {
    if (!current || !['REQUESTED', 'DRAFT'].includes(current.status) || photoBusy) return;
    setBusy(true);
    setError(null);
    try {
      const payload =
        current.kind === 'PROFILE_FIELDS'
          ? { expectedRevision: current.revision, values: requestedValues(current, values) }
          : {
              expectedRevision: current.revision,
              storageRef: stringValue(values.palmPhotoUrl) || undefined,
              palmRole: normalizePalmRole(values.palmRole),
            };
      const { data } = await sanctuaireApi.patch<ReadingAmendment>(
        `/users/reading-amendments/${current.id}/draft`,
        payload,
      );
      setItems((existing) => existing.map((item) => (item.id === data.id ? data : item)));
    } catch (requestError: unknown) {
      showError(responseMessage(requestError, 'Le brouillon n’a pas pu être enregistré.'));
      if ((requestError as { response?: { status?: number } })?.response?.status === 409) {
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!current || !['REQUESTED', 'DRAFT'].includes(current.status) || photoBusy) return;
    const errors = validateRequestedFields(current, values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showError('Complétez les champs indiqués avant de transmettre.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const payload =
        current.kind === 'PROFILE_FIELDS'
          ? { expectedRevision: current.revision, values: requestedValues(current, values) }
          : {
              expectedRevision: current.revision,
              storageRef: stringValue(values.palmPhotoUrl) || undefined,
              palmRole: normalizePalmRole(values.palmRole),
            };
      const { data } = await sanctuaireApi.post<ReadingAmendment>(
        `/users/reading-amendments/${current.id}/submit`,
        payload,
      );
      setItems((existing) => existing.map((item) => (item.id === data.id ? data : item)));
      setExpanded(false);
      setPhotoStates({});
      setFieldErrors({});
    } catch (requestError: unknown) {
      showError(responseMessage(requestError, 'Les informations n’ont pas pu être transmises.'));
      if ((requestError as { response?: { status?: number } })?.response?.status === 409) {
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading || !current) return null;

  const editable = current.status === 'REQUESTED' || current.status === 'DRAFT';
  const submitted = current.status === 'SUBMITTED';
  const approved = current.status === 'APPROVED';
  const actionsDisabled = busy || photoBusy;
  const visibleFields =
    current.kind === 'PALM_PHOTO'
      ? (['palmPhotoUrl'] as ProfileFieldKey[])
      : current.requestedFields.filter(isVisibleField);

  return (
    <section className="mx-auto mt-3 w-[calc(100%-1.5rem)] max-w-5xl rounded-2xl border border-horizon-400/25 bg-horizon-400/[0.08] shadow-aube-glow sm:mt-5 sm:w-[calc(100%-3rem)]">
      <button
        type="button"
        onClick={() => editable && setExpanded((value) => !value)}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
        aria-expanded={expanded}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-horizon-400/15 text-horizon-200">
          {approved ? <CheckCircle2 className="h-5 w-5" /> : <FileQuestion className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-horizon-200">
            Action demandée par l’expert
          </span>
          <span className="mt-1 block text-sm leading-5 text-ivoire-100">
            {approved
              ? 'Les informations transmises ont été acceptées.'
              : submitted
                ? 'Votre complément a bien été transmis et attend la vérification de l’expert.'
                : current.reason}
          </span>
        </span>
        {editable &&
          (expanded ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-horizon-200" />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-horizon-200" />
          ))}
      </button>

      {submitted && (
        <div className="border-t border-horizon-400/15 px-4 py-3 text-xs text-brume-200 sm:px-5">
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4" /> Transmis. Aucune autre action n’est nécessaire pour le moment.
          </span>
        </div>
      )}

      {editable && expanded && (
        <div className="space-y-5 border-t border-horizon-400/15 px-4 py-5 sm:px-5">
          <div className="rounded-xl border border-ivoire-500/[0.06] bg-brume-800/20 p-3 text-sm leading-6 text-brume-200">
            <p>{current.reason}</p>
            <p className="mt-2 text-xs text-brume-300">
              Échéance : {new Date(current.expiresAt).toLocaleDateString('fr-FR')}.
            </p>
          </div>

          <div className="space-y-5">
            {visibleFields.map((field) => (
              <RequestedField
                key={field}
                amendment={current}
                field={field}
                value={values[field]}
                palmRoleValue={normalizePalmRole(values.palmRole)}
                storedPhoto={Boolean(current.data.photoFields?.includes(field))}
                disabled={actionsDisabled}
                error={fieldErrors[field]}
                onChange={(value) => updateValue(field, value)}
                onPalmRoleChange={(value) => updateValue('palmRole', value)}
                onUploadStateChange={(state) =>
                  setPhotoStates((currentStates) => ({ ...currentStates, [field]: state }))
                }
              />
            ))}
          </div>

          {error && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm leading-5 text-rose-200 outline-none"
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => void saveDraft()}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-ivoire-500/[0.08] px-4 py-3 text-sm font-medium text-ivoire-200 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Enregistrer
            </button>
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => void submit()}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-horizon-400 px-4 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Transmettre
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function RequestedField({
  amendment,
  field,
  value,
  palmRoleValue,
  storedPhoto,
  disabled,
  error,
  onChange,
  onPalmRoleChange,
  onUploadStateChange,
}: {
  amendment: ReadingAmendment;
  field: ProfileFieldKey;
  value: unknown;
  palmRoleValue: PalmRole;
  storedPhoto: boolean;
  disabled: boolean;
  error?: string;
  onChange: (value: unknown) => void;
  onPalmRoleChange: (value: PalmRole) => void;
  onUploadStateChange: (state: PhotoUploadState) => void;
}) {
  if (field === 'intention') {
    const intention = intentionValue(value);
    const mode = intention.intentionMode;
    return (
      <FieldShell label="Intention de lecture" error={error}>
        <div className="grid gap-2 sm:grid-cols-3">
          {([
            ['QUESTION', 'Question précise'],
            ['SITUATION', 'Situation ou direction'],
            ['OPEN', 'Lecture ouverte'],
          ] as const).map(([candidate, label]) => (
            <button
              key={candidate}
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({
                  intentionMode: candidate,
                  openReading: candidate === 'OPEN',
                  specificQuestion: candidate === 'QUESTION' ? intention.specificQuestion ?? '' : null,
                  objective: candidate === 'SITUATION' ? intention.objective ?? '' : null,
                } satisfies IntentionValue)
              }
              className={`min-h-[48px] rounded-xl border px-3 py-2 text-xs font-medium ${
                mode === candidate
                  ? 'border-horizon-300 bg-horizon-400/15 text-horizon-100'
                  : 'border-ivoire-500/[0.07] text-brume-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'QUESTION' && (
          <textarea
            value={intention.specificQuestion ?? ''}
            onChange={(event) => onChange({ ...intention, specificQuestion: event.target.value })}
            rows={4}
            maxLength={2000}
            placeholder="La question que vous souhaitez éclairer…"
            className="mt-3 w-full rounded-xl border border-ivoire-500/[0.08] bg-abyss-700/60 px-3 py-3 text-base text-ivoire-100 outline-none focus:border-horizon-300"
          />
        )}
        {mode === 'SITUATION' && (
          <textarea
            value={intention.objective ?? ''}
            onChange={(event) => onChange({ ...intention, objective: event.target.value })}
            rows={4}
            maxLength={2000}
            placeholder="La situation ou la direction que vous souhaitez comprendre…"
            className="mt-3 w-full rounded-xl border border-ivoire-500/[0.08] bg-abyss-700/60 px-3 py-3 text-base text-ivoire-100 outline-none focus:border-horizon-300"
          />
        )}
        {mode === 'OPEN' && (
          <p className="mt-3 rounded-xl border border-horizon-400/20 bg-horizon-400/10 p-3 text-sm leading-6 text-brume-200">
            Vous choisissez de laisser la lecture s’orienter librement, sans question imposée.
          </p>
        )}
      </FieldShell>
    );
  }

  if (field === 'facePhotoUrl' || field === 'palmPhotoUrl') {
    const isPalm = field === 'palmPhotoUrl';
    const currentValue = stringValue(value);
    return (
      <FieldShell label={isPalm ? 'Photo de la paume' : 'Photo du visage'} error={error}>
        {isPalm && (
          <div className="mb-3">
            <p className="text-sm font-medium text-ivoire-200">Quelle main photographiez-vous ?</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {([
                ['PALM_LEFT', 'Gauche'],
                ['PALM_RIGHT', 'Droite'],
                ['PALM_UNKNOWN', 'Je ne sais pas'],
              ] as const).map(([role, label]) => (
                <button
                  key={role}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPalmRoleChange(role)}
                  className={`min-h-[48px] rounded-xl border px-2 text-xs font-medium ${
                    palmRoleValue === role
                      ? 'border-horizon-300 bg-horizon-400/15 text-horizon-100'
                      : 'border-ivoire-500/[0.07] text-brume-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {storedPhoto && !currentValue && (
          <p className="mb-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">
            Une photo est déjà enregistrée dans ce brouillon privé. Vous pouvez la conserver ou la remplacer.
          </p>
        )}
        <SmartPhotoUploader
          label={isPalm ? 'Paume demandée' : 'Visage demandé'}
          description={
            isPalm
              ? 'Cadrez la paume entière, ouverte et nette.'
              : 'Cadrez le visage de face, avec une lumière naturelle.'
          }
          value={currentValue || undefined}
          onChange={(next) => onChange(next ?? '')}
          onUploadStateChange={onUploadStateChange}
          captureFacingMode={isPalm ? 'environment' : 'user'}
          compact
          privatePreviewUrl={
            storedPhoto
              ? `/api/bff/users/reading-amendments/${amendment.id}/photo?kind=${isPalm ? 'palm' : 'face'}`
              : undefined
          }
        />
      </FieldShell>
    );
  }

  return (
    <FieldShell label={field === 'birthDate' ? 'Date de naissance' : 'Lieu de naissance'} error={error}>
      <input
        type={field === 'birthDate' ? 'date' : 'text'}
        value={stringValue(value)}
        maxLength={field === 'birthPlace' ? 180 : undefined}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-ivoire-500/[0.08] bg-abyss-700/60 px-3 py-3 text-base text-ivoire-100 outline-none focus:border-horizon-300 disabled:opacity-60"
      />
    </FieldShell>
  );
}

function FieldShell({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ivoire-200">{label}</p>
      {children}
      {error && <p className="mt-2 text-xs text-rose-200" role="alert">{error}</p>}
    </div>
  );
}

function requestedValues(
  amendment: ReadingAmendment,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of amendment.requestedFields) {
    if (field === 'palmRole') {
      payload.palmRole = normalizePalmRole(values.palmRole);
      continue;
    }
    if (values[field] !== undefined && values[field] !== '') payload[field] = values[field];
  }
  return payload;
}

function validateRequestedFields(
  amendment: ReadingAmendment,
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const stored = new Set(amendment.data.photoFields ?? []);
  const fields = amendment.kind === 'PALM_PHOTO' ? ['palmPhotoUrl'] : amendment.requestedFields;
  for (const field of fields) {
    if (field === 'palmRole') continue;
    if (field === 'facePhotoUrl' || field === 'palmPhotoUrl') {
      if (!stored.has(field) && !stringValue(values[field]).startsWith('s3://onboarding/')) {
        errors[field] = 'Ajoutez et enregistrez cette photo avant de transmettre.';
      }
      continue;
    }
    if (field === 'intention') {
      const intention = intentionValue(values.intention);
      if (!intention.intentionMode) errors.intention = 'Choisissez un mode d’intention.';
      else if (
        intention.intentionMode === 'QUESTION' &&
        (intention.specificQuestion?.trim().length ?? 0) < 10
      ) {
        errors.intention = 'Formulez votre question en au moins 10 caractères.';
      } else if (
        intention.intentionMode === 'SITUATION' &&
        (intention.objective?.trim().length ?? 0) < 10
      ) {
        errors.intention = 'Décrivez votre situation en au moins 10 caractères.';
      }
      continue;
    }
    const text = stringValue(values[field]).trim();
    if (!text) errors[field] = 'Ce champ est obligatoire.';
    if (field === 'birthPlace' && text.length > 0 && text.length < 2) {
      errors[field] = 'Précisez au moins une ville ou un lieu.';
    }
  }
  return errors;
}

function intentionValue(value: unknown): IntentionValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as IntentionValue;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizePalmRole(value: unknown): PalmRole {
  return value === 'PALM_LEFT' || value === 'PALM_RIGHT' ? value : 'PALM_UNKNOWN';
}

function isVisibleField(value: string): value is Exclude<ProfileFieldKey, 'palmRole'> {
  return ['birthDate', 'birthPlace', 'intention', 'facePhotoUrl', 'palmPhotoUrl'].includes(value);
}

function responseMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.filter((entry): entry is string => typeof entry === 'string').join(' ');
  return typeof message === 'string' ? message : fallback;
}
