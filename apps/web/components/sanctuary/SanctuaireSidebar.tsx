'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Star } from 'lucide-react';
import { SIDEBAR_NAV, PROFILE_NAV_ITEM, isNavActive } from '@/lib/sanctuaireNav';

export function SanctuaireSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-sidebar-aube fixed left-0 top-0 z-40 hidden h-dvh w-64 flex-col lg:flex">
      <div className="border-b border-ivoire-500/[0.04] p-6">
        <Link
          href="/sanctuaire"
          className="group flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-ivoire-400 to-horizon-400 shadow-ivoire-soft">
            <Star className="h-5 w-5 fill-abyss-800 text-abyss-800" />
          </div>
          <div>
            <span className="font-playfair text-lg italic text-ivoire-100 transition-colors group-hover:text-ivoire-300">
              Sanctuaire
            </span>
            <span className="block text-[10px] uppercase tracking-wider text-brume-300">
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
                      ? 'bg-ivoire-400/8 text-ivoire-300'
                      : 'text-brume-200 hover:bg-brume-700/25 hover:text-ivoire-200'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      active ? 'text-ivoire-400' : 'text-brume-300 group-hover:text-ivoire-300'
                    }`}
                  />
                  <span className="flex-1 text-sm font-medium">{item.label}</span>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-ivoire-400" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-ivoire-500/[0.04] p-4">
        {(() => {
          const Icon = PROFILE_NAV_ITEM.icon;
          const active = isNavActive(pathname, PROFILE_NAV_ITEM.route);
          return (
            <Link
              href={PROFILE_NAV_ITEM.route}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 ${
                active
                  ? 'bg-ivoire-400/8 text-ivoire-300'
                  : 'text-brume-200 hover:bg-brume-700/25 hover:text-ivoire-200'
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
