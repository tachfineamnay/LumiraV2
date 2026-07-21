'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { FieldPath, useForm } from 'react-hook-form';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  HeartHandshake,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { SmartPhotoUploader, PhotoUploadState } from './SmartPhotoUploader';
import sanctuaireApi from '../../lib/sanctuaireApi';
import { uploadOnboardingPhoto } from '../../lib/onboarding-upload';
import {
  DELIVERY_STYLES,
  LIFE_AREA_KEYS,
  LIFE_AREA_LABELS,
  LIFE_AREA_STATES,
  LIFE_AREA_STATE_LABELS,
  lifeAreasSchema,
  readingPreparationSchema,
  readingPreparationSubmissionSchema,
  type LifeAreaKey,
  type LifeAreas,
  type LifeAreaState,
  type ReadingPreparationData,
} from '../../lib/onboardingSchema';

type StepKey = 'identity' | 'intention' | 'context' | 'photos' | 'review';
type LoadState = 'loading' | 'ready' | 'error' | 'sealed';
type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict';

type StepDefinition = {
  key: StepKey;
  label: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

type DraftResponse = {
  currentStep?: number;
  status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  data?: Record<string, unknown>;
  revision?: number;
  updatedAt?: string;
  orderId?: string;
  canEdit?: boolean;
};

type PersistedDraftData = Omit<ReadingPreparationData, 'consent'> & {
  schemaVersion: 2;
};

type DraftSnapshot = {
  currentStep: number;
  data: PersistedDraftData;
  signature: string;
};

const STEPS: StepDefinition[] = [
  {
    key: 'identity',
    label: 'Repères',
    title: 'Vos repères essentiels',
    description: 'La date et le lieu nous donnent une base fiable. L’heure reste facultative.',
    icon: CalendarDays,
  },
  {
    key: 'intention',
    label: 'Intention',
    title: 'Ce qui vous amène',
    description:
      'Quelques mots suffisent. Vous pouvez aussi raconter librement ce qui compte pour vous.',
    icon: MessageSquareText,
  },
  {
    key: 'context',
    label: 'Contexte',
    title: 'Votre contexte personnel',
    description:
      'Tout est facultatif : partagez seulement ce qui aidera à mieux comprendre votre situation.',
    icon: HeartHandshake,
  },
  {
    key: 'photos',
    label: 'Photos',
    title: 'Vos photos privées',
    description:
      'Visage et paume sont facultatifs. Chaque image est enregistrée dans votre espace privé.',
    icon: ImageIcon,
  },
  {
    key: 'review',
    label: 'Relecture',
    title: 'Relire et confirmer',
    description: 'Vérifiez chaque mot. Cette version deviendra la base immuable de cette lecture.',
    icon: LockKeyhole,
  },
];

const STYLE_OPTIONS = [
  ['DOUX_ET_CLAIR', 'Doux et clair', 'Une formulation apaisée et accessible'],
  ['DIRECT_ET_CONCRET', 'Direct et concret', 'Des repères francs et immédiatement lisibles'],
  ['SYMBOLIQUE_ET_PROFOND', 'Symbolique et profond', 'Une lecture plus imagée et introspective'],
] as const;

const EMPTY_DATA: ReadingPreparationData = {
  usageName: '',
  birthDate: '',
  birthTime: '',
  birthPlace: '',
  specificQuestion: '',
  objective: '',
  openReading: false,
  facePhoto: '',
  palmPhoto: '',
  highs: '',
  lows: '',
  lifeEvents: '',
  lifeAreas: {},
  ailments: '',
  fears: '',
  rituals: '',
  deliveryStyle: 'DOUX_ET_CLAIR',
  pace: 50,
  consent: false,
};

const baseInputClass =
  'mt-2 w-full rounded-xl border bg-abyss-600 px-3 py-3 text-base text-stellar-100 placeholder:text-stellar-600 outline-none transition-colors focus-visible:ring-2';

function inputClass(hasError: boolean) {
  return `${baseInputClass} ${
    hasError
      ? 'border-rose-400/60 focus:border-rose-300 focus-visible:ring-rose-300/30'
      : 'border-white/10 focus:border-horizon-400 focus-visible:ring-horizon-400/30'
  }`;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeLifeAreas(value: unknown): LifeAreas {
  const parsed = lifeAreasSchema.safeParse(value);
  return parsed.success ? (parsed.data as LifeAreas) : {};
}

function normalize(value: unknown): Partial<ReadingPreparationData> {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const normalized: Partial<ReadingPreparationData> = {};
  const has = (key: string) => Object.prototype.hasOwnProperty.call(source, key);

  if (has('usageName')) normalized.usageName = stringValue(source.usageName);
  if (has('birthDate')) {
    const rawBirthDate = stringValue(source.birthDate);
    normalized.birthDate = rawBirthDate.includes('T') ? rawBirthDate.slice(0, 10) : rawBirthDate;
  }
  if (has('birthTime')) normalized.birthTime = stringValue(source.birthTime);
  if (has('birthPlace')) normalized.birthPlace = stringValue(source.birthPlace);
  if (has('specificQuestion')) normalized.specificQuestion = stringValue(source.specificQuestion);
  else if (has('spiritualQuestion')) {
    normalized.specificQuestion = stringValue(source.spiritualQuestion);
  }
  if (has('objective')) normalized.objective = stringValue(source.objective);
  if (has('openReading')) normalized.openReading = source.openReading === true;
  if (has('facePhoto') || has('facePhotoUrl')) {
    normalized.facePhoto = stringValue(source.facePhoto || source.facePhotoUrl);
  }
  if (has('palmPhoto') || has('palmPhotoUrl')) {
    normalized.palmPhoto = stringValue(source.palmPhoto || source.palmPhotoUrl);
  }
  if (has('highs')) normalized.highs = stringValue(source.highs);
  else if (has('strongSide') || has('strongZone')) {
    normalized.highs = [stringValue(source.strongSide), stringValue(source.strongZone)]
      .filter(Boolean)
      .join('\n');
  }
  if (has('lows')) normalized.lows = stringValue(source.lows);
  else if (has('weakSide') || has('weakZone')) {
    normalized.lows = [stringValue(source.weakSide), stringValue(source.weakZone)]
      .filter(Boolean)
      .join('\n');
  }
  if (has('strongSide')) normalized.strongSide = stringValue(source.strongSide);
  if (has('weakSide')) normalized.weakSide = stringValue(source.weakSide);
  if (has('strongZone')) normalized.strongZone = stringValue(source.strongZone);
  if (has('weakZone')) normalized.weakZone = stringValue(source.weakZone);
  if (has('lifeEvents')) normalized.lifeEvents = stringValue(source.lifeEvents);
  if (has('lifeAreas')) normalized.lifeAreas = normalizeLifeAreas(source.lifeAreas);
  if (has('ailments')) normalized.ailments = stringValue(source.ailments);
  if (has('fears')) normalized.fears = stringValue(source.fears);
  if (has('rituals')) normalized.rituals = stringValue(source.rituals);
  if (has('deliveryStyle')) {
    const style = stringValue(source.deliveryStyle);
    normalized.deliveryStyle = DELIVERY_STYLES.includes(style as (typeof DELIVERY_STYLES)[number])
      ? (style as ReadingPreparationData['deliveryStyle'])
      : 'DOUX_ET_CLAIR';
  }
  if (has('pace')) {
    normalized.pace =
      typeof source.pace === 'number' && Number.isFinite(source.pace) ? source.pace : 50;
  }
  return normalized;
}

function persistedData(data: ReadingPreparationData): PersistedDraftData {
  return {
    schemaVersion: 2,
    usageName: data.usageName,
    birthDate: data.birthDate,
    birthTime: data.birthTime,
    birthPlace: data.birthPlace,
    specificQuestion: data.specificQuestion,
    objective: data.objective,
    openReading: data.openReading,
    facePhoto: data.facePhoto.startsWith('s3://onboarding/') ? data.facePhoto : '',
    palmPhoto: data.palmPhoto.startsWith('s3://onboarding/') ? data.palmPhoto : '',
    highs: data.highs,
    lows: data.lows,
    lifeEvents: data.lifeEvents,
    lifeAreas: normalizeLifeAreas(data.lifeAreas),
    strongSide: data.strongSide,
    weakSide: data.weakSide,
    strongZone: data.strongZone,
    weakZone: data.weakZone,
    ailments: data.ailments,
    fears: data.fears,
    rituals: data.rituals,
    deliveryStyle: data.deliveryStyle,
    pace: data.pace,
  };
}

function makeSnapshot(step: number, data: ReadingPreparationData): DraftSnapshot {
  const snapshot = { currentStep: step, data: persistedData(data) };
  return { ...snapshot, signature: JSON.stringify(snapshot) };
}

function normalizeSavedStep(value: unknown, rawData: Record<string, unknown>): number {
  const saved = Number(value);
  if (!Number.isFinite(saved)) return 0;
  if (rawData.schemaVersion === 2) return Math.min(Math.max(saved, 0), STEPS.length - 1);

  // Six-step legacy flow: intro, identity, intention, photos, context, review.
  const legacyMap = [0, 0, 1, 3, 2, 4];
  return legacyMap[Math.min(Math.max(saved, 0), legacyMap.length - 1)] ?? 0;
}

function requestStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: number; response?: { status?: number } };
  return candidate.status ?? candidate.response?.status;
}

function savedTime(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatBirthDate(value: string): string {
  if (!value) return 'À compléter';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function ReadingPreparation({
  onCompleted,
  onClose,
}: {
  onCompleted: () => Promise<void>;
  onClose: () => void;
}) {
  const {
    register,
    reset,
    getValues,
    setValue,
    setError,
    setFocus,
    trigger,
    watch,
    formState: { errors },
  } = useForm<ReadingPreparationData>({
    resolver: zodResolver(readingPreparationSchema),
    defaultValues: EMPTY_DATA,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const [step, setStep] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [mobileViewportHeight, setMobileViewportHeight] = useState<number | null>(null);
  const [draftLoadKey, setDraftLoadKey] = useState(0);
  const [photoStates, setPhotoStates] = useState<Record<'face' | 'palm', PhotoUploadState>>({
    face: 'idle',
    palm: 'idle',
  });

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const mountedRef = useRef(true);
  const loadRequestRef = useRef(0);
  const stepRef = useRef(0);
  const formValuesRef = useRef<ReadingPreparationData>(EMPTY_DATA);
  const revisionRef = useRef<number | undefined>(undefined);
  const orderIdRef = useRef<string | undefined>(undefined);
  const submittingRef = useRef(false);
  const saveEpochRef = useRef(0);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const activeSaveRequestsRef = useRef<Set<AbortController>>(new Set());
  const latestQueuedSignatureRef = useRef('');
  const lastSavedSignatureRef = useRef('');
  const failedSignatureRef = useRef('');
  const pendingPhotoUploadsRef = useRef<Set<Promise<string>>>(new Set());

  const formValues = watch();
  formValuesRef.current = formValues;
  stepRef.current = step;

  const current = STEPS[step];
  const positionProgress = Math.round(((step + 1) / STEPS.length) * 100);
  const orderScopeQuery = orderIdRef.current
    ? `?orderId=${encodeURIComponent(orderIdRef.current)}`
    : '';
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const contextEntries = useMemo(
    () => [
      ['Ce qui vous soutient', formValues.highs],
      ['Ce qui vous pèse ou se répète', formValues.lows],
      ['Une période qui a compté', formValues.lifeEvents],
      ['Contexte corporel partagé', formValues.ailments],
      ['À aborder avec douceur', formValues.fears],
      ['Pratiques qui comptent pour vous', formValues.rituals],
    ],
    [
      formValues.ailments,
      formValues.fears,
      formValues.highs,
      formValues.lifeEvents,
      formValues.lows,
      formValues.rituals,
    ],
  );
  const lifeAreaCount = useMemo(
    () => LIFE_AREA_KEYS.filter((key) => Boolean(formValues.lifeAreas?.[key])).length,
    [formValues.lifeAreas],
  );

  const queueDraftSave = useCallback(
    (snapshot: DraftSnapshot, options: { keepalive?: boolean; force?: boolean } = {}) => {
      const saveEpoch = saveEpochRef.current;
      if (!options.force && snapshot.signature === lastSavedSignatureRef.current) {
        return Promise.resolve(true);
      }
      if (!options.force && snapshot.signature === latestQueuedSignatureRef.current) {
        return saveQueueRef.current;
      }

      latestQueuedSignatureRef.current = snapshot.signature;
      failedSignatureRef.current = '';
      if (mountedRef.current) setSaveState('saving');

      const execute = async (): Promise<boolean> => {
        if (saveEpoch !== saveEpochRef.current) return true;
        const payload: {
          currentStep: number;
          data: PersistedDraftData;
          revision?: number;
          orderId?: string;
        } = {
          currentStep: snapshot.currentStep,
          data: snapshot.data,
        };
        if (revisionRef.current !== undefined) payload.revision = revisionRef.current;
        if (orderIdRef.current) payload.orderId = orderIdRef.current;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 15_000);
        activeSaveRequestsRef.current.add(controller);

        try {
          const response = await fetch('/api/bff/users/onboarding', {
            method: 'PATCH',
            credentials: 'include',
            // Every small draft mutation is allowed to finish if the browser
            // backgrounds or tears down the page; explicit flushes still drain
            // the ordered CAS queue before closing the dialog.
            keepalive: true,
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            const failure = new Error('Draft save failed') as Error & { status?: number };
            failure.status = response.status;
            throw failure;
          }
          const responseData = (await response.json().catch(() => null)) as DraftResponse | null;

          if (saveEpoch !== saveEpochRef.current) return true;
          if (typeof responseData?.revision === 'number') {
            revisionRef.current = responseData.revision;
          }
          const nextUpdatedAt = responseData?.updatedAt || new Date().toISOString();
          lastSavedSignatureRef.current = snapshot.signature;
          failedSignatureRef.current = '';
          if (mountedRef.current) {
            setUpdatedAt(nextUpdatedAt);
            setSaveState('saved');
            setActionError((currentError) =>
              currentError?.startsWith('La sauvegarde') ? null : currentError,
            );
          }
          return true;
        } catch (saveError) {
          if (saveEpoch !== saveEpochRef.current) return true;
          failedSignatureRef.current = snapshot.signature;
          if (latestQueuedSignatureRef.current === snapshot.signature) {
            latestQueuedSignatureRef.current = '';
          }
          if (mountedRef.current) {
            if (requestStatus(saveError) === 409) {
              setSaveState('conflict');
              setActionError(
                'Une version plus récente de ce brouillon existe. Rechargez-la avant de continuer.',
              );
            } else {
              setSaveState('error');
              setActionError(
                'La sauvegarde automatique a échoué. Rien ne sera fermé avant une sauvegarde réussie.',
              );
            }
          }
          return false;
        } finally {
          window.clearTimeout(timeout);
          activeSaveRequestsRef.current.delete(controller);
        }
      };

      const queued = saveQueueRef.current.then(execute, execute);
      saveQueueRef.current = queued;
      return queued;
    },
    [],
  );

  const flushDraft = useCallback(
    async (options: { keepalive?: boolean } = {}) => {
      // Drain every save that was queued before the flush. A user can type B,
      // return to the last-saved value A, then close while B is still in flight;
      // checking A too early would let B overwrite the server after the dialog closes.
      let observedQueue: Promise<boolean>;
      do {
        observedQueue = saveQueueRef.current;
        await observedQueue;
      } while (observedQueue !== saveQueueRef.current);

      const snapshot = makeSnapshot(stepRef.current, formValuesRef.current);
      if (snapshot.signature === lastSavedSignatureRef.current) return true;
      return queueDraftSave(snapshot, { keepalive: options.keepalive });
    },
    [queueDraftSave],
  );

  const loadServerDraft = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    saveEpochRef.current += 1;
    activeSaveRequestsRef.current.forEach((controller) => controller.abort());
    activeSaveRequestsRef.current.clear();
    await saveQueueRef.current.catch(() => false);
    saveQueueRef.current = Promise.resolve(true);
    setLoadState('loading');
    setLoadError('');
    setActionError(null);
    setSaveState('idle');

    try {
      const onboardingRequest = sanctuaireApi
        .get('/users/onboarding', { timeout: 15_000 })
        .catch((error: unknown) => {
          if (requestStatus(error) === 404) return { data: null };
          throw error;
        });
      const [profileResponse, draftResponse] = await Promise.all([
        sanctuaireApi.get('/users/profile', { timeout: 15_000 }),
        onboardingRequest,
      ]);
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;

      const serverDraft = (draftResponse.data ?? null) as DraftResponse | null;
      if (serverDraft?.status === 'COMPLETED' || serverDraft?.canEdit === false) {
        setLoadState('sealed');
        return;
      }

      const rawDraft = serverDraft?.data || {};
      const initialData: ReadingPreparationData = {
        ...EMPTY_DATA,
        ...normalize(profileResponse.data?.profile),
        ...normalize(rawDraft),
        consent: false,
      };
      const initialStep = normalizeSavedStep(serverDraft?.currentStep, rawDraft);
      const savedServerSnapshot = makeSnapshot(initialStep, {
        ...EMPTY_DATA,
        ...normalize(rawDraft),
        consent: false,
      });

      revisionRef.current =
        typeof serverDraft?.revision === 'number' ? serverDraft.revision : undefined;
      orderIdRef.current = serverDraft?.orderId;
      lastSavedSignatureRef.current = savedServerSnapshot.signature;
      latestQueuedSignatureRef.current = savedServerSnapshot.signature;
      failedSignatureRef.current = '';
      formValuesRef.current = initialData;
      stepRef.current = initialStep;
      reset(initialData);
      setStep(initialStep);
      setPhotoStates({ face: 'idle', palm: 'idle' });
      setDraftLoadKey((value) => value + 1);
      setUpdatedAt(serverDraft?.updatedAt || null);
      setSaveState(serverDraft ? 'saved' : 'idle');
      setLoadState('ready');
    } catch (error) {
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;
      const status = requestStatus(error);
      setLoadError(
        status === 401 || status === 403
          ? 'Votre session doit être renouvelée avant de retrouver ce brouillon.'
          : 'Votre brouillon ne peut pas être chargé pour le moment. Aucune donnée ne sera écrasée.',
      );
      setLoadState('error');
    }
  }, [reset]);

  useEffect(() => {
    mountedRef.current = true;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    void loadServerDraft();

    return () => {
      mountedRef.current = false;
      loadRequestRef.current += 1;
      saveEpochRef.current += 1;
      activeSaveRequestsRef.current.forEach((controller) => controller.abort());
      activeSaveRequestsRef.current.clear();
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [loadServerDraft]);

  useEffect(() => {
    if (loadState !== 'ready' || isSubmitting || isComplete || saveState === 'conflict') return;
    const snapshot = makeSnapshot(step, formValues);
    if (
      snapshot.signature === lastSavedSignatureRef.current ||
      snapshot.signature === latestQueuedSignatureRef.current ||
      snapshot.signature === failedSignatureRef.current
    ) {
      return;
    }

    setSaveState('unsaved');
    const timer = window.setTimeout(() => {
      void queueDraftSave(snapshot);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [formValues, isComplete, isSubmitting, loadState, queueDraftSave, saveState, step]);

  useEffect(() => {
    if (loadState !== 'ready' || isComplete) return;
    const persistWhenLeaving = () => {
      if (document.visibilityState === 'hidden') void flushDraft({ keepalive: true });
    };
    const persistOnPageHide = () => void flushDraft({ keepalive: true });
    document.addEventListener('visibilitychange', persistWhenLeaving);
    window.addEventListener('pagehide', persistOnPageHide);
    return () => {
      document.removeEventListener('visibilitychange', persistWhenLeaving);
      window.removeEventListener('pagehide', persistOnPageHide);
    };
  }, [flushDraft, isComplete, loadState]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [loadState, step]);

  useEffect(() => {
    if (!isComplete) return;
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isComplete]);

  useEffect(() => {
    const updateViewportHeight = () => {
      setMobileViewportHeight(
        window.innerWidth < 1024
          ? Math.round(window.visualViewport?.height ?? window.innerHeight)
          : null,
      );
    };
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('scroll', updateViewportHeight);
    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
    };
  }, []);

  const isPhotoBusy =
    photoStates.face === 'preparing' ||
    photoStates.face === 'uploading' ||
    photoStates.palm === 'preparing' ||
    photoStates.palm === 'uploading';

  const waitForPhotoUploads = useCallback(async () => {
    const pending = Array.from(pendingPhotoUploadsRef.current);
    if (!pending.length) return true;
    const results = await Promise.allSettled(pending);
    return results.every((result) => result.status === 'fulfilled');
  }, []);

  const handleClose = useCallback(async () => {
    if (isSubmitting || isClosing) return;
    if (isPhotoBusy) {
      setActionError(
        'Votre photo est encore en cours d’enregistrement privé. Attendez sa confirmation avant de quitter.',
      );
      return;
    }
    setIsClosing(true);
    setActionError(null);
    const uploadsSucceeded = await waitForPhotoUploads();
    await Promise.resolve();
    if (!uploadsSucceeded) {
      setActionError(
        'Une photo n’a pas pu être enregistrée. Réessayez ou retirez-la avant de quitter.',
      );
      setIsClosing(false);
      return;
    }
    const saved = loadState === 'ready' ? await flushDraft() : true;
    if (!saved) {
      setIsClosing(false);
      return;
    }
    onClose();
  }, [flushDraft, isClosing, isPhotoBusy, isSubmitting, loadState, onClose, waitForPhotoUploads]);

  useEffect(() => {
    if (!['ready', 'error', 'sealed'].includes(loadState)) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (loadState === 'error' || loadState === 'sealed') onClose();
        else void handleClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleClose, loadState, onClose]);

  const uploadPrivatePhoto = useCallback((preview: string, kind: 'FACE' | 'PALM') => {
    const base = uploadOnboardingPhoto(preview, kind, orderIdRef.current).then((storageRef) => {
      if (!storageRef) throw new Error("La photo n'a pas pu être enregistrée.");
      return storageRef;
    });
    let tracked: Promise<string>;
    tracked = base.finally(() => pendingPhotoUploadsRef.current.delete(tracked));
    pendingPhotoUploadsRef.current.add(tracked);
    return tracked;
  }, []);

  const goToStep = useCallback(
    async (index: number) => {
      if (current.key === 'photos' && isPhotoBusy) {
        setActionError(
          'Attendez la confirmation de l’enregistrement privé de la photo avant de changer d’étape.',
        );
        return;
      }
      const target = Math.min(Math.max(index, 0), STEPS.length - 1);
      if (target > 0) {
        const identityValid = await trigger(['birthDate', 'birthPlace'], {
          shouldFocus: step === 0,
        });
        if (!identityValid) {
          setStep(0);
          return;
        }
      }
      setActionError(null);
      setStep(target);
    },
    [current.key, isPhotoBusy, step, trigger],
  );

  const next = useCallback(async () => {
    if (current.key === 'photos' && isPhotoBusy) {
      setActionError(
        'Attendez la confirmation de l’enregistrement privé de la photo avant de continuer.',
      );
      return;
    }
    if (current.key === 'identity') {
      const valid = await trigger(['birthDate', 'birthPlace'], { shouldFocus: true });
      if (!valid) return;
    }
    if (
      current.key === 'photos' &&
      (photoStates.face === 'error' || photoStates.palm === 'error')
    ) {
      setActionError('Réessayez l’envoi de la photo en erreur ou retirez-la pour continuer.');
      return;
    }
    setActionError(null);
    setStep((currentStep) => Math.min(currentStep + 1, STEPS.length - 1));
  }, [current.key, isPhotoBusy, photoStates.face, photoStates.palm, trigger]);

  const focusIssue = useCallback(
    (field: FieldPath<ReadingPreparationData>, message: string) => {
      setError(field, { type: 'manual', message });
      const targetStep =
        field === 'birthDate' ||
        field === 'birthTime' ||
        field === 'birthPlace' ||
        field === 'usageName'
          ? 0
          : field === 'specificQuestion' || field === 'objective'
            ? 1
            : [
                  'highs',
                  'lows',
                  'lifeEvents',
                  'lifeAreas',
                  'ailments',
                  'fears',
                  'rituals',
                  'deliveryStyle',
                  'pace',
                ].includes(field)
              ? 2
              : field === 'facePhoto' || field === 'palmPhoto'
                ? 3
                : 4;
      setStep(targetStep);
      window.setTimeout(() => setFocus(field), 0);
    },
    [setError, setFocus],
  );

  const submit = useCallback(async () => {
    if (submittingRef.current || isSubmitting || isClosing) return;
    if (isPhotoBusy) {
      setActionError(
        'Attendez la confirmation de l’enregistrement privé de la photo avant de transmettre.',
      );
      return;
    }
    const parsed = readingPreparationSubmissionSchema.safeParse(getValues());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      focusIssue(issue.path[0] as FieldPath<ReadingPreparationData>, issue.message);
      return;
    }
    if (photoStates.face === 'error' || photoStates.palm === 'error') {
      setStep(3);
      setActionError('Réessayez l’envoi de la photo en erreur ou retirez-la avant de confirmer.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const uploadsSucceeded = await waitForPhotoUploads();
      if (!uploadsSucceeded) {
        setStep(3);
        setActionError('Une photo n’a pas pu être enregistrée. Réessayez ou retirez-la.');
        return;
      }
      await Promise.resolve();
      const saved = await flushDraft();
      if (!saved) return;

      const values = getValues();
      const [facePhotoUrl, palmPhotoUrl] = await Promise.all([
        uploadOnboardingPhoto(values.facePhoto, 'FACE', orderIdRef.current),
        uploadOnboardingPhoto(values.palmPhoto, 'PALM', orderIdRef.current),
      ]);
      await sanctuaireApi.patch(
        '/users/profile',
        {
          ...(orderIdRef.current && { orderId: orderIdRef.current }),
          usageName: values.usageName.trim() || null,
          birthDate: values.birthDate,
          birthTime: values.birthTime || null,
          birthPlace: values.birthPlace.trim(),
          specificQuestion: values.specificQuestion.trim() || null,
          objective: values.objective.trim() || null,
          openReading: values.openReading,
          facePhotoUrl,
          palmPhotoUrl,
          highs: values.highs.trim() || null,
          lows: values.lows.trim() || null,
          lifeEvents: values.lifeEvents.trim() || null,
          lifeAreas: Object.keys(normalizeLifeAreas(values.lifeAreas)).length
            ? normalizeLifeAreas(values.lifeAreas)
            : null,
          strongSide: values.strongSide?.trim() || null,
          weakSide: values.weakSide?.trim() || null,
          strongZone: values.strongZone?.trim() || null,
          weakZone: values.weakZone?.trim() || null,
          ailments: values.ailments.trim() || null,
          fears: values.fears.trim() || null,
          rituals: values.rituals.trim() || null,
          deliveryStyle: values.deliveryStyle,
          pace: values.pace,
          profileCompleted: true,
          ...(revisionRef.current !== undefined && { intakeRevision: revisionRef.current }),
          consent: { accepted: true },
        },
        { timeout: 30_000 },
      );
      setIsComplete(true);
      await onCompleted().catch(() => undefined);
    } catch (error) {
      setActionError(
        requestStatus(error) === 409
          ? 'Ce dossier vient d’être scellé ou la production a commencé. Rechargez votre Sanctuaire.'
          : 'Le dossier n’a pas pu être transmis. Votre brouillon reste sauvegardé : réessayez dans un instant.',
      );
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  }, [
    flushDraft,
    focusIssue,
    getValues,
    isClosing,
    isPhotoBusy,
    isSubmitting,
    onCompleted,
    photoStates.face,
    photoStates.palm,
    waitForPhotoUploads,
  ]);

  const retrySave = useCallback(() => {
    failedSignatureRef.current = '';
    setActionError(null);
    void queueDraftSave(makeSnapshot(stepRef.current, formValuesRef.current), { force: true });
  }, [queueDraftSave]);

  const completionByStep = useMemo(
    () => [
      Boolean(formValues.birthDate && formValues.birthPlace.trim()),
      Boolean(
        formValues.specificQuestion.trim() || formValues.objective.trim() || formValues.openReading,
      ),
      contextEntries.some(([, value]) => value.trim()) || lifeAreaCount > 0,
      Boolean(formValues.facePhoto || formValues.palmPhoto),
      formValues.consent,
    ],
    [contextEntries, formValues, lifeAreaCount],
  );

  if (loadState === 'loading') {
    return <LoadingDialog />;
  }

  if (loadState === 'error') {
    return (
      <BlockingDialog
        dialogRef={dialogRef}
        title="Impossible de retrouver votre brouillon"
        description={loadError}
        primaryLabel="Réessayer"
        onPrimary={() => void loadServerDraft()}
        onClose={onClose}
      />
    );
  }

  if (loadState === 'sealed') {
    return (
      <BlockingDialog
        dialogRef={dialogRef}
        title="Ce dossier est déjà confirmé"
        description="La version transmise pour cette lecture est désormais immuable. Vous pouvez la consulter depuis Mon dossier."
        primaryLabel="Retour à mon Sanctuaire"
        onPrimary={onClose}
        onClose={onClose}
      />
    );
  }

  if (isComplete) {
    return (
      <div
        ref={dialogRef}
        className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-abyss-900/98 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-preparation-complete-title"
      >
        <section className="w-full max-w-xl rounded-3xl border border-emerald-400/20 bg-abyss-700 p-6 text-center shadow-abyss sm:p-9">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            Dossier transmis
          </p>
          <h1
            ref={titleRef}
            id="reading-preparation-complete-title"
            tabIndex={-1}
            className="mt-3 font-playfair text-3xl italic text-stellar-100"
          >
            Votre lecture peut commencer
          </h1>
          <p className="mt-4 text-sm leading-7 text-stellar-400">
            La version que vous venez de relire est maintenant liée à cette lecture. L’équipe vous
            écrira lorsqu’elle sera disponible.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-7 min-h-[48px] w-full rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-300 sm:w-auto"
          >
            Retour à mon Sanctuaire
          </button>
        </section>
      </div>
    );
  }

  const saveLabel = getSaveLabel(saveState, updatedAt);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[100] overflow-hidden bg-abyss-900/98 backdrop-blur-xl lg:grid lg:place-items-center lg:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reading-preparation-title"
      aria-describedby="reading-preparation-description"
    >
      <div
        className="mx-auto flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden bg-abyss-800 lg:h-[min(760px,calc(100dvh-3rem))] lg:rounded-3xl lg:border lg:border-white/[0.08] lg:shadow-abyss"
        style={mobileViewportHeight ? { height: `${mobileViewportHeight}px` } : undefined}
      >
        <header className="shrink-0 border-b border-white/[0.07] bg-abyss-700/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 lg:pt-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-horizon-300">
                Dossier de lecture
              </p>
              <p className="mt-1 truncate text-xs text-stellar-500" aria-live="polite">
                {saveLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleClose()}
              disabled={isSubmitting || isClosing}
              aria-label="Enregistrer et reprendre plus tard"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/[0.08] text-stellar-300 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:opacity-50"
            >
              {isClosing ? <Loader2 className="h-5 w-5 animate-spin" /> : <X className="h-5 w-5" />}
            </button>
          </div>
          <div className="mt-3 lg:hidden">
            <div className="flex items-center justify-between text-xs text-stellar-500">
              <span>
                Étape {step + 1} sur {STEPS.length} · {current.label}
              </span>
              <span>{positionProgress}%</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-horizon-400 transition-[width] motion-reduce:transition-none"
                style={{ width: `${positionProgress}%` }}
              />
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden min-h-0 border-r border-white/[0.07] bg-abyss-700/60 p-4 lg:flex lg:flex-col">
            <p className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-stellar-500">
              Progression
            </p>
            <ol className="mt-3 space-y-1">
              {STEPS.map((item, index) => {
                const Icon = item.icon;
                const active = index === step;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => void goToStep(index)}
                      aria-current={active ? 'step' : undefined}
                      className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 ${
                        active
                          ? 'bg-horizon-400/15 text-stellar-100'
                          : 'text-stellar-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                          active ? 'bg-horizon-400 text-abyss-900' : 'bg-white/[0.04]'
                        }`}
                      >
                        {completionByStep[index] && !active ? (
                          <Check className="h-4 w-4 text-emerald-300" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-auto rounded-xl border border-horizon-400/15 bg-horizon-400/[0.06] p-3 text-xs leading-5 text-stellar-400">
              Votre brouillon privé reste reprenable sans expiration, demain comme plus tard.
            </p>
          </aside>

          <form
            className="flex min-h-0 min-w-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (current.key === 'review') void submit();
              else void next();
            }}
          >
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 [scroll-padding-bottom:7rem] sm:px-8 sm:py-7">
              <div className="mx-auto max-w-3xl">
                <h1
                  ref={titleRef}
                  id="reading-preparation-title"
                  tabIndex={-1}
                  className="font-playfair text-2xl italic text-stellar-100 outline-none sm:text-3xl"
                >
                  {current.title}
                </h1>
                <p
                  id="reading-preparation-description"
                  className="mt-2 max-w-2xl text-sm leading-6 text-stellar-400"
                >
                  {current.description}
                </p>

                {(actionError || saveState === 'conflict') && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm leading-6 text-rose-100"
                  >
                    <p>{actionError}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {saveState === 'error' && (
                        <button
                          type="button"
                          onClick={retrySave}
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-xs font-semibold hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                        >
                          <RefreshCw className="h-4 w-4" /> Réessayer la sauvegarde
                        </button>
                      )}
                      {saveState === 'conflict' && (
                        <button
                          type="button"
                          onClick={() => void loadServerDraft()}
                          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-xs font-semibold hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                        >
                          <RefreshCw className="h-4 w-4" /> Charger la version sauvegardée
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {current.key !== 'identity' && current.key !== 'review' && (
                  <EnrichmentMeter data={formValues} />
                )}

                <div className="mt-6">
                  {current.key === 'identity' && (
                    <IdentityStep
                      register={register}
                      errors={errors}
                      today={today}
                      birthTimeKnown={Boolean(formValues.birthTime)}
                      onUnknownTime={() => setValue('birthTime', '', { shouldDirty: true })}
                    />
                  )}

                  {current.key === 'intention' && (
                    <IntentionStep register={register} errors={errors} values={formValues} />
                  )}

                  {current.key === 'context' && (
                    <ContextStep
                      register={register}
                      errors={errors}
                      values={formValues}
                      onLifeAreasChange={(next) =>
                        setValue('lifeAreas', next, { shouldDirty: true })
                      }
                    />
                  )}

                  {current.key === 'photos' && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <SmartPhotoUploader
                          key={`face-${draftLoadKey}`}
                          label="Visage"
                          description="Une photo nette, de face, avec une lumière naturelle."
                          value={formValues.facePhoto}
                          onChange={(value) =>
                            setValue('facePhoto', value || '', {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          uploadPhoto={(preview) => uploadPrivatePhoto(preview, 'FACE')}
                          onUploadStateChange={(state) =>
                            setPhotoStates((currentStates) => ({ ...currentStates, face: state }))
                          }
                          captureFacingMode="user"
                          privatePreviewUrl={
                            formValues.facePhoto.startsWith('s3://onboarding/')
                              ? `/api/bff/users/onboarding/photos/face${orderScopeQuery}`
                              : undefined
                          }
                        />
                        <SmartPhotoUploader
                          key={`palm-${draftLoadKey}`}
                          label="Paume"
                          description="Main ouverte, cadrée de près, lignes bien visibles."
                          value={formValues.palmPhoto}
                          onChange={(value) =>
                            setValue('palmPhoto', value || '', {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          uploadPhoto={(preview) => uploadPrivatePhoto(preview, 'PALM')}
                          onUploadStateChange={(state) =>
                            setPhotoStates((currentStates) => ({ ...currentStates, palm: state }))
                          }
                          captureFacingMode="environment"
                          privatePreviewUrl={
                            formValues.palmPhoto.startsWith('s3://onboarding/')
                              ? `/api/bff/users/onboarding/photos/palm${orderScopeQuery}`
                              : undefined
                          }
                        />
                      </div>
                      <p className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-xs leading-5 text-stellar-500">
                        Vous pouvez continuer sans photo, avec une seule ou avec les deux. Une photo
                        réussie est enregistrée immédiatement afin de rester disponible après un
                        abandon ou un changement d’appareil.
                      </p>
                    </div>
                  )}

                  {current.key === 'review' && (
                    <ReviewStep
                      data={formValues}
                      contextEntries={contextEntries}
                      registerConsent={register('consent')}
                      consentError={errors.consent?.message}
                      onEdit={(index) => void goToStep(index)}
                    />
                  )}
                </div>
              </div>
            </div>

            <footer className="shrink-0 border-t border-white/[0.07] bg-abyss-700/98 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6 lg:pb-3">
              <div className="mx-auto flex max-w-3xl items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => (step === 0 ? void handleClose() : setStep((value) => value - 1))}
                  disabled={isSubmitting || isClosing}
                  aria-label={
                    step === 0
                      ? 'Enregistrer et reprendre plus tard'
                      : 'Revenir à l’étape précédente'
                  }
                  className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.09] px-3 text-sm text-stellar-300 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:opacity-50 min-[380px]:px-4"
                >
                  {step === 0 ? <Save className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
                  <span className="hidden min-[380px]:inline">
                    {step === 0 ? 'Plus tard' : 'Retour'}
                  </span>
                </button>
                {current.key !== 'review' ? (
                  <button
                    type="submit"
                    disabled={isClosing || isPhotoBusy}
                    className="inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-horizon-400 px-4 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-300 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isPhotoBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…
                      </>
                    ) : (
                      <>
                        Continuer <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting || isClosing || isPhotoBusy || !formValues.consent}
                    className="inline-flex min-h-[50px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-horizon-300 px-3 py-3 text-sm font-bold text-abyss-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-300 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LockKeyhole className="h-4 w-4" />
                    )}
                    <span className="truncate">Confirmer et transmettre mon dossier</span>
                  </button>
                )}
              </div>
            </footer>
          </form>
        </div>
      </div>
    </div>
  );
}

function IdentityStep({
  register,
  errors,
  today,
  birthTimeKnown,
  onUnknownTime,
}: {
  register: ReturnType<typeof useForm<ReadingPreparationData>>['register'];
  errors: ReturnType<typeof useForm<ReadingPreparationData>>['formState']['errors'];
  today: string;
  birthTimeKnown: boolean;
  onUnknownTime: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-stellar-200">
          Date de naissance <span className="text-horizon-300">*</span>
          <input
            type="date"
            max={today}
            autoComplete="bday"
            aria-invalid={Boolean(errors.birthDate)}
            aria-describedby={errors.birthDate ? 'birthDate-error' : undefined}
            className={inputClass(Boolean(errors.birthDate))}
            {...register('birthDate')}
          />
          <FieldError id="birthDate-error" message={errors.birthDate?.message} />
        </label>
        <label className="text-sm font-medium text-stellar-200">
          Heure <span className="font-normal text-stellar-500">(facultative)</span>
          <input
            type="time"
            aria-invalid={Boolean(errors.birthTime)}
            aria-describedby={errors.birthTime ? 'birthTime-error' : 'birthTime-help'}
            className={inputClass(Boolean(errors.birthTime))}
            {...register('birthTime')}
          />
          <span id="birthTime-help" className="mt-2 block text-xs leading-5 text-stellar-500">
            Si vous ne la connaissez pas, laissez simplement ce champ vide.
          </span>
          {birthTimeKnown && (
            <button
              type="button"
              onClick={onUnknownTime}
              className="mt-1 min-h-[36px] rounded-lg px-1 text-xs text-horizon-200 hover:bg-horizon-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
            >
              Je ne connais pas mon heure
            </button>
          )}
          <FieldError id="birthTime-error" message={errors.birthTime?.message} />
        </label>
      </div>
      <label className="block text-sm font-medium text-stellar-200">
        Lieu de naissance <span className="text-horizon-300">*</span>
        <span className="relative block">
          <MapPin className="pointer-events-none absolute left-3 top-5 h-5 w-5 text-stellar-500" />
          <input
            type="text"
            maxLength={180}
            placeholder="Ville, pays — par exemple Lyon, France"
            enterKeyHint="next"
            aria-invalid={Boolean(errors.birthPlace)}
            aria-describedby={errors.birthPlace ? 'birthPlace-error' : 'birthPlace-help'}
            className={`${inputClass(Boolean(errors.birthPlace))} pl-11`}
            {...register('birthPlace')}
          />
        </span>
        <span id="birthPlace-help" className="mt-2 block text-xs leading-5 text-stellar-500">
          La ville et le pays suffisent ; aucune adresse précise n’est nécessaire.
        </span>
        <FieldError id="birthPlace-error" message={errors.birthPlace?.message} />
      </label>
      <label className="block text-sm font-medium text-stellar-200">
        Le prénom par lequel on vous appelle vraiment{' '}
        <span className="font-normal text-stellar-500">(facultatif)</span>
        <input
          type="text"
          maxLength={120}
          placeholder="Un surnom, un diminutif, un prénom choisi…"
          enterKeyHint="next"
          aria-invalid={Boolean(errors.usageName)}
          aria-describedby={errors.usageName ? 'usageName-error' : 'usageName-help'}
          className={inputClass(Boolean(errors.usageName))}
          {...register('usageName')}
        />
        <span id="usageName-help" className="mt-2 block text-xs leading-5 text-stellar-500">
          S’il diffère de votre état civil, il éclaire la symbolique de votre nom telle que vous la
          vivez au quotidien.
        </span>
        <FieldError id="usageName-error" message={errors.usageName?.message} />
      </label>
      <TrustNote />
    </div>
  );
}

function IntentionStep({
  register,
  errors,
  values,
}: {
  register: ReturnType<typeof useForm<ReadingPreparationData>>['register'];
  errors: ReturnType<typeof useForm<ReadingPreparationData>>['formState']['errors'];
  values: ReadingPreparationData;
}) {
  return (
    <div className="space-y-5">
      <TextareaField
        label="Si cette lecture pouvait éclairer une seule question, laquelle serait-ce ?"
        helper="Racontez la situation comme à une personne de confiance : depuis quand, ce qui s’est passé, ce que vous ressentez. Plus vous êtes précis, plus la lecture le sera."
        placeholder="En ce moment, je me demande… Cela a commencé quand… Ce qui me pèse le plus, c’est…"
        maxLength={2000}
        valueLength={values.specificQuestion.length}
        error={errors.specificQuestion?.message}
        registration={register('specificQuestion')}
      />
      <TextareaField
        label="À la fin, qu’aimeriez-vous comprendre, décider ou voir autrement ?"
        helper="Imaginez votre lecture reçue : qu’est-ce qui aurait changé pour vous ? Une décision plus claire, un poids déposé, une direction retrouvée…"
        placeholder="J’aimerais repartir avec plus de clarté sur… et me sentir capable de…"
        maxLength={2000}
        valueLength={values.objective.length}
        error={errors.objective?.message}
        registration={register('objective')}
      />
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-sm leading-6 focus-within:ring-2 focus-within:ring-horizon-400 ${
          values.openReading
            ? 'border-horizon-400/40 bg-horizon-400/10 text-stellar-200'
            : 'border-white/[0.09] bg-white/[0.025] text-stellar-400'
        }`}
      >
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-abyss-700 text-horizon-400 focus:ring-horizon-400"
          {...register('openReading')}
        />
        <span>
          <strong className="block font-medium text-stellar-100">
            Je préfère une lecture ouverte
          </strong>
          <span className="mt-1 block text-xs leading-5 text-stellar-500">
            Je ne souhaite pas orienter la lecture avec une question précise ; l’expert partira de
            mes repères et du contexte que j’ai choisi de partager.
          </span>
        </span>
      </label>
      <TrustNote />
    </div>
  );
}

function ContextStep({
  register,
  errors,
  values,
  onLifeAreasChange,
}: {
  register: ReturnType<typeof useForm<ReadingPreparationData>>['register'];
  errors: ReturnType<typeof useForm<ReadingPreparationData>>['formState']['errors'];
  values: ReadingPreparationData;
  onLifeAreasChange: (next: LifeAreas) => void;
}) {
  return (
    <div className="space-y-5">
      <LifeWeatherSection value={values.lifeAreas || {}} onChange={onLifeAreasChange} />
      <div className="grid gap-5 md:grid-cols-2">
        <TextareaField
          label="Ce qui vous soutient actuellement"
          helper="Une personne, un projet, une qualité, un élan : qu’est-ce qui vous porte au réveil, même les jours difficiles ?"
          placeholder="Je peux compter sur… Ce qui me redonne de l’énergie, c’est…"
          maxLength={2000}
          valueLength={values.highs.length}
          error={errors.highs?.message}
          registration={register('highs')}
        />
        <TextareaField
          label="Ce qui vous pèse ou se répète"
          helper="Le schéma qui revient malgré vous — dans vos relations, votre travail, votre corps. C’est souvent la clé de la lecture."
          placeholder="Depuis des années, je retombe dans… À chaque fois que…, il se passe…"
          maxLength={2000}
          valueLength={values.lows.length}
          error={errors.lows?.message}
          registration={register('lows')}
        />
        <TextareaField
          label="Ce que vous préférez que nous abordions avec douceur"
          helper="Une peur, une limite ou un sujet sensible — quelques mots suffisent, sans obligation de tout détailler."
          placeholder="Je préfère qu’on aborde délicatement…"
          maxLength={2000}
          valueLength={values.fears.length}
          error={errors.fears?.message}
          registration={register('fears')}
        />
        <TextareaField
          label="Pratiques qui comptent pour vous"
          helper="Méditation, écriture, prière, marche, tarot… ce que vous faites déjà nous aide à proposer des rituels qui vous ressemblent."
          placeholder="J’ai l’habitude de… J’ai déjà essayé…"
          maxLength={1500}
          valueLength={values.rituals.length}
          error={errors.rituals?.message}
          registration={register('rituals')}
        />
      </div>
      <TextareaField
        label="Une période ou un événement qui vous a marqué"
        helper="Une année approximative et quelques mots : une rencontre, une perte, un éveil, une rupture, un déménagement… Ces dates de passage éclairent vos cycles de vie."
        placeholder="Vers 2018, j’ai vécu… et depuis, quelque chose a changé dans…"
        maxLength={2000}
        valueLength={values.lifeEvents.length}
        error={errors.lifeEvents?.message}
        registration={register('lifeEvents')}
      />
      <TextareaField
        label="Contexte corporel que vous souhaitez partager"
        helper="Tensions, fatigue, zones sensibles : ce que votre corps exprime en ce moment, si vous deviez le traduire. Lumira ne pose aucun diagnostic médical."
        placeholder="Mon corps me parle surtout par… (dos, sommeil, ventre, énergie…)"
        maxLength={1500}
        valueLength={values.ailments.length}
        error={errors.ailments?.message}
        registration={register('ailments')}
      />

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
        <h2 className="text-sm font-medium text-stellar-100">
          Comment souhaitez-vous recevoir la lecture ?
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {STYLE_OPTIONS.map(([value, label, helper]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border p-3 focus-within:ring-2 focus-within:ring-horizon-400 ${
                values.deliveryStyle === value
                  ? 'border-horizon-400/40 bg-horizon-400/10 text-stellar-100'
                  : 'border-white/[0.08] text-stellar-400'
              }`}
            >
              <input
                type="radio"
                value={value}
                className="sr-only"
                {...register('deliveryStyle')}
              />
              <span className="block text-sm font-medium">{label}</span>
              <span className="mt-1 block text-xs leading-5 text-stellar-500">{helper}</span>
            </label>
          ))}
        </div>
        <label className="mt-5 block text-sm text-stellar-300">
          Niveau de détail souhaité :{' '}
          <strong className="text-stellar-100">{paceLabel(values.pace)}</strong>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            className="mt-3 h-11 w-full accent-amber-300"
            {...register('pace', { valueAsNumber: true })}
          />
          <span className="flex justify-between text-xs text-stellar-500">
            <span>Essentiel</span>
            <span>Très détaillé</span>
          </span>
        </label>
      </section>
      <TrustNote />
    </div>
  );
}

function LifeWeatherSection({
  value,
  onChange,
}: {
  value: LifeAreas;
  onChange: (next: LifeAreas) => void;
}) {
  const setAreaState = (key: LifeAreaKey, state: LifeAreaState) => {
    const next: LifeAreas = { ...value };
    if (next[key]?.state === state) {
      delete next[key];
    } else {
      next[key] = { state, note: next[key]?.note };
    }
    onChange(next);
  };

  const setAreaNote = (key: LifeAreaKey, note: string) => {
    const entry = value[key];
    if (!entry) return;
    onChange({ ...value, [key]: { ...entry, note } });
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
      <h2 className="text-sm font-medium text-stellar-100">
        Votre météo de vie, domaine par domaine
      </h2>
      <p className="mt-1 text-xs leading-5 text-stellar-500">
        Vingt secondes suffisent : indiquez comment chaque domaine se porte en ce moment. Chaque
        repère donné ancre votre lecture dans votre réalité, pas dans des généralités.
      </p>
      <div className="mt-4 space-y-4">
        {LIFE_AREA_KEYS.map((key) => {
          const entry = value[key];
          return (
            <div key={key} className="rounded-xl border border-white/[0.06] bg-abyss-600/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-stellar-200">
                  {LIFE_AREA_LABELS[key]}
                </span>
                <div className="flex gap-1.5" role="group" aria-label={LIFE_AREA_LABELS[key]}>
                  {LIFE_AREA_STATES.map((state) => {
                    const active = entry?.state === state;
                    return (
                      <button
                        key={state}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setAreaState(key, state)}
                        className={`min-h-[36px] rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 ${
                          active
                            ? state === 'FLUIDE'
                              ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
                              : state === 'TENDU'
                                ? 'border-rose-400/50 bg-rose-400/15 text-rose-200'
                                : 'border-amber-300/50 bg-amber-300/15 text-amber-100'
                            : 'border-white/[0.09] text-stellar-400 hover:bg-white/[0.05]'
                        }`}
                      >
                        {LIFE_AREA_STATE_LABELS[state]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {entry && entry.state !== 'FLUIDE' && (
                <input
                  type="text"
                  maxLength={300}
                  value={entry.note || ''}
                  onChange={(event) => setAreaNote(key, event.target.value)}
                  placeholder="Un mot sur ce qui se passe là… (facultatif)"
                  aria-label={`Précision sur ${LIFE_AREA_LABELS[key]}`}
                  className={`${inputClass(false)} mt-2 py-2 text-sm`}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EnrichmentMeter({ data }: { data: ReadingPreparationData }) {
  const signals = [
    Boolean(data.birthTime),
    Boolean(data.usageName.trim()),
    Boolean(data.specificQuestion.trim() || data.objective.trim()),
    Boolean(data.highs.trim()),
    Boolean(data.lows.trim()),
    Boolean(data.lifeEvents.trim()),
    LIFE_AREA_KEYS.some((key) => Boolean(data.lifeAreas?.[key])),
    Boolean(data.fears.trim()),
    Boolean(data.rituals.trim()),
    Boolean(data.ailments.trim()),
    Boolean(data.facePhoto),
    Boolean(data.palmPhoto),
  ];
  const filled = signals.filter(Boolean).length;
  const percent = Math.round((filled / signals.length) * 100);
  const message =
    percent >= 75
      ? 'Dossier riche : votre lecture pourra être profondément personnelle.'
      : percent >= 40
        ? 'Beau dossier. Chaque détail supplémentaire affine encore la lecture.'
        : 'Tout est facultatif, mais chaque élément partagé rend votre lecture plus juste.';

  return (
    <div className="mt-5 rounded-xl border border-horizon-400/15 bg-horizon-400/[0.05] p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold uppercase tracking-[0.12em] text-horizon-300">
          Richesse du dossier
        </span>
        <span className="tabular-nums text-stellar-400">
          {filled}/{signals.length} repères
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-horizon-400 to-amber-300 transition-[width] motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-stellar-400">{message}</p>
    </div>
  );
}

function ReviewStep({
  data,
  contextEntries,
  registerConsent,
  consentError,
  onEdit,
}: {
  data: ReadingPreparationData;
  contextEntries: string[][];
  registerConsent: ReturnType<ReturnType<typeof useForm<ReadingPreparationData>>['register']>;
  consentError?: string;
  onEdit: (index: number) => void;
}) {
  const transmittedContext = contextEntries.filter(([, value]) => value.trim());
  const weatherEntries = LIFE_AREA_KEYS.filter((key) => Boolean(data.lifeAreas?.[key])).map(
    (key) => {
      const entry = data.lifeAreas![key]!;
      const note = entry.note?.trim();
      return `${LIFE_AREA_LABELS[key]} : ${LIFE_AREA_STATE_LABELS[entry.state]}${
        note ? ` — ${note}` : ''
      }`;
    },
  );
  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-stellar-300">
        <strong className="text-stellar-100">
          Le brouillon reste modifiable tant que vous ne confirmez pas.
        </strong>{' '}
        Après confirmation, cette version sera conservée telle quelle pour cette lecture.
      </p>
      <ReviewSection title="Repères essentiels" onEdit={() => onEdit(0)}>
        <ReviewValue label="Date" value={formatBirthDate(data.birthDate)} />
        <ReviewValue label="Heure" value={data.birthTime || 'Non transmise'} />
        <ReviewValue label="Lieu" value={data.birthPlace || 'À compléter'} />
        {data.usageName.trim() && (
          <ReviewValue label="Prénom d’usage" value={data.usageName.trim()} />
        )}
      </ReviewSection>
      <ReviewSection title="Ce qui vous amène" onEdit={() => onEdit(1)}>
        {data.openReading && (
          <ReviewValue label="Cadre choisi" value="Lecture ouverte, sans question imposée" />
        )}
        <ReviewValue
          label="Question"
          value={data.specificQuestion || 'Aucune question précise transmise'}
        />
        <ReviewValue
          label="Intention"
          value={data.objective || 'Aucune intention supplémentaire transmise'}
        />
      </ReviewSection>
      <ReviewSection title="Votre contexte" onEdit={() => onEdit(2)}>
        {weatherEntries.length > 0 && (
          <ReviewValue label="Météo de vie" value={weatherEntries.join('\n')} />
        )}
        {transmittedContext.length
          ? transmittedContext.map(([label, value]) => (
              <ReviewValue key={label} label={label} value={value} />
            ))
          : weatherEntries.length === 0 && <p>Aucun contexte personnel supplémentaire transmis.</p>}
        <ReviewValue label="Style" value={styleLabel(data.deliveryStyle)} />
        <ReviewValue label="Niveau de détail" value={paceLabel(data.pace)} />
      </ReviewSection>
      <ReviewSection title="Photos privées" onEdit={() => onEdit(3)}>
        <ReviewValue
          label="Visage"
          value={data.facePhoto ? 'Photo enregistrée' : 'Non transmise'}
        />
        <ReviewValue label="Paume" value={data.palmPhoto ? 'Photo enregistrée' : 'Non transmise'} />
      </ReviewSection>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.035] p-4 text-sm leading-6 text-stellar-300 focus-within:ring-2 focus-within:ring-horizon-400">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-abyss-700 text-horizon-400 focus:ring-horizon-400"
          aria-invalid={Boolean(consentError)}
          aria-describedby={consentError ? 'consent-error' : undefined}
          {...registerConsent}
        />
        <span>
          J’ai relu l’ensemble de ces éléments et je choisis de transmettre cette version à Lumira
          pour préparer ma lecture personnalisée.
        </span>
      </label>
      <FieldError id="consent-error" message={consentError} />
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-stellar-100">{title}</h2>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs text-horizon-200 hover:bg-horizon-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
        >
          <Pencil className="h-3.5 w-3.5" /> Modifier
        </button>
      </div>
      <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3 text-sm leading-6 text-stellar-400">
        {children}
      </div>
    </section>
  );
}

function ReviewValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-stellar-600">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-stellar-300">{value}</p>
    </div>
  );
}

function TextareaField({
  label,
  helper,
  placeholder,
  maxLength,
  valueLength,
  error,
  registration,
}: {
  label: string;
  helper: string;
  placeholder?: string;
  maxLength: number;
  valueLength: number;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<ReadingPreparationData>>['register']>;
}) {
  const errorId = `${registration.name}-error`;
  const helperId = `${registration.name}-help`;
  return (
    <label className="block text-sm font-medium text-stellar-200">
      {label} <span className="font-normal text-stellar-500">(facultatif)</span>
      <span id={helperId} className="mt-1 block text-xs font-normal leading-5 text-stellar-500">
        {helper}
      </span>
      <textarea
        rows={3}
        maxLength={maxLength}
        placeholder={placeholder}
        spellCheck
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : helperId}
        className={`${inputClass(Boolean(error))} min-h-[104px] resize-y leading-6`}
        onInput={(event) => {
          const target = event.currentTarget;
          target.style.height = 'auto';
          target.style.height = `${Math.min(target.scrollHeight, 240)}px`;
        }}
        {...registration}
      />
      <span className="mt-1 flex items-start justify-between gap-3">
        <FieldError id={errorId} message={error} />
        <span className="ml-auto shrink-0 text-xs font-normal tabular-nums text-stellar-600">
          {valueLength}/{maxLength}
        </span>
      </span>
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="mt-1 block text-xs font-normal leading-5 text-rose-300" role="alert">
      {message}
    </span>
  );
}

function TrustNote() {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-horizon-400/15 bg-horizon-400/[0.055] p-3 text-xs leading-5 text-stellar-400">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-horizon-300" />
      Votre brouillon est privé, sauvegardé automatiquement et reprenable sans expiration. Rien
      n’est transmis à l’expert avant votre confirmation finale.
    </p>
  );
}

function LoadingDialog() {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-abyss-900/98 p-6"
      role="status"
      aria-label="Chargement du brouillon"
    >
      <div className="w-full max-w-sm animate-pulse motion-reduce:animate-none">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-white/[0.07]" />
        <div className="mx-auto mt-5 h-6 w-48 rounded-xl bg-white/[0.07]" />
        <div className="mx-auto mt-3 h-4 w-64 max-w-full rounded-full bg-white/[0.05]" />
      </div>
    </div>
  );
}

function BlockingDialog({
  dialogRef,
  title,
  description,
  primaryLabel,
  onPrimary,
  onClose,
}: {
  dialogRef: React.RefObject<HTMLDivElement>;
  title: string;
  description: string;
  primaryLabel: string;
  onPrimary: () => void;
  onClose: () => void;
}) {
  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-abyss-900/98 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reading-preparation-blocked-title"
    >
      <section className="relative w-full max-w-lg rounded-3xl border border-white/[0.09] bg-abyss-700 p-6 text-center shadow-abyss sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-xl text-stellar-400 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-horizon-400/10 text-horizon-300">
          <RefreshCw className="h-7 w-7" />
        </span>
        <h1
          id="reading-preparation-blocked-title"
          className="mt-5 font-playfair text-2xl italic text-stellar-100"
        >
          {title}
        </h1>
        <p className="mt-3 text-sm leading-7 text-stellar-400">{description}</p>
        <button
          type="button"
          onClick={onPrimary}
          autoFocus
          className="mt-6 min-h-[48px] w-full rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-300 sm:w-auto"
        >
          {primaryLabel}
        </button>
      </section>
    </div>
  );
}

function getSaveLabel(state: SaveState, updatedAt: string | null): string {
  if (state === 'unsaved') return 'Modifications en attente…';
  if (state === 'saving') return 'Sauvegarde du brouillon…';
  if (state === 'error') return 'Sauvegarde à réessayer';
  if (state === 'conflict') return 'Version plus récente détectée';
  const time = savedTime(updatedAt);
  if (state === 'saved') return time ? `Brouillon sauvegardé à ${time}` : 'Brouillon sauvegardé';
  return 'Brouillon reprenable sans expiration';
}

function styleLabel(value: string): string {
  return STYLE_OPTIONS.find(([option]) => option === value)?.[1] || 'Doux et clair';
}

function paceLabel(value: number): string {
  if (value >= 75) return 'très détaillé';
  if (value >= 55) return 'approfondi';
  if (value <= 25) return 'essentiel';
  return 'équilibré';
}
