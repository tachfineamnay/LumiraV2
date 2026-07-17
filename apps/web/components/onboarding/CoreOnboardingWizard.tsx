'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles, X } from 'lucide-react';
import { SmartPhotoUploader } from './SmartPhotoUploader';
import sanctuaireApi from '../../lib/sanctuaireApi';
import { uploadOnboardingPhoto } from '../../lib/onboarding-upload';

export interface CoreOnboardingData {
  birthDate: string;
  birthTime?: string;
  birthPlace: string;
  facePhoto: string;
  palmPhoto: string;
  gdprConsent: boolean;
}

interface CoreOnboardingWizardProps {
  userEmail?: string;
  onComplete: (data: CoreOnboardingData) => Promise<void>;
  onClose?: () => void;
}

const EMPTY_DATA: CoreOnboardingData = {
  birthDate: '',
  birthTime: '',
  birthPlace: '',
  facePhoto: '',
  palmPhoto: '',
  gdprConsent: false,
};

const STEP_TITLES = ['Votre naissance', 'Vos deux repères visuels', 'Votre accord'];

function persistable(data: CoreOnboardingData) {
  return {
    ...data,
    facePhoto: data.facePhoto.startsWith('s3://onboarding/') ? data.facePhoto : '',
    palmPhoto: data.palmPhoto.startsWith('s3://onboarding/') ? data.palmPhoto : '',
  };
}

export function CoreOnboardingWizard({ userEmail, onComplete, onClose }: CoreOnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<CoreOnboardingData>(EMPTY_DATA);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState<'FACE' | 'PALM' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    sanctuaireApi
      .get('/users/onboarding')
      .then((response) => {
        if (!active || !response.data) return;
        const remote = response.data;
        setData({ ...EMPTY_DATA, ...(remote.data || {}) });
        setStep(Math.min(Math.max(remote.currentStep || 0, 0), 2));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setIsReady(true);
      });

    return () => {
      active = false;
    };
  }, [userEmail]);

  useEffect(() => {
    if (!isReady) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      sanctuaireApi
        .patch('/users/onboarding', { currentStep: step, data: persistable(data) })
        .catch(() => undefined);
    }, 500);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, isReady, step]);

  const progress = useMemo(() => ((step + 1) / 3) * 100, [step]);

  const setField = <K extends keyof CoreOnboardingData>(key: K, value: CoreOnboardingData[K]) => {
    setData((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const savePhoto = async (value: string | null, kind: 'FACE' | 'PALM') => {
    const field = kind === 'FACE' ? 'facePhoto' : 'palmPhoto';
    if (!value) {
      setField(field, '');
      return;
    }

    setField(field, value);
    setUploading(kind);
    try {
      const storageRef = await uploadOnboardingPhoto(value, kind);
      setField(field, storageRef || '');
    } catch (uploadError) {
      console.error('[CoreOnboarding] Photo upload failed', uploadError);
      setField(field, '');
      setError("L'enregistrement privé de la photo a échoué. Réessayez.");
    } finally {
      setUploading(null);
    }
  };

  const next = () => {
    if (step === 0 && (!data.birthDate || !data.birthPlace.trim())) {
      setError('Indiquez votre date et votre lieu de naissance.');
      return;
    }
    if (step === 1 && (!data.facePhoto || !data.palmPhoto)) {
      setError('Ajoutez une photo du visage et une photo de la paume.');
      return;
    }
    setStep((current) => Math.min(current + 1, 2));
    setError(null);
  };

  const finish = async () => {
    if (!data.gdprConsent) {
      setError('Votre consentement est nécessaire pour préparer la lecture personnalisée.');
      return;
    }
    if (!data.facePhoto.startsWith('s3://') || !data.palmPhoto.startsWith('s3://')) {
      setError('Attendez la fin de l’enregistrement privé des photos.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onComplete(data);
    } catch (submitError) {
      console.error('[CoreOnboarding] Submit failed', submitError);
      setError('La sauvegarde finale a échoué. Votre progression reste enregistrée.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isReady) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-abyss-900/95 backdrop-blur-xl">
        <Loader2 className="h-10 w-10 animate-spin text-horizon-400" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-abyss-900/95 backdrop-blur-xl">
      <div className="flex h-full w-full flex-col overflow-hidden bg-abyss-800 md:h-auto md:max-h-[92vh] md:max-w-2xl md:rounded-3xl md:border md:border-white/10 md:shadow-2xl">
        <div className="h-1 bg-abyss-700">
          <div className="h-full bg-gradient-to-r from-horizon-400 to-serenity-400 transition-all" style={{ width: `${progress}%` }} />
        </div>

        <header className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-horizon-400">Étape {step + 1} sur 3</p>
            <h2 className="mt-1 font-playfair text-2xl italic text-stellar-100">{STEP_TITLES[step]}</h2>
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Continuer plus tard" className="rounded-full p-2 text-stellar-400 hover:bg-white/5 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          )}
        </header>

        <main className="custom-scrollbar flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          {step === 0 && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-horizon-400/20 bg-horizon-400/5 p-4 text-sm text-stellar-300">
                Nous commençons uniquement par les informations essentielles. Le reste pourra être complété plus tard dans votre Sanctuaire.
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stellar-200">Date de naissance *</span>
                <input type="date" value={data.birthDate} onChange={(event) => setField('birthDate', event.target.value)} className="w-full rounded-xl border border-white/10 bg-abyss-700 px-4 py-3 text-white outline-none focus:border-horizon-400" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stellar-200">Heure de naissance</span>
                <input type="time" value={data.birthTime || ''} onChange={(event) => setField('birthTime', event.target.value)} className="w-full rounded-xl border border-white/10 bg-abyss-700 px-4 py-3 text-white outline-none focus:border-horizon-400" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stellar-200">Lieu de naissance *</span>
                <input value={data.birthPlace} onChange={(event) => setField('birthPlace', event.target.value)} placeholder="Ville, pays" className="w-full rounded-xl border border-white/10 bg-abyss-700 px-4 py-3 text-white outline-none placeholder:text-stellar-600 focus:border-horizon-400" />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <p className="text-sm leading-relaxed text-stellar-400">Les photos sont enregistrées dans le stockage privé Lumira. Elles ne sont pas rendues publiques.</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <SmartPhotoUploader label="Visage" description="Photo nette, de face, lumière naturelle" value={data.facePhoto} onChange={(value) => void savePhoto(value, 'FACE')} compact />
                <SmartPhotoUploader label="Paume" description="Main ouverte, lignes visibles" value={data.palmPhoto} onChange={(value) => void savePhoto(value, 'PALM')} compact />
              </div>
              {uploading && <p className="flex items-center gap-2 text-sm text-horizon-400"><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement privé en cours…</p>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-horizon-400/30 bg-horizon-400/10">
                <Sparkles className="h-8 w-8 text-horizon-400" />
              </div>
              <div className="text-center">
                <h3 className="font-playfair text-2xl italic text-white">Le minimum est prêt</h3>
                <p className="mt-3 text-sm leading-relaxed text-stellar-400">Ces éléments permettent de démarrer la préparation. Vous pourrez enrichir votre profil et préciser votre question ensuite.</p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <input type="checkbox" checked={data.gdprConsent} onChange={(event) => setField('gdprConsent', event.target.checked)} className="mt-1 h-4 w-4 accent-amber-500" />
                <span className="text-sm leading-relaxed text-stellar-300">J’accepte que ces informations et photos privées soient utilisées pour produire mon expérience Lumira personnalisée.</span>
              </label>
            </div>
          )}

          {error && <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
        </main>

        <footer className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-4 sm:px-8">
          <button onClick={step === 0 ? onClose : () => setStep((current) => Math.max(current - 1, 0))} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-stellar-400 hover:bg-white/5 hover:text-white">
            {step > 0 && <ArrowLeft className="h-4 w-4" />}
            {step === 0 ? 'Plus tard' : 'Retour'}
          </button>

          {step < 2 ? (
            <button disabled={Boolean(uploading)} onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-bold text-abyss-900 disabled:opacity-50">
              Continuer <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button disabled={isSubmitting || Boolean(uploading)} onClick={() => void finish()} className="inline-flex items-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-bold text-abyss-900 disabled:opacity-50">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Démarrer la préparation
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
