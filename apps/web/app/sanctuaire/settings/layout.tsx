'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, CreditCard, Shield, ArrowLeft, SlidersHorizontal, BookOpen } from 'lucide-react';

const tabs = [
  {
    label: 'Préférences',
    icon: SlidersHorizontal,
    href: '/sanctuaire/settings/preferences',
    color: 'text-serenity-400',
  },
  {
    label: 'Sécurité',
    icon: Shield,
    href: '/sanctuaire/settings/security',
    color: 'text-rose-400',
  },
  {
    label: 'Abonnement',
    icon: CreditCard,
    href: '/sanctuaire/abonnement',
    color: 'text-amber-400',
  },
  {
    label: 'Lectures',
    icon: BookOpen,
    href: '/sanctuaire/draws',
    color: 'text-purple-400',
  },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Link
            href="/sanctuaire/profile"
            className="inline-flex items-center gap-2 text-stellar-400 hover:text-horizon-300 transition-colors text-sm mb-2 min-h-[40px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au profil
          </Link>
          <h1 className="text-xl sm:text-2xl font-playfair italic text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-horizon-400" />
            Réglages
          </h1>
          <p className="text-xs text-stellar-500 mt-1">
            Préférences et confidentialité de votre compte.
          </p>
        </div>
      </div>

      {/* Horizontal tabs — no competing fixed sidebar */}
      <nav
        className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1 scrollbar-thin"
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
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 min-h-[44px] rounded-xl whitespace-nowrap text-sm transition-all flex-shrink-0 ${
                isActive
                  ? 'bg-white/10 text-white border border-white/10'
                  : 'text-stellar-400 hover:bg-white/5 border border-transparent'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? tab.color : ''}`} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
