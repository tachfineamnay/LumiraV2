'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_NAV, isNavActive } from '@/lib/sanctuaireNav';

/** Five essential routes — floating dock over the paper stages. */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      aria-label="Navigation principale"
    >
      <div className="relative mx-auto max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-abyss-800/92 shadow-dock backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-horizon-400/40 to-transparent"
          aria-hidden
        />
        <div className="relative grid grid-cols-5 px-1 py-1.5">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.route);
            return (
              <Link
                key={item.key}
                href={item.route}
                aria-current={active ? 'page' : undefined}
                className="flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
              >
                <span
                  className={`relative rounded-xl p-2 transition-colors ${
                    active ? 'bg-horizon-400/15 text-horizon-300' : 'text-stellar-500'
                  }`}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-xl border border-horizon-400/25" />
                  )}
                  <Icon className="relative h-5 w-5" />
                </span>
                <span
                  className={`max-w-full truncate text-[9px] font-medium ${
                    active ? 'text-horizon-300' : 'text-stellar-500'
                  }`}
                >
                  {item.shortLabel || item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
