'use client';

import { useEffect } from 'react';
import { readLandingSectionFromHash, scrollToLandingSection } from './LandingAnchorLink';

export function LandingHashHandler() {
  useEffect(() => {
    const alignWithHash = () => {
      const sectionId = readLandingSectionFromHash();
      if (sectionId) scrollToLandingSection(sectionId, 'none');
    };

    alignWithHash();
    window.addEventListener('hashchange', alignWithHash);
    window.addEventListener('pageshow', alignWithHash);

    return () => {
      window.removeEventListener('hashchange', alignWithHash);
      window.removeEventListener('pageshow', alignWithHash);
    };
  }, []);

  return null;
}
