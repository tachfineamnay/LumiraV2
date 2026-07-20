'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { SmartPhotoUploader } from './SmartPhotoUploader';
import sanctuaireApi from '../../lib/sanctuaireApi';
import { uploadOnboardingPhoto } from '../../lib/onboarding-upload';

type PreparationData = {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  specificQuestion: string;
  objective: string;
  facePhoto: string;
  palmPhoto: string;
  highs: string;
  lows: string;
  ailments: string;
  fears: string;
  rituals: string;
  deliveryStyle: string;
  pace: number;
  consent: boolean;
};

type StepKey = 'control' | 'identity' | 'intention' | 'photos' | 'context' | 'review';

type StepDefinition = {
  key: StepKey;
  label: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: StepDefinition[] = [
  {
    key: 'control',
    label: 'Votre choix',
    title: 'Vous gardez la main',
    description:
      'Votre brouillon privé est sauvegardé automatiquement. Il ne sera transmis à la production qu’après votre confirmation finale.',
    icon: ShieldCheck,
  },
  {
    key: 'identity',
    label: 'Repères',
    title: 'Vos repères essentiels',
    description: 'La date et le lieu sont nécessaires. L’heure reste facultative.',
    icon: CalendarDays,
  },
  {
    key: 'intention',
    label: 'Intention',
    title: 'Ce que vous souhaitez éclairer',
    description: 'Écrivez seulement ce que vous souhaitez réellement transmettre.',
    icon: MessageSquareText,
  },
  {
    key: 'photos',
    label: 'Photos',
    title: 'Visage et paume',
    description: 'Les deux images sont facultatives et conservées dans l’espace privé Lumira.',
    icon: ImageIcon,
  },
  {
    key: 'context',
    label: 'Contexte',
    title: 'Votre contexte personnel',
    description: 'Toutes les réponses de cette section sont facultatives.',
    icon: HeartHandshake,
  },
  {
    key: 'review',
    label: 'Confirmation',
    title: 'Relire et confirmer',
    description: 'Vérifiez chaque section, puis transmettez la version qui servira à votre lecture.',
    icon: LockKeyhole,
  },
];

const STYLE_OPTIONS = [
  ['DOUX_ET_CLAIR', 'Doux et clair'],
  ['DIRECT_ET_CONCRET', 'Direct et concret'],
  ['SYMBOLIQUE_ET_PROFOND', 'Symbolique et profond'],
] as const;

const EMPTY_DATA: PreparationData = {
  birthDate: '',
  birthTime: '',
  birthPlace: '',
  specificQuestion: '',
  objective: '',
  facePhoto: '',
  palmPhoto: '',
  highs: '',
  lows: '',
  ailments: '',
  fears: '',
  rituals: '',
  deliveryStyle: 'DOUX_ET_CLAIR',
  pace: 50,
  consent: false,
};

const inputClass =
  'mt-2 w-full rounded-xl border border-white/10 bg-abyss-600 px-3 py-3 text-stellar-100 placeholder:text-stellar-600 outline-none focus:border-horizon-400 focus-visible:ring-2 focus-visible:ring-horizon-400/30';

const stringValue = (value: unknown) => (typeof value === 'string' ? value : '');

function normalize(value: unknown): Partial<PreparationData> {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  return {
    birthDate: stringValue(source.birthDate),
    birthTime: stringValue(source.birthTime),
    birthPlace: stringValue(source.birthPlace),
    specificQuestion: stringValue(source.specificQuestion),
    objective: stringValue(source.objective),
    facePhoto: stringValue(source.facePhoto || source.facePhotoUrl),
    palmPhoto: stringValue(source.palmPhoto || source.palmPhotoUrl),
    highs: stringValue(source.highs),
    lows: stringValue(source.lows),
    ailments: stringValue(source.ailments),
    fears: stringValue(source.fears),
    rituals: stringValue(source.rituals),
    deliveryStyle: stringValue(source.deliveryStyle) || 'DOUX_ET_CLAIR',
    pace: typeof source.pace === 'number' ? source.pace : 50,
  };
}

function draftPayload(data: PreparationData) {
  return {
    ...data,
    consent: false,
    facePhoto: data.facePhoto.startsWith('s3://onboarding/') ? data.facePhoto : '',
    palmPhoto: data.palmPhoto.startsWith('s3://onboarding/') ? data.palmPhoto : '',
  };
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
        <h3 className="text-sm font-medium text-stellar-100">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs text-horizon-200 hover:bg-horizon-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
        >
          <Pencil className="h-3.5 w-3.5" /> Modifier
        </button>
      </div>
      <div className="mt-3 border-t border-white/[0.06] pt-3 text-sm leading-6 text-stellar-400">
        {children}
      </div>
    </section>
  );
}

export function ReadingPreparation({
  onCompleted,
  onClose,
}: {
  onCompleted: () => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<PreparationData>(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let active = true;
    Promise.all([
      sanctuaireApi.get('/users/profile').catch(() => null),
      sanctuaireApi.get('/users/onboarding').catch(() => null),
    ])
      .then(([profileResponse, draftResponse]) => {
        if (!active) return;
        const profile = normalize(profileResponse?.data?.profile);
        const draft = normalize(draftResponse?.data?.data);
        setData({ ...EMPTY_DATA, ...profile, ...draft, consent: false });
        const savedStep = Number(draftResponse?.data?.currentStep);
        if (Number.isFinite(savedStep)) {
          setStep(Math.min(Math.max(savedStep, 0), STEPS.length - 1));
        }
      })
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isSubmitting, onClose]);

  const serializableDraft = useMemo(() => draftPayload(data), [data]);
  const current = STEPS[step];
  const progress = Math.round(((step + 1) / STEPS.length) * 100);
  const contextCount = [data.highs, data.lows, data.ailments, data.fears, data.rituals].filter(
    (value) => value.trim(),
  ).length;

  useEffect(() => {
    if (!loaded || isSubmitting || isComplete) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      sanctuaireApi
        .patch('/users/onboarding', { currentStep: step, data: serializableDraft })
        .then(() => setSaveState('saved'))
        .catch(() => {
          setSaveState('error');
          setError('La sauvegarde automatique n’a pas abouti. Vos réponses restent affichées.');
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [isComplete, isSubmitting, loaded, serializableDraft, step]);

  const update = <Key extends keyof PreparationData>(key: Key, value: PreparationData[Key]) => {
    setError(null);
    setData((currentData) => ({ ...currentData, [key]: value }));
  };

  const goToStep = (index: number) => {
    setError(null);
    setStep(Math.min(Math.max(index, 0), STEPS.length - 1));
  };

  const next = () => {
    if (current.key === 'identity' && (!data.birthDate || !data.birthPlace.trim())) {
      setError('Ajoutez votre date et votre lieu de naissance pour continuer.');
      return;
    }
    goToStep(step + 1);
  };

  const submit = async () => {
    if (!data.birthDate || !data.birthPlace.trim()) {
      goToStep(1);
      setError('Ajoutez votre date et votre lieu de naissance avant de transmettre.');
      return;
    }
    if (!data.consent) {
      setError('Confirmez la transmission avant de sceller votre dossier.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const [facePhotoUrl, palmPhotoUrl] = await Promise.all([
        uploadOnboardingPhoto(data.facePhoto, 'FACE'),
        uploadOnboardingPhoto(data.palmPhoto, 'PALM'),
      ]);
      await sanctuaireApi.patch('/users/profile', {
        birthDate: data.birthDate,
        birthTime: data.birthTime || null,
        birthPlace: data.birthPlace.trim(),
        specificQuestion: data.specificQuestion.trim() || null,
        objective: data.objective.trim() || null,
        facePhotoUrl,
        palmPhotoUrl,
        highs: data.highs.trim() || null,
        lows: data.lows.trim() || null,
        ailments: data.ailments.trim() || null,
        fears: data.fears.trim() || null,
        rituals: data.rituals.trim() || null,
        deliveryStyle: data.deliveryStyle,
        pace: data.pace,
        profileCompleted: true,
        consent: { accepted: true, version: '2026-07-18-user-agency-v1' },
      });
      setIsComplete(true);
      void onCompleted().catch(() => undefined);
    } catch {
      setError('Le dossier n’a pas pu être scellé. Rien n’est perdu : réessayez dans un instant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!loaded) {
    return (
      <div
        className="fixed inset-0 z-[100] grid place-items-center bg-abyss-900/95"
        role="status"
        aria-label="Chargement du dossier"
      >
        <div className="w-full max-w-sm animate-pulse px-6">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-white/[0.07]" />
          <div className="mx-auto mt-5 h-6 w-48 rounded-xl bg-white/[0.07]" />
          <div className="mx-auto mt-3 h-4 w-64 max-w-full rounded-full bg-white/[0.05]" />
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div
        className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-abyss-900/98 p-4 backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-preparation-complete-title"
      >
        <section className="w-full max-w-xl rounded-3xl border border-emerald-400/20 bg-abyss-700 p-7 text-center shadow-abyss sm:p-10">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
            <CheckCircle2 className="h-9 w-9" />
          </span>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
            Dossier transmis
          </p>
          <h1
            id="reading-preparation-complete-title"
            className="mt-3 font-playfair text-3xl italic text-stellar-100"
          >
            Votre lecture peut commencer
          </h1>
          <p className="mt-4 text-sm leading-7 text-stellar-400">
            Vous avez choisi, relu puis confirmé les éléments transmis. L’équipe vous écrira lorsque
            votre lecture sera disponible.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 min-h-[48px] rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-300"
          >
            Retour à mon Sanctuaire
          </button>
        </section>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-abyss-900/98 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reading-preparation-title"
    >
      <div className="mx-auto flex h-[100dvh] min-h-0 w-full max-w-6xl flex-col p-2 sm:p-6">
        <header className="flex shrink-0 items-center justify-between rounded-2xl border border-white/[0.08] bg-abyss-700/95 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-300">
              Dossier de lecture
            </p>
            <p className="mt-1 text-xs text-stellar-500" aria-live="polite">
              {saveState === 'saving' && 'Sauvegarde du brouillon en cours…'}
              {saveState === 'saved' && 'Brouillon privé sauvegardé'}
              {saveState === 'error' && 'Sauvegarde à vérifier'}
              {saveState === 'idle' && 'Vous pouvez reprendre plus tard'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fermer et reprendre plus tard"
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] text-stellar-400 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mt-2 grid min-h-0 flex-1 gap-3 lg:mt-3 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden rounded-3xl border border-white/[0.08] bg-abyss-700/80 p-4 lg:block">
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
                      onClick={() => goToStep(index)}
                      aria-current={active ? 'step' : undefined}
                      className={`flex min-h-[50px] w-full items-center gap-3 rounded-2xl px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 ${
                        active
                          ? 'bg-horizon-400/15 text-stellar-100'
                          : 'text-stellar-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 place-items-center rounded-xl ${
                          active ? 'bg-horizon-400 text-abyss-900' : 'bg-white/[0.04]'
                        }`}
                      >
                        {index < step ? (
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
            <p className="mt-5 rounded-2xl border border-horizon-400/15 bg-horizon-400/[0.06] p-4 text-xs leading-5 text-stellar-400">
              Votre brouillon privé est sauvegardé automatiquement. La production ne commence
              qu’après votre confirmation finale.
            </p>
          </aside>

          <main className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-abyss-700/90 shadow-abyss">
            <div className="shrink-0 border-b border-white/[0.06] px-5 py-4 sm:px-8 sm:py-6">
              <div className="flex justify-between text-xs text-stellar-500">
                <span>
                  Étape {step + 1} sur {STEPS.length} · {current.label}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-horizon-400 transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <h1
                id="reading-preparation-title"
                className="mt-4 font-playfair text-2xl italic text-stellar-100 sm:mt-5 sm:text-3xl"
              >
                {current.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stellar-400">
                {current.description}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-8">
              {current.key === 'control' && (
                <div className="mx-auto max-w-2xl space-y-4">
                  <div className="rounded-3xl border border-horizon-400/20 bg-horizon-400/[0.07] p-6">
                    <Sparkles className="h-6 w-6 text-horizon-300" />
                    <h2 className="mt-4 font-playfair text-xl italic text-stellar-100">
                      Une préparation personnelle, à votre rythme
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-stellar-400">
                      Seuls la date et le lieu de naissance sont nécessaires. Votre intention, vos
                      photos et votre contexte restent facultatifs. Vous relirez l’ensemble avant de
                      confirmer la transmission.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {['Je choisis', 'Je relis', 'Je confirme'].map((label, index) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"
                      >
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-xs font-bold text-horizon-200">
                          {index + 1}
                        </span>
                        <p className="mt-3 text-sm font-medium text-stellar-100">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {current.key === 'identity' && (
                <div className="mx-auto max-w-2xl space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="text-sm font-medium text-stellar-200">
                      Date de naissance
                      <input
                        type="date"
                        value={data.birthDate}
                        onChange={(event) => update('birthDate', event.target.value)}
                        className={inputClass}
                        required
                      />
                    </label>
                    <label className="text-sm font-medium text-stellar-200">
                      Heure <span className="font-normal text-stellar-500">(facultative)</span>
                      <input
                        type="time"
                        value={data.birthTime}
                        onChange={(event) => update('birthTime', event.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <label className="text-sm font-medium text-stellar-200">
                    Lieu de naissance
                    <span className="relative block">
                      <MapPin className="pointer-events-none absolute left-3 top-5 h-5 w-5 text-stellar-500" />
                      <input
                        value={data.birthPlace}
                        onChange={(event) => update('birthPlace', event.target.value)}
                        placeholder="Ville, pays"
                        className={`${inputClass} pl-11`}
                        required
                      />
                    </span>
                  </label>
                </div>
              )}

              {current.key === 'intention' && (
                <div className="mx-auto max-w-2xl space-y-5">
                  <label className="block text-sm font-medium text-stellar-200">
                    Votre question <span className="font-normal text-stellar-500">(facultative)</span>
                    <textarea
                      value={data.specificQuestion}
                      onChange={(event) => update('specificQuestion', event.target.value)}
                      rows={5}
                      maxLength={2000}
                      placeholder="Écrivez avec vos propres mots."
                      className={`${inputClass} resize-y`}
                    />
                  </label>
                  <label className="block text-sm font-medium text-stellar-200">
                    Ce que vous souhaitez comprendre ou faire évoluer{' '}
                    <span className="font-normal text-stellar-500">(facultatif)</span>
                    <textarea
                      value={data.objective}
                      onChange={(event) => update('objective', event.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder="Votre intention peut rester très simple."
                      className={`${inputClass} resize-y`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setData((currentData) => ({
                        ...currentData,
                        specificQuestion: '',
                        objective: '',
                      }))
                    }
                    className="min-h-[40px] rounded-xl px-2 text-xs text-stellar-500 hover:bg-white/[0.04] hover:text-stellar-300"
                  >
                    Ne transmettre aucune intention particulière
                  </button>
                </div>
              )}

              {current.key === 'photos' && (
                <div className="mx-auto max-w-3xl space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SmartPhotoUploader
                      label="Visage"
                      description="Photo nette, de face"
                      value={data.facePhoto}
                      onChange={(value) => update('facePhoto', value || '')}
                      privatePreviewUrl={
                        data.facePhoto.startsWith('s3://onboarding/')
                          ? '/api/bff/users/profile/photos/face'
                          : undefined
                      }
                    />
                    <SmartPhotoUploader
                      label="Paume"
                      description="Paume ouverte et nette"
                      value={data.palmPhoto}
                      onChange={(value) => update('palmPhoto', value || '')}
                      privatePreviewUrl={
                        data.palmPhoto.startsWith('s3://onboarding/')
                          ? '/api/bff/users/profile/photos/palm'
                          : undefined
                      }
                    />
                  </div>
                  <p className="text-center text-xs text-stellar-500">
                    Continuez sans photo, avec une seule ou avec les deux.
                  </p>
                </div>
              )}

              {current.key === 'context' && (
                <div className="mx-auto max-w-3xl space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <OptionalTextarea
                      label="Ce qui vous porte"
                      value={data.highs}
                      onChange={(value) => update('highs', value)}
                    />
                    <OptionalTextarea
                      label="Ce qui vous freine"
                      value={data.lows}
                      onChange={(value) => update('lows', value)}
                    />
                    <OptionalTextarea
                      label="Gênes ou douleurs à mentionner"
                      value={data.ailments}
                      onChange={(value) => update('ailments', value)}
                      maxLength={1500}
                    />
                    <OptionalTextarea
                      label="Peurs ou blocages identifiés"
                      value={data.fears}
                      onChange={(value) => update('fears', value)}
                    />
                  </div>
                  <OptionalTextarea
                    label="Pratiques ou rituels actuels"
                    value={data.rituals}
                    onChange={(value) => update('rituals', value)}
                    maxLength={1500}
                  />
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <p className="text-sm font-medium text-stellar-100">
                      Style de lecture souhaité
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {STYLE_OPTIONS.map(([value, label]) => (
                        <label
                          key={value}
                          className={`cursor-pointer rounded-xl border p-3 text-sm focus-within:ring-2 focus-within:ring-horizon-400 ${
                            data.deliveryStyle === value
                              ? 'border-horizon-400/40 bg-horizon-400/10 text-stellar-100'
                              : 'border-white/[0.08] text-stellar-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="deliveryStyle"
                            value={value}
                            checked={data.deliveryStyle === value}
                            onChange={() => update('deliveryStyle', value)}
                            className="sr-only"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <label className="mt-4 block text-sm text-stellar-300">
                      Intensité souhaitée : {paceLabel(data.pace)}
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={data.pace}
                        onChange={(event) => update('pace', Number(event.target.value))}
                        className="mt-3 w-full accent-amber-300"
                      />
                      <span className="mt-2 flex justify-between text-xs text-stellar-500">
                        <span>Très posée</span>
                        <span>Très approfondie</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {current.key === 'review' && (
                <div className="mx-auto max-w-3xl space-y-4">
                  <p className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-stellar-300">
                    <strong className="text-stellar-100">Votre brouillon est sauvegardé, mais la production n’a pas commencé.</strong>{' '}
                    Le bouton final confirmera ces éléments comme base de votre lecture.
                  </p>
                  <ReviewSection title="Repères essentiels" onEdit={() => goToStep(1)}>
                    {data.birthDate || 'À compléter'}
                    {data.birthTime ? ` · ${data.birthTime}` : ''}
                    <br />
                    {data.birthPlace || 'Lieu à compléter'}
                  </ReviewSection>
                  <ReviewSection title="Intention" onEdit={() => goToStep(2)}>
                    {data.specificQuestion || data.objective ? (
                      <>
                        <p>{data.specificQuestion || 'Aucune question précise'}</p>
                        {data.objective && <p className="mt-2">Objectif : {data.objective}</p>}
                      </>
                    ) : (
                      'Aucune intention particulière transmise.'
                    )}
                  </ReviewSection>
                  <ReviewSection title="Photos" onEdit={() => goToStep(3)}>
                    Visage : {data.facePhoto ? 'transmis' : 'non transmis'} · Paume :{' '}
                    {data.palmPhoto ? 'transmise' : 'non transmise'}
                  </ReviewSection>
                  <ReviewSection title="Contexte et préférence" onEdit={() => goToStep(4)}>
                    <p>
                      {contextCount} élément{contextCount > 1 ? 's' : ''} facultatif
                      {contextCount > 1 ? 's' : ''} transmis
                    </p>
                    <p className="mt-2">
                      Style : {styleLabel(data.deliveryStyle)} · Intensité : {paceLabel(data.pace)}
                    </p>
                  </ReviewSection>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.035] p-4 text-sm leading-6 text-stellar-300 focus-within:ring-2 focus-within:ring-horizon-400">
                    <input
                      type="checkbox"
                      checked={data.consent}
                      onChange={(event) => update('consent', event.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/20 bg-abyss-700 text-horizon-400 focus:ring-horizon-400"
                    />
                    J’ai relu ces éléments et je choisis de les transmettre à Lumira pour préparer ma
                    lecture personnalisée.
                  </label>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="mx-auto mt-6 max-w-3xl rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200"
                >
                  {error}
                </p>
              )}
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-white/[0.06] bg-abyss-700/95 px-5 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-4">
              <button
                type="button"
                onClick={() => (step === 0 ? onClose() : goToStep(step - 1))}
                disabled={isSubmitting}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl px-4 text-sm text-stellar-400 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Reprendre plus tard' : 'Retour'}
              </button>
              {current.key !== 'review' ? (
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-300"
                >
                  {current.key === 'control' ? 'Commencer mon dossier' : 'Continuer'}{' '}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting || !data.consent}
                  onClick={() => void submit()}
                  className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-horizon-300 px-5 py-3 text-sm font-bold text-abyss-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LockKeyhole className="h-4 w-4" />
                  )}
                  Confirmer et transmettre mon dossier
                </button>
              )}
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}

function OptionalTextarea({
  label,
  value,
  onChange,
  maxLength = 2000,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}) {
  return (
    <label className="block text-sm font-medium text-stellar-200">
      {label} <span className="font-normal text-stellar-500">(facultatif)</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        maxLength={maxLength}
        className={`${inputClass} resize-y`}
      />
    </label>
  );
}

function styleLabel(value: string): string {
  return STYLE_OPTIONS.find(([option]) => option === value)?.[1] || 'Doux et clair';
}

function paceLabel(value: number): string {
  if (value >= 70) return 'approfondie';
  if (value <= 30) return 'très posée';
  return 'équilibrée';
}
