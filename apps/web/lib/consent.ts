export type ConsentPreferences = {
  analytics: boolean;
  marketing: boolean;
};

export const CONSENT_STORAGE_KEY = 'lumira-cookie-consent-v1';
export const CONSENT_OPEN_EVENT = 'lumira:open-cookie-preferences';
export const CONSENT_UPDATED_EVENT = 'lumira:cookie-consent-updated';

const DEFAULT_CONSENT: ConsentPreferences = {
  analytics: false,
  marketing: false,
};

const PUBLIC_ANALYTICS_PATHS = new Set([
  '/',
  '/faq',
  '/notre-approche',
  '/mentions-legales',
  '/confidentialite',
  '/cgv',
]);

function isBrowser() {
  return typeof window !== 'undefined';
}

export function readConsent(): ConsentPreferences | null {
  if (!isBrowser()) return null;

  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<ConsentPreferences>;
    return {
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
    };
  } catch {
    return null;
  }
}

export function saveConsent(preferences: ConsentPreferences) {
  if (!isBrowser()) return;
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(preferences));
  window.dispatchEvent(
    new CustomEvent<ConsentPreferences>(CONSENT_UPDATED_EVENT, { detail: preferences }),
  );
}

export function isPublicAnalyticsSurface() {
  if (!isBrowser()) return false;

  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'desk.oraclelumira.com' || hostname === 'desk.localhost') return false;

  return PUBLIC_ANALYTICS_PATHS.has(window.location.pathname);
}

export function canUseMarketing() {
  return isPublicAnalyticsSurface() && readConsent()?.marketing === true;
}

export { DEFAULT_CONSENT };
