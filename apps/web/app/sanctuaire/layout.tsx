import React from 'react';
import { OnboardingMobileEnhancer } from '../../components/onboarding/OnboardingMobileEnhancer';
import { LegacyStorageCleanup } from '../../components/sanctuary/LegacyStorageCleanup';
import SanctuaireLayoutClient from './SanctuaireLayoutClient';
import type { Metadata } from 'next';
import { PRIVATE_ROBOTS } from '../../lib/seo';
import './required-intake.css';

// Forces the entire route segment to be dynamic, skipping static generation.
// This is critical because the dashboard relies on authentication and URL parameters (useSearchParams)
// which cause build failures if statically rendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sanctuaire',
  robots: PRIVATE_ROBOTS,
};

export default function SanctuaireLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LegacyStorageCleanup />
      <OnboardingMobileEnhancer />
      <SanctuaireLayoutClient>{children}</SanctuaireLayoutClient>
    </>
  );
}
