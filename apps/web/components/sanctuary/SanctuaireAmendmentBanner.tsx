'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileQuestion,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';
import {
  SmartPhotoUploader,
  type PhotoUploadState,
} from '@/components/onboarding/SmartPhotoUploader';
import sanctuaireApi from '@/lib/sanctuaireApi';
import { uploadOnboardingPhoto } from '@/lib/onboarding-upload';

type PalmRole = 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';
type ProfileFieldKey =
  | 'birthDate'
  | 'birthPlace'
  | 'specificQuestion'
  | 'facePhotoUrl'
  | 'palmPhotoUrl'
  | 'palmRole';

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
  const [values, setValues] = useState<Record<string, string>>({});
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
    const storedValues = current.data.values ?? {};
    const nextValues = Object.fromEntries(
      Object.entries(storedValues).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    if (current.kind === 'PALM_PHOTO') {
      if (
        current.data.palmRole === 'PALM_LEFT' ||
        current.data.palmRole === 'PALM_RIGHT' ||
        current.data.palmRole === 'PALM_UNKNOWN'
      ) {
        nextValues.palmRole = current.data.palmRole;
      }
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

  const updateValue = (key: string, value: string) => {
    setValues((currentValues) => ({ ...currentValues, [key]: value }));
    setFieldErrors((currentErrors) => {
      const next = { ...currentErrors };
      delete next[key];
      return next;
    });
    setError(null);
  };

  const uploadPhoto = useCallback(
    (kind: 'FACE' | 'PALM') => async (preview: string): Promise<string> => {
      const uploaded = await uploadOnboardingPhoto(preview, kind);
      if (!uploaded) throw new Error('Le stockage privé de la photo a échoué.');
      return uploaded;
    },
    [],
  );

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
              storageRef: values.palmPhotoUrl || undefined,
              palmRole: palmRole(values.palmRole),
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
              storageRef: values.palmPhotoUrl,
              palmRole: palmRole(values.palmRole),
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
      : (current.requestedFields.filter((field) => field !== 'palmRole') as ProfileFieldKey[]);

  return (
    <section className="mx-auto mt-3 w-[calc(100%-1.5rem)] max-w-5xl rounded-2xl border border-horizon-400/25 bg-horizon-400/[0.08] shadow-aube-glow sm:mt-5 sm:w-[calc(100%-3rem)]">
      <button
        type="button"
        onClick={() => editable && setExpanded((value) => !value)}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
        aria-expanded={expanded}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-horizon-400/15 text-horizon-200">
          {approved ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : current.kind === 'PROFILE_FIELDS' ? (
            <FileQuestion className="h-5 w-5" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
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
                value={values[field] ?? ''}
                palmRoleValue={palmRole(values.palmRole)}
                storedPhoto={Boolean(current.data.photoFields?.includes(field))}
                disabled={actionsDisabled}
                error={fieldErrors[field]}
                onChange={(value) => updateValue(field, value)}
                onPalmRoleChange={(value) => updateValue('palmRole', value)}
                uploadPhoto={uploadPhoto(field === 'facePhotoUrl' ? 'FACE' : 'PALM')}
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
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Enregistrer
            </button>
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => void submit()}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-horizon-400 px-4 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
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
  uploadPhoto,
  onUploadStateChange,
}: {
  amendment: ReadingAmendment;
  field: ProfileFieldKey;
  value: string;
  palmRoleValue: PalmRole;
  storedPhoto: boolean;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
  onPalmRoleChange: (value: PalmRole) => void;
  uploadPhoto: (preview: string) => Promise<string>;
  onUploadStateChange: (state: PhotoUploadState) => void;
}) {
  const label = fieldLabel(field);
  if (field === 'facePhotoUrl' || field === 'palmPhotoUrl') {
    const isPalm = field === 'palmPhotoUrl';
    return (
      <div className="space-y-3">
        {isPalm && (
          <div>
            <p className="text-sm font-medium text-ivoire-200">
              Quelle main photographiez-vous ?
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ['PALM_LEFT', 'Gauche'],
                  ['PALM_RIGHT', 'Droite'],
                  ['PALM_UNKNOWN', 'Je ne sais pas'],
                ] as const
              ).map(([role, roleLabel]) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => onPalmRoleChange(role)}
                  disabled={disabled}
                  className={`min-h-[48px] rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                    palmRoleValue === role
                      ? 'border-horizon-300 bg-horizon-400/15 text-horizon-100'
                      : 'border-ivoire-500/[0.07] text-brume-200 hover:bg-brume-700/25'
                  }`}
                >
                  {roleLabel}
                </button>
              ))}
            </div>
          </div>
        )}
        {storedPhoto && !value && (
          <div className="space-y-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3">
            <p className="text-xs text-emerald-200">
              Une photo est déjà enregistrée dans votre brouillon. Vous pouvez la conserver ou la remplacer.
            </p>
            <StoredAmendmentPhoto
              amendmentId={amendment.id}
              kind={isPalm ? 'palm' : 'face'}
              alt={label}
            />
          </div>
        )}
        <SmartPhotoUploader
          key={`${amendment.id}-${field}`}
          label={label}
          description={
            isPalm
              ? 'Toute la paume et les doigts doivent être visibles, sans filtre ni ombre forte.'
              : 'Visage de face, net, bien éclairé, sans filtre.'
          }
          value={value || undefined}
          onChange={onChange}
          uploadPhoto={uploadPhoto}
          onUploadStateChange={onUploadStateChange}
          captureFacingMode={isPalm ? 'environment' : 'user'}
          compact={false}
        />
        {error && <p className="text-sm text-rose-200">{error}</p>}
      </div>
    );
  }

  if (field === 'birthDate') {
    return (
      <label className="block text-sm font-medium text-ivoire-200">
        {label}
        <input
          type="date"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 min-h-[48px] w-full rounded-xl border border-ivoire-500/[0.08] bg-brume-800/30 px-3 py-2 text-base text-ivoire-100 outline-none focus:border-horizon-300 disabled:opacity-50"
        />
        {error && <span className="mt-1 block text-sm text-rose-200">{error}</span>}
      </label>
    );
  }

  if (field === 'specificQuestion') {
    return (
      <label className="block text-sm font-medium text-ivoire-200">
        {label}
        <textarea
          value={value}
          disabled={disabled}
          rows={4}
          maxLength={2000}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 w-full rounded-xl border border-ivoire-500/[0.08] bg-brume-800/30 px-3 py-3 text-base leading-6 text-ivoire-100 outline-none focus:border-horizon-300 disabled:opacity-50"
        />
        {error && <span className="mt-1 block text-sm text-rose-200">{error}</span>}
      </label>
    );
  }

  return (
    <label className="block text-sm font-medium text-ivoire-200">
      {label}
      <input
        type="text"
        value={value}
        disabled={disabled}
        maxLength={180}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-[48px] w-full rounded-xl border border-ivoire-500/[0.08] bg-brume-800/30 px-3 py-2 text-base text-ivoire-100 outline-none focus:border-horizon-300 disabled:opacity-50"
      />
      {error && <span className="mt-1 block text-sm text-rose-200">{error}</span>}
    </label>
  );
}

function StoredAmendmentPhoto({
  amendmentId,
  kind,
  alt,
}: {
  amendmentId: string;
  kind: 'face' | 'palm';
  alt: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    sanctuaireApi
      .get(`/users/reading-amendments/${amendmentId}/photo?kind=${kind}`, {
        responseType: 'blob',
      })
      .then((response) => {
        if (cancelled) return;
        const blob = response.data as Blob;
        if (!(blob instanceof Blob) || blob.size === 0) {
          setFailed(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [amendmentId, kind]);

  if (failed) return null;
  if (!src) {
    return (
      <div className="grid aspect-[4/5] w-28 place-items-center rounded-lg border border-emerald-300/15 bg-brume-900/20">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-200" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="aspect-[4/5] w-28 rounded-lg border border-emerald-300/15 object-cover"
    />
  );
}

function requestedValues(
  amendment: ReadingAmendment,
  values: Record<string, string>,
): Record<string, string> {
  const requested = new Set(amendment.requestedFields);
  const payload: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (requested.has(key) && value.trim()) payload[key] = value.trim();
  }
  if (requested.has('palmRole')) payload.palmRole = palmRole(values.palmRole);
  return payload;
}

function validateRequestedFields(
  amendment: ReadingAmendment,
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const storedPhotos = new Set(amendment.data.photoFields ?? []);
  const requested =
    amendment.kind === 'PALM_PHOTO'
      ? ['palmPhotoUrl', 'palmRole']
      : amendment.requestedFields;
  for (const field of requested) {
    if (field === 'palmRole') continue;
    if (field === 'facePhotoUrl' || field === 'palmPhotoUrl') {
      if (!values[field]?.trim() && !storedPhotos.has(field)) {
        errors[field] = `Ajoutez ${
          field === 'facePhotoUrl' ? 'une photo du visage' : 'une photo de la paume'
        }.`;
      }
      continue;
    }
    if (!values[field]?.trim()) errors[field] = 'Ce champ est requis.';
  }
  return errors;
}

function palmRole(value: string | undefined): PalmRole {
  return value === 'PALM_LEFT' || value === 'PALM_RIGHT' ? value : 'PALM_UNKNOWN';
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    birthDate: 'Date de naissance',
    birthPlace: 'Lieu de naissance',
    specificQuestion: 'Question ou intention de lecture',
    facePhotoUrl: 'Photo du visage',
    palmPhotoUrl: 'Photo de la paume',
  };
  return labels[field] ?? field;
}

function responseMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: string | string[] } } })
    ?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  return error instanceof Error && error.message ? error.message : fallback;
}
