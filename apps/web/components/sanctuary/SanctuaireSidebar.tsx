'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Star } from 'lucide-react';
import { SIDEBAR_NAV, PROFILE_NAV_ITEM, isNavActive } from '@/lib/sanctuaireNav';

export function SanctuaireSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-sidebar fixed left-0 top-0 z-40 hidden h-dvh w-64 flex-col border-r border-white/[0.06] lg:flex">
      <div className="border-b border-white/[0.05] p-6">
        <Link
          href="/sanctuaire"
          className="group flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-horizon-400 shadow-gold-soft">
            <Star className="h-5 w-5 fill-abyss-800 text-abyss-800" />
          </div>
          <div>
            <span className="font-playfair text-lg italic text-stellar-100 transition-colors group-hover:text-horizon-300">
              Sanctuaire
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-stellar-500">
              Espace personnel
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-4" aria-label="Navigation du Sanctuaire">
        <ul className="space-y-1">
          {SIDEBAR_NAV.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.route);

            return (
              <li key={item.key}>
                <Link
                  href={item.route}
                  aria-current={active ? 'page' : undefined}
                  className={`group flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 ${
                    active
                      ? 'bg-horizon-400/10 text-horizon-300'
                      : 'text-stellar-400 hover:bg-white/[0.05] hover:text-stellar-200'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      active ? 'text-horizon-400' : 'text-stellar-500 group-hover:text-stellar-300'
                    }`}
                  />
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-horizon-400" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/[0.05] p-4">
        {(() => {
          const Icon = PROFILE_NAV_ITEM.icon;
          const active = isNavActive(pathname, PROFILE_NAV_ITEM.route);
          return (
            <Link
              href={PROFILE_NAV_ITEM.route}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 ${
                active
                  ? 'bg-horizon-400/10 text-horizon-300'
                  : 'text-stellar-400 hover:bg-white/[0.05] hover:text-stellar-200'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{PROFILE_NAV_ITEM.label}</span>
            </Link>
          );
        })()}
      </div>
    </aside>
  );
}
