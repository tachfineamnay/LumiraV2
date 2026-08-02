'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  CONSENT_OPEN_EVENT,
  CONSENT_UPDATED_EVENT,
  DEFAULT_CONSENT,
  isPublicAnalyticsSurface,
  readConsent,
  saveConsent,
  type ConsentPreferences,
} from '../../lib/consent';
import { GoogleAnalytics } from './GoogleAnalytics';
import { MetaPixel } from './MetaPixel';

function ConsentDialog({
  initial,
  onSave,
  onClose,
}: {
  initial: ConsentPreferences;
  onSave: (preferences: ConsentPreferences) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [customizing, setCustomizing] = useState(false);

  return (
    <section
      aria-label="Préférences cookies"
      className="fixed inset-x-4 bottom-[max(1rem,var(--safe-area-bottom))] z-[100] mx-auto max-w-xl rounded-2xl border border-white/15 bg-void p-5 text-left text-white shadow-2xl md:p-6"
      role="dialog"
      aria-modal="true"
    >
      <h2 className="font-playfair text-2xl italic">Vos préférences</h2>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Les services nécessaires restent actifs. La mesure d&apos;audience et le marketing restent
        désactivés tant que vous ne les acceptez pas.
      </p>

      {customizing && (
        <fieldset className="mt-5 space-y-3 border-y border-white/10 py-4 text-sm">
          <legend className="sr-only">Catégories de consentement</legend>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block font-medium">Nécessaires</span>
              <span className="text-white/60">Session sécurisée et fonctionnement du site.</span>
            </span>
            <input
              checked
              disabled
              type="checkbox"
              aria-label="Cookies nécessaires toujours actifs"
            />
          </label>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block font-medium">Mesure d&apos;audience</span>
              <span className="text-white/60">
                Google Analytics sur les seules pages publiques.
              </span>
            </span>
            <input
              checked={draft.analytics}
              type="checkbox"
              onChange={(event) =>
                setDraft((value) => ({ ...value, analytics: event.target.checked }))
              }
            />
          </label>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block font-medium">Marketing</span>
              <span className="text-white/60">Meta Pixel sur les seules pages publiques.</span>
            </span>
            <input
              checked={draft.marketing}
              type="checkbox"
              onChange={(event) =>
                setDraft((value) => ({ ...value, marketing: event.target.checked }))
              }
            />
          </label>
        </fieldset>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          className="min-h-[44px] rounded-xl border border-white/20 px-4 text-sm font-medium text-white"
          onClick={() => onSave(DEFAULT_CONSENT)}
        >
          Tout refuser
        </button>
        <button
          type="button"
          className="min-h-[44px] rounded-xl bg-cosmic-gold px-4 text-sm font-bold text-void"
          onClick={() => onSave({ analytics: true, marketing: true })}
        >
          Tout accepter
        </button>
        <button
          type="button"
          className="min-h-[44px] rounded-xl px-3 text-sm text-cosmic-gold underline underline-offset-4"
          onClick={() => setCustomizing((value) => !value)}
          aria-expanded={customizing}
        >
          Personnaliser
        </button>
        {customizing && (
          <button
            type="button"
            className="min-h-[44px] rounded-xl px-3 text-sm text-white/75 underline underline-offset-4"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Enregistrer mes choix
          </button>
        )}
      </div>
    </section>
  );
}

export function ConsentManager() {
  const pathname = usePathname();
  const [preferences, setPreferences] = useState<ConsentPreferences | null>(null);
  const [isPublicSurface, setIsPublicSurface] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const publicSurface = isPublicAnalyticsSurface();
    const stored = readConsent();
    setIsPublicSurface(publicSurface);
    setPreferences(stored);
    setDialogOpen(publicSurface && stored === null);

    if (!publicSurface) {
      document.getElementById('google-analytics-loader')?.remove();
      document.getElementById('google-analytics')?.remove();
      document.getElementById('meta-pixel-loader')?.remove();
      document.getElementById('meta-pixel')?.remove();
    }

    const openDialog = () => {
      if (!isPublicAnalyticsSurface()) return;
      setIsPublicSurface(true);
      setDialogOpen(true);
    };
    const refreshConsent = (event: Event) => {
      const detail = (event as CustomEvent<ConsentPreferences>).detail;
      setPreferences(detail ?? readConsent());
    };

    window.addEventListener(CONSENT_OPEN_EVENT, openDialog);
    window.addEventListener(CONSENT_UPDATED_EVENT, refreshConsent);
    return () => {
      window.removeEventListener(CONSENT_OPEN_EVENT, openDialog);
      window.removeEventListener(CONSENT_UPDATED_EVENT, refreshConsent);
    };
  }, [pathname]);

  const save = (value: ConsentPreferences) => {
    saveConsent(value);
    setPreferences(value);
    setDialogOpen(false);
  };

  if (!isPublicSurface) return null;

  return (
    <>
      {preferences?.analytics && <GoogleAnalytics />}
      {preferences?.marketing && <MetaPixel />}
      {dialogOpen && (
        <ConsentDialog
          initial={preferences ?? DEFAULT_CONSENT}
          onSave={save}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}
