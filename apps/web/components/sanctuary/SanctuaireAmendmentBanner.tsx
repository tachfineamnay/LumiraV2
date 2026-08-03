'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ImagePlus,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { SmartPhotoUploader, type PhotoUploadState } from '@/components/onboarding/SmartPhotoUploader';
import sanctuaireApi from '@/lib/sanctuaireApi';
import { uploadOnboardingPhoto } from '@/lib/onboarding-upload';

type PalmRole = 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';

interface ReadingAmendment {
  id: string;
  orderId: string;
  kind: 'PALM_PHOTO';
  reason: string;
  status: 'REQUESTED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  displayStatus: string;
  data: Record<string, unknown>;
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
  const [storageRef, setStorageRef] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<PhotoUploadState>('idle');
  const [palmRole, setPalmRole] = useState<PalmRole>('PALM_UNKNOWN');
  const [error, setError] = useState<string | null>(null);
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
    const dataRole = current.data.palmRole;
    if (dataRole === 'PALM_LEFT' || dataRole === 'PALM_RIGHT' || dataRole === 'PALM_UNKNOWN') {
      setPalmRole(dataRole);
    }
    const ref = typeof current.data.storageRef === 'string' ? current.data.storageRef : null;
    setStorageRef(ref);
    if (current.status === 'REQUESTED' || current.status === 'DRAFT') setExpanded(true);
  }, [current]);

  const showError = (message: string) => {
    setError(message);
    window.requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      errorRef.current?.focus();
    });
  };

  const uploadPalmPhoto = useCallback(async (preview: string): Promise<string> => {
    const uploaded = await uploadOnboardingPhoto(preview, 'PALM');
    if (!uploaded) throw new Error('Le stockage privé de la photo a échoué.');
    return uploaded;
  }, []);

  const photoBusy = photoState === 'preparing' || photoState === 'uploading';

  const saveDraft = async () => {
    if (!current || !['REQUESTED', 'DRAFT'].includes(current.status) || photoBusy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await sanctuaireApi.patch<ReadingAmendment>(
        `/users/reading-amendments/${current.id}/draft`,
        {
          expectedRevision: current.revision,
          storageRef: storageRef || undefined,
          palmRole,
        },
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
    if (!storageRef) {
      showError('Ajoutez une photo nette de votre paume avant de la transmettre.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { data } = await sanctuaireApi.post<ReadingAmendment>(
        `/users/reading-amendments/${current.id}/submit`,
        {
          expectedRevision: current.revision,
          storageRef,
          palmRole,
        },
      );
      setItems((existing) => existing.map((item) => (item.id === data.id ? data : item)));
      setExpanded(false);
      setPhotoState('idle');
    } catch (requestError: unknown) {
      showError(responseMessage(requestError, 'La photo n’a pas pu être transmise.'));
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

  return (
    <section className="mx-auto mt-3 w-[calc(100%-1.5rem)] max-w-5xl rounded-2xl border border-horizon-400/25 bg-horizon-400/[0.08] shadow-aube-glow sm:mt-5 sm:w-[calc(100%-3rem)]">
      <button
        type="button"
        onClick={() => editable && setExpanded((value) => !value)}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
        aria-expanded={expanded}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-horizon-400/15 text-horizon-200">
          {approved ? <CheckCircle2 className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-horizon-200">
            Action demandée par l’expert
          </span>
          <span className="mt-1 block text-sm leading-5 text-ivoire-100">
            {approved
              ? 'Votre photo de paume a été acceptée.'
              : submitted
                ? 'Votre photo a bien été transmise et attend la vérification de l’expert.'
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
            <Clock3 className="h-4 w-4" /> Transmise. Aucune autre action n’est nécessaire pour le moment.
          </span>
        </div>
      )}

      {editable && expanded && (
        <div className="space-y-5 border-t border-horizon-400/15 px-4 py-5 sm:px-5">
          <div className="rounded-xl border border-ivoire-500/[0.06] bg-brume-800/20 p-3 text-sm leading-6 text-brume-200">
            Photographiez toute la paume, doigts visibles, avec une lumière uniforme. Évitez le flou, les ombres fortes et les filtres.
          </div>

          <div>
            <p className="text-sm font-medium text-ivoire-200">Quelle main photographiez-vous ?</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(
                [
                  ['PALM_LEFT', 'Gauche'],
                  ['PALM_RIGHT', 'Droite'],
                  ['PALM_UNKNOWN', 'Je ne sais pas'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPalmRole(value)}
                  disabled={actionsDisabled}
                  className={`min-h-[48px] rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                    palmRole === value
                      ? 'border-horizon-300 bg-horizon-400/15 text-horizon-100'
                      : 'border-ivoire-500/[0.07] text-brume-200 hover:bg-brume-700/25'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,260px)_1fr]">
            <SmartPhotoUploader
              key={current.id}
              label="Photo de la paume"
              description="Choisissez une photo ou utilisez l’appareil. Elle sera automatiquement optimisée avant l’envoi privé."
              value={storageRef || undefined}
              onChange={(value) => {
                setStorageRef(value);
                setError(null);
              }}
              uploadPhoto={uploadPalmPhoto}
              onUploadStateChange={setPhotoState}
              captureFacingMode="environment"
              compact={false}
            />

            <div className="flex flex-col justify-between gap-4">
              <div className="space-y-2 text-xs leading-5 text-brume-300">
                <p>Photos JPEG, PNG, WebP et formats photo courants.</p>
                <p>Les images jusqu’à 20 Mo sont automatiquement réduites.</p>
                <p>La photo reste privée et liée à votre compte.</p>
                <p>Échéance : {new Date(current.expiresAt).toLocaleDateString('fr-FR')}.</p>
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
                  disabled={actionsDisabled || !storageRef}
                  onClick={() => void submit()}
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-horizon-400 px-4 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Transmettre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function responseMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: string | string[] } } })?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  return error instanceof Error && error.message ? error.message : fallback;
}
