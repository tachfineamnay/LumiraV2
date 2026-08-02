'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, ShieldCheck, Star } from 'lucide-react';
import { SanctuaireGuard } from '../../components/guards/SanctuaireGuard';
import { MobileBottomNav } from '../../components/sanctuary/MobileBottomNav';
import { SanctuaireSidebar } from '../../components/sanctuary/SanctuaireSidebar';
import { SanctuaireAmendmentBanner } from '../../components/sanctuary/SanctuaireAmendmentBanner';
import { SanctuaireAuthProvider, useSanctuaireAuth } from '../../context/SanctuaireAuthContext';
import { SanctuaireProvider } from '../../context/SanctuaireContext';
import { useStableVisualViewportHeight } from '../../hooks/useStableVisualViewportHeight';
import { PROFILE_MENU_NAV } from '@/lib/sanctuaireNav';

function SanctuaireLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout, user } = useSanctuaireAuth();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const visualViewportHeight = useStableVisualViewportHeight({ maxWidth: 1024, minHeight: 280 });

  const closeProfileMenu = useCallback((restoreFocus = false) => {
    setIsProfileOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => profileTriggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    closeProfileMenu(false);
  }, [closeProfileMenu, pathname]);

  useEffect(() => {
    if (!isProfileOpen) return;
    const focusFirstMenuItem = () => {
      profileMenuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"], button:not([disabled])')
        ?.focus();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeProfileMenu(true);
    };
    const frame = window.requestAnimationFrame(focusFirstMenuItem);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeProfileMenu, isProfileOpen]);

  const handleProfileMenuKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const menuItems = Array.from(
        profileMenuRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"], button:not([disabled])',
        ) ?? [],
      );
      if (!menuItems.length) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeProfileMenu(true);
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const currentIndex = Math.max(0, menuItems.indexOf(activeElement as HTMLElement));
      const first = menuItems[0];
      const last = menuItems[menuItems.length - 1];

      if (event.key === 'Tab') {
        if (event.shiftKey && activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        first?.focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        last?.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        menuItems[(currentIndex + 1) % menuItems.length]?.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        menuItems[(currentIndex - 1 + menuItems.length) % menuItems.length]?.focus();
      }
    },
    [closeProfileMenu],
  );

  if (pathname === '/sanctuaire/login') return <>{children}</>;

  const userName =
    [user?.firstName, user?.lastName]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(' ')
      .trim() ||
    user?.email ||
    'Votre profil';
  const userInitial = userName[0]?.toUpperCase() || 'U';

  return (
    <SanctuaireGuard>
      <div
        data-testid="sanctuaire-shell"
        style={{ height: visualViewportHeight ? `${visualViewportHeight}px` : '100dvh' }}
        className="sanctuaire-aube relative overflow-hidden text-ivoire-100 selection:bg-horizon-300/15"
      >
        <SanctuaireSidebar />
        <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-col lg:ml-64">
          <header className="glass-header-aube sticky top-0 z-40 flex min-h-[var(--sanctuaire-header-h)] shrink-0 items-center justify-between px-3 py-3 sm:px-5">
            <Link
              href="/sanctuaire"
              aria-label="Accueil du Sanctuaire Lumira"
              className="flex min-h-[44px] items-center gap-2 rounded-xl px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 lg:hidden"
            >
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-horizon-400 text-abyss-900 shadow-gold-soft">
                <Star className="h-4 w-4 fill-current" />
              </span>
              <span className="font-playfair text-sm italic text-ivoire-200">Lumira</span>
            </Link>

            <div className="hidden items-center gap-2 lg:flex" aria-label="Statut d’accès">
              <ShieldCheck className="h-4 w-4 text-ivoire-400" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ivoire-300">
                Accès early · 3 mois
              </span>
            </div>

            {isAuthenticated && (
              <div className="relative">
                <button
                  ref={profileTriggerRef}
                  type="button"
                  onClick={() => {
                    if (isProfileOpen) closeProfileMenu(false);
                    else setIsProfileOpen(true);
                  }}
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                  aria-controls="sanctuaire-profile-menu"
                  aria-label={`Ouvrir le menu profil de ${userName}`}
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-ivoire-500/[0.06] bg-brume-700/40 px-2 py-2 text-left transition-colors hover:bg-brume-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 sm:px-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-horizon-400 text-sm font-bold text-abyss-800">
                    {userInitial}
                  </span>
                  <span className="hidden max-w-[150px] truncate text-sm text-ivoire-200 sm:block">
                    {userName}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-brume-300 transition-transform ${
                      isProfileOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isProfileOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Fermer le menu profil"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => closeProfileMenu(true)}
                    />
                    <div
                      ref={profileMenuRef}
                      id="sanctuaire-profile-menu"
                      role="menu"
                      aria-label="Profil et réglages"
                      onKeyDown={handleProfileMenuKeyDown}
                      className="absolute right-0 z-50 mt-2 w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-ivoire-500/[0.06] glass-aube shadow-aube-glow"
                    >
                      <div className="border-b border-ivoire-500/[0.04] p-4">
                        <p className="truncate text-sm font-medium text-ivoire-100">{userName}</p>
                        <p className="truncate text-xs text-brume-300">{user?.email}</p>
                        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ivoire-500/[0.06] bg-ivoire-400/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ivoire-300">
                          <ShieldCheck className="h-3 w-3" /> Accès early · 3 mois
                        </p>
                      </div>
                      <nav className="p-2" aria-label="Dossier, profil et réglages">
                        {PROFILE_MENU_NAV.map((item) => {
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.key}
                              href={item.route}
                              role="menuitem"
                              onClick={() => closeProfileMenu(false)}
                              className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-2 text-sm text-ivoire-200 hover:bg-brume-700/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
                            >
                              <Icon className="h-5 w-5 shrink-0 text-ivoire-400" />
                              <span className="min-w-0">
                                <span className="block truncate">{item.label}</span>
                                {item.sublabel && (
                                  <span className="mt-0.5 block truncate text-[11px] text-brume-300">
                                    {item.sublabel}
                                  </span>
                                )}
                              </span>
                            </Link>
                          );
                        })}
                      </nav>
                      <div className="border-t border-ivoire-500/[0.04] p-2">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            logout();
                            closeProfileMenu(false);
                          }}
                          className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-rose-300 hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                        >
                          <LogOut className="h-5 w-5" /> Déconnexion
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </header>
          <main className="sanctuaire-main flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip overflow-y-auto">
            <SanctuaireAmendmentBanner />
            {children}
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </SanctuaireGuard>
  );
}

export default function SanctuaireLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <SanctuaireAuthProvider>
      <SanctuaireProvider>
        <SanctuaireLayoutContent>{children}</SanctuaireLayoutContent>
      </SanctuaireProvider>
    </SanctuaireAuthProvider>
  );
}
