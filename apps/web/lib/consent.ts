'use client';

/**
 * Gestion du consentement analytique RGPD.
 * Stocke le choix de l'utilisateur dans un cookie first-party.
 */

export const CONSENT_COOKIE_NAME = 'lumira_analytics';
export const CONSENT_GRANTED_MAX_AGE = 365 * 24 * 3600; // 1 an
export const CONSENT_DENIED_MAX_AGE = 24 * 3600; // 24 h (re-demande le lendemain)

export type ConsentValue = 'granted' | 'denied';

/**
 * Lit l'état de consentement depuis le cookie (navigateur uniquement).
 * Retourne `null` si aucun choix n'a encore été enregistré.
 */
export function readConsentCookie(): ConsentValue | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CONSENT_COOKIE_NAME}=([^;]+)`),
  );
  const value = match?.[1];
  if (value === 'granted' || value === 'denied') return value;
  return null;
}

/**
 * Écrit le choix de consentement dans un cookie SameSite=Lax.
 */
export function writeConsentCookie(value: ConsentValue): void {
  const maxAge =
    value === 'granted' ? CONSENT_GRANTED_MAX_AGE : CONSENT_DENIED_MAX_AGE;
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
