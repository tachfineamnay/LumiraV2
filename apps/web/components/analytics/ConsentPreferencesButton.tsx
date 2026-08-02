'use client';

import { CONSENT_OPEN_EVENT } from '../../lib/consent';

export function ConsentPreferencesButton() {
  return (
    <button
      type="button"
      className="hover:text-white transition-colors"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
    >
      Préférences cookies
    </button>
  );
}
