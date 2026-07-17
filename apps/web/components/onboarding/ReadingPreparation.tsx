'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { SmartPhotoUploader } from './SmartPhotoUploader';
import sanctuaireApi from '../../lib/sanctuaireApi';
import { uploadOnboardingPhoto } from '../../lib/onboarding-upload';

type PreparationData = {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  facePhoto: string;
  palmPhoto: string;
  consent: boolean;
};

const EMPTY_PREPARATION: PreparationData = {
  birthDate: '',
  birthTime: '',
  birthPlace: '',
  facePhoto: '',
  palmPhoto: '',
  consent: false,
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeRemoteDraft(value: unknown): PreparationData {
  if (!value || typeof value !== 'object') return EMPTY_PREPARATION;
  const source = value as Record<string, unknown>;
  return {
    birthDate: asString(source.birthDate),
    birthTime: asString(source.birthTime),
    birthPlace: asString(source.birthPlace),
    facePhoto: asString(source.facePhoto),
    palmPhoto: asString(source.palmPhoto),
    consent: source.consent === true,
  };
}

/** Never send browser previews to the draft API; only private S3 references are durable. */
function serializableDraft(data: PreparationData): Omit<
  PreparationData,
  'facePhoto' | 'palmPhoto'
> & {
  facePhoto: string;
  palmPhoto: string;
} {
  return {
    ...data,
    facePhoto: data.facePhoto.startsWith('s3://onboarding/') ? data.facePhoto : '',
    palmPhoto: data.palmPhoto.startsWith('s3://onboarding/') ? data.palmPhoto : '',
  };
}

export function ReadingPreparation({
  onCompleted,
  onClose,
}: {
  onCompleted: () => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<PreparationData>(EMPTY_PREPARATION);
  const [loaded, setLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    sanctuaireApi
      .get('/users/onboarding')
      .then((response) => {
        if (!active || !response.data) return;
        setData(normalizeRemoteDraft(response.data.data));
        setStep(Math.min(Math.max(Number(response.data.currentStep) || 0, 0), 2));
      })
      .catch(() => {
        // A new buyer has no draft yet. The page remains fully usable.
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const draft = useMemo(() => serializableDraft(data), [data]);

  useEffect(() => {
    if (!loaded || isComplete) return;
    const timer = window.setTimeout(() => {
      sanctuaireApi.patch('/users/onboarding', { currentStep: step, data: draft }).catch(() => {
        setError(
          'La sauvegarde automatique n’a pas abouti. Vérifiez votre connexion puis réessayez.',
        );
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draft, isComplete, loaded, step]);

  const update = <Key extends keyof PreparationData>(key: Key, value: PreparationData[Key]) => {
    setError(null);
    setData((current) => ({ ...current, [key]: value }));
  };

  const next = () => {
    if (step === 0 && (!data.birthDate || !data.birthPlace.trim())) {
      setError('Indiquez votre date de naissance et votre lieu de naissance pour continuer.');
      return;
    }
    if (step === 2 && !data.consent) {
      setError('Votre consentement explicite est nécessaire pour valider ces éléments.');
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, 2));
  };

  const submit = async () => {
    if (!data.consent) {
      setError('Votre consentement explicite est nécessaire pour valider ces éléments.');
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
        facePhotoUrl,
        palmPhotoUrl,
        profileCompleted: true,
        consent: { accepted: true, version: '2026-07-17' },
      });
      setIsComplete(true);
      // The profile write is authoritative. A transient refresh failure must
      // not replace a successful confirmation with a misleading error state.
      void onCompleted().catch(() => undefined);
    } catch {
      setError(
        'Vos éléments n’ont pas pu être validés. Rien n’a été perdu : réessayez dans un instant.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!loaded) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-abyss-900/95" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-horizon-300" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-abyss-900/95 px-3 py-4 backdrop-blur-xl sm:grid sm:place-items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reading-preparation-title"
        className="mx-auto flex min-h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/[0.09] bg-abyss-700 shadow-abyss sm:min-h-0"
      >
        {isComplete ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
            <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
              <CheckCircle2 className="h-9 w-9" />
            </span>
            <h1
              id="reading-preparation-title"
              className="font-playfair text-3xl italic text-stellar-100"
            >
              Tout est bien reçu
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-stellar-400">
              Vous n’avez plus rien à faire pour le moment. Nous vous écrirons dès que votre lecture
              sera disponible.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-8 min-h-[48px] rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300"
            >
              Retour à mon espace
            </button>
          </div>
        ) : (
          <>
            <header className="border-b border-white/[0.06] px-5 py-5 sm:px-7">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-300">
                Étape {step + 1} sur 3
              </p>
              <h1
                id="reading-preparation-title"
                className="mt-2 font-playfair text-2xl italic text-stellar-100 sm:text-3xl"
              >
                Préparation de votre lecture
              </h1>
              <p className="mt-2 text-sm text-stellar-400">
                Prenez votre temps. Vos éléments sont enregistrés automatiquement.
              </p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-horizon-400 transition-all"
                  style={{ width: `${((step + 1) / 3) * 100}%` }}
                />
              </div>
            </header>

            <div className="flex-1 px-5 py-6 sm:px-7">
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="birth-date"
                      className="mb-2 block text-sm font-medium text-stellar-200"
                    >
                      Date de naissance
                    </label>
                    <input
                      id="birth-date"
                      type="date"
                      value={data.birthDate}
                      onChange={(event) => update('birthDate', event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-abyss-600 px-3 py-3 text-stellar-100 outline-none focus:border-horizon-400"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="birth-time"
                      className="mb-2 block text-sm font-medium text-stellar-200"
                    >
                      Heure de naissance{' '}
                      <span className="font-normal text-stellar-500">(facultative)</span>
                    </label>
                    <input
                      id="birth-time"
                      type="time"
                      value={data.birthTime}
                      onChange={(event) => update('birthTime', event.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-abyss-600 px-3 py-3 text-stellar-100 outline-none focus:border-horizon-400"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="birth-place"
                      className="mb-2 block text-sm font-medium text-stellar-200"
                    >
                      Lieu de naissance
                    </label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-stellar-500" />
                      <input
                        id="birth-place"
                        value={data.birthPlace}
                        onChange={(event) => update('birthPlace', event.target.value)}
                        autoComplete="address-level2"
                        placeholder="Ville, pays"
                        className="w-full rounded-xl border border-white/10 bg-abyss-600 py-3 pl-11 pr-3 text-stellar-100 placeholder:text-stellar-600 outline-none focus:border-horizon-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <p className="text-sm leading-6 text-stellar-400">
                    Ajoutez un visage et une paume si vous souhaitez les inclure à votre lecture.
                    Ces fichiers sont envoyés dans le stockage privé Lumira.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <SmartPhotoUploader
                      label="Visage"
                      description="Photo nette, en lumière naturelle"
                      value={data.facePhoto}
                      onChange={(value) => update('facePhoto', value || '')}
                    />
                    <SmartPhotoUploader
                      label="Paume"
                      description="Paume ouverte et nette"
                      value={data.palmPhoto}
                      onChange={(value) => update('palmPhoto', value || '')}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-playfair text-xl italic text-stellar-100">
                      Vérifiez vos éléments
                    </h2>
                    <p className="mt-1 text-sm text-stellar-400">
                      Vous pourrez modifier vos informations de profil ultérieurement.
                    </p>
                  </div>
                  <dl className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-abyss-600/50">
                    <div className="flex justify-between gap-4 p-4">
                      <dt className="text-sm text-stellar-500">Naissance</dt>
                      <dd className="text-right text-sm text-stellar-200">
                        {data.birthDate}
                        {data.birthTime ? ` · ${data.birthTime}` : ''}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 p-4">
                      <dt className="text-sm text-stellar-500">Lieu</dt>
                      <dd className="text-right text-sm text-stellar-200">{data.birthPlace}</dd>
                    </div>
                    <div className="flex justify-between gap-4 p-4">
                      <dt className="text-sm text-stellar-500">Visage</dt>
                      <dd className="text-right text-sm text-stellar-200">
                        {data.facePhoto ? 'Ajouté' : 'Non ajouté'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 p-4">
                      <dt className="text-sm text-stellar-500">Paume</dt>
                      <dd className="text-right text-sm text-stellar-200">
                        {data.palmPhoto ? 'Ajoutée' : 'Non ajoutée'}
                      </dd>
                    </div>
                  </dl>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-stellar-300">
                    <input
                      type="checkbox"
                      checked={data.consent}
                      onChange={(event) => update('consent', event.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-white/20 bg-abyss-700 text-horizon-400 focus:ring-horizon-400"
                    />
                    <span>
                      J’accepte que ces éléments soient utilisés pour personnaliser ma lecture
                      Lumira.
                    </span>
                  </label>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-200"
                >
                  {error}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={() => (step === 0 ? onClose() : setStep((current) => current - 1))}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 text-sm text-stellar-400 hover:bg-white/[0.05]"
              >
                <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Plus tard' : 'Retour'}
              </button>
              {step < 2 ? (
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-horizon-400 px-4 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300"
                >
                  Continuer <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={submit}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-horizon-400 px-4 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}{' '}
                  Valider et lancer la préparation
                </button>
              )}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
