'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MOBILE_NAV, isNavActive } from '@/lib/sanctuaireNav';

/** Four essential routes, kept visible and comfortably tappable on a phone. */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      aria-label="Navigation principale du Sanctuaire"
    >
      <div className="absolute inset-0 border-t border-white/[0.07] bg-abyss-800/95 shadow-[0_-12px_30px_rgba(4,6,16,0.32)] backdrop-blur-xl" />
      <div className="relative grid grid-cols-4 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.route);
          return (
            <Link
              key={item.key}
              href={item.route}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              className="group flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
            >
              <span
                className={`relative grid h-9 w-11 place-items-center rounded-2xl border transition-colors ${
                  active
                    ? 'border-horizon-400/20 bg-horizon-400/15 text-horizon-200'
                    : 'border-transparent text-stellar-500 group-hover:bg-white/[0.04] group-hover:text-stellar-300'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span
                className={`max-w-full truncate text-[10px] font-medium leading-none ${
                  active ? 'text-horizon-200' : 'text-stellar-500'
                }`}
              >
                {item.shortLabel || item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}