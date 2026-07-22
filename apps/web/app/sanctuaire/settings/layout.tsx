'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Shield, ArrowLeft, SlidersHorizontal, BookOpen } from 'lucide-react';
import { SanctuairePage, SanctuaireStage } from '@/components/sanctuary/SanctuaireStage';

const tabs = [
  {
    label: 'Préférences',
    icon: SlidersHorizontal,
    href: '/sanctuaire/settings/preferences',
    color: 'text-serenity-500',
  },
  {
    label: 'Sécurité',
    icon: Shield,
    href: '/sanctuaire/settings/security',
    color: 'text-rose-500',
  },
  {
    label: 'Lectures',
    icon: BookOpen,
    href: '/sanctuaire/draws',
    color: 'text-horizon-600',
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SanctuairePage maxWidth="max-w-4xl">
      <div className="mb-6">
        <Link
          href="/sanctuaire/profile"
          className="mb-2 inline-flex min-h-[40px] items-center gap-2 text-sm text-stellar-400 transition-colors hover:text-horizon-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour au profil
        </Link>
        <h1 className="flex items-center gap-2 font-playfair text-xl italic text-stellar-100 sm:text-2xl">
          <Settings className="h-5 w-5 text-horizon-400" />
          Réglages
        </h1>
        <p className="mt-1 text-xs text-stellar-500">
          Préférences et confidentialité de votre compte.
        </p>
      </div>

      <nav
        className="custom-scrollbar -mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-2"
        aria-label="Sections réglages"
      >
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href.startsWith('/sanctuaire/settings') && pathname === tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-[44px] flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-all sm:px-4 ${
                isActive
                  ? 'border border-horizon-400/30 bg-horizon-400/15 text-horizon-200'
                  : 'border border-transparent text-stellar-400 hover:bg-white/5'
              }`}
            >
              <tab.icon className={`h-4 w-4 ${isActive ? tab.color : ''}`} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <SanctuaireStage className="min-w-0">{children}</SanctuaireStage>
    </SanctuairePage>
  );
}
