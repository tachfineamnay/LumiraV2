'use client';

import Link from 'next/link';
import { useConsent } from './ConsentProvider';

/**
 * Bannière de consentement aux cookies analytiques (RGPD).
 * Apparaît uniquement quand aucun choix n'a encore été enregistré.
 * Se ferme immédiatement après le choix — sans rechargement de page.
 */
export function ConsentBanner() {
  const { consent, grantConsent, denyConsent } = useConsent();

  // Invisible côté serveur (SSR) et une fois le choix effectué.
  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Préférences de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gold/20 bg-void/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-relaxed text-divine/60">
          Nous utilisons des cookies analytiques (Google Analytics, Meta Pixel)
          pour mesurer l&apos;audience du site de façon anonyme.{' '}
          <Link
            href="/confidentialite"
            className="underline underline-offset-2 transition-colors hover:text-divine/90"
          >
            Politique de confidentialité
          </Link>
        </p>

        <div className="flex shrink-0 gap-2">
          <button
            id="consent-deny-btn"
            onClick={denyConsent}
            className="rounded border border-divine/15 px-4 py-2 text-sm text-divine/40 transition-colors hover:border-divine/30 hover:text-divine/60"
          >
            Refuser
          </button>
          <button
            id="consent-accept-btn"
            onClick={grantConsent}
            className="rounded bg-gold px-4 py-2 text-sm font-medium text-void transition-colors hover:bg-gold-light"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
