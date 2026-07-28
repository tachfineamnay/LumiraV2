'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

const IMPORTANT_ERROR_FRAGMENTS = [
  'Le dossier n’a pas pu',
  "Le dossier n'a pas pu",
  'La sauvegarde automatique',
  'Une version plus récente',
  'Une photo n’a pas pu',
  "Une photo n'a pas pu",
  'Votre commande vient d’être confirmée',
  'Ce dossier vient d’être scellé',
];

const SAFE_SERVER_ERROR =
  'Un problème technique empêche momentanément la transmission. Votre brouillon est bien conservé. Réessayez dans un instant.';

function findReadingForm(): HTMLFormElement | null {
  const title = document.getElementById('reading-preparation-title');
  return title?.closest('form') ?? null;
}

function isImportantAlert(element: Element): element is HTMLElement {
  const text = element.textContent?.trim() ?? '';
  return IMPORTANT_ERROR_FRAGMENTS.some((fragment) => text.includes(fragment));
}

function normalizedMessage(message: string): string {
  return /internal server error/i.test(message) ? SAFE_SERVER_ERROR : message;
}

export function OnboardingMobileEnhancer() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const inspect = () => {
      const title = document.getElementById('reading-preparation-title');
      const form = findReadingForm();
      if (!title || !form) {
        setMessage(null);
        return;
      }

      const alert = Array.from(form.querySelectorAll('[role="alert"]')).find(isImportantAlert);
      const messageNode = alert?.querySelector('p');
      const rawMessage = messageNode?.textContent?.trim() || alert?.textContent?.trim() || '';
      const nextMessage = rawMessage ? normalizedMessage(rawMessage) : null;

      setMessage(nextMessage);
    };

    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  const retry = () => {
    const form = findReadingForm();
    const existingRetryButton = Array.from(
      form?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    ).find((button) => button.textContent?.includes('Réessayer'));
    const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    setMessage(null);
    (existingRetryButton ?? submitButton)?.click();
  };

  return (
    <>
      <style jsx global>{`
        form:has(#reading-preparation-title)
          :is(
            input:not([type='checkbox']):not([type='radio']):not([type='file']),
            textarea,
            select
          ) {
          background: #101b32 !important;
          color: #f8f5ec !important;
          border-color: rgba(143, 177, 211, 0.42) !important;
          caret-color: #f4b942;
          color-scheme: dark;
          -webkit-text-fill-color: #f8f5ec;
          opacity: 1;
        }

        form:has(#reading-preparation-title)
          :is(
            input:not([type='checkbox']):not([type='radio']):not([type='file']),
            textarea
          )::placeholder {
          color: #afc3d8 !important;
          opacity: 1 !important;
          -webkit-text-fill-color: #afc3d8;
        }

        form:has(#reading-preparation-title)
          :is(
            input:not([type='checkbox']):not([type='radio']):not([type='file']),
            textarea,
            select
          ):disabled {
          background: #142039 !important;
          color: #879bb1 !important;
          -webkit-text-fill-color: #879bb1;
        }
      `}</style>

      {message && (
        <div className="fixed bottom-[calc(6.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-[160] lg:hidden">
          <div
            className="mx-auto max-w-xl rounded-2xl border border-rose-300/35 bg-[#2b1824]/95 p-4 text-rose-50 shadow-2xl backdrop-blur-xl"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
              <p className="min-w-0 flex-1 text-sm leading-6">{message}</p>
              <button
                type="button"
                onClick={() => setMessage(null)}
                aria-label="Masquer le message"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-rose-100 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={retry}
              className="mt-3 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-rose-100 px-4 py-2 text-sm font-semibold text-[#2b1824]"
            >
              <RefreshCw className="h-4 w-4" /> Réessayer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
