'use client';

import { useEffect } from 'react';

const LEGACY_STORAGE_KEYS = [
  'holistic_wizard_draft',
  'holistic_wizard_email',
  'sanctuaire_email',
] as const;

/**
 * One-way browser migration for the onboarding variants removed in July 2026.
 * These keys may contain personal intake data on browsers that used the old
 * flow, so they are purged as soon as any Sanctuaire route mounts.
 */
export function LegacyStorageCleanup() {
  useEffect(() => {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  }, []);

  return null;
}
