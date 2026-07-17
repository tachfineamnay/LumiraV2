'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Home, LogOut, ShieldCheck } from 'lucide-react';
import { SanctuaireGuard } from '../../components/guards/SanctuaireGuard';
import { MobileBottomNav } from '../../components/sanctuary/MobileBottomNav';
import { SanctuaireSidebar } from '../../components/sanctuary/SanctuaireSidebar';
import { SanctuaireAuthProvider, useSanctuaireAuth } from '../../context/SanctuaireAuthContext';
import { SanctuaireProvider } from '../../context/SanctuaireContext';
import { PROFILE_MENU_NAV } from '@/lib/sanctuaireNav';

function SanctuaireLayoutContent({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout, user } = useSanctuaireAuth();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  if (pathname === '/sanctuaire/login') return <>{children}</>;

  const userName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Votre profil';
  const userInitial = user?.firstName?.[0]?.toUpperCase() || 'U';

  return (
    <SanctuaireGuard>
      <div className="min-h-dvh bg-abyss-700 text-stellar-100 selection:bg-horizon-400/20 starfield">
        <SanctuaireSidebar />
        <div className="min-h-dvh lg:ml-64">
          <header className="sticky top-0 z-40 flex min-h-[64px] items-center justify-between border-b border-white/[0.05] bg-abyss-700/85 px-3 py-3 backdrop-blur-xl sm:px-5">
            <div className="flex items-center gap-2 lg:hidden">
              <Link
                href="/sanctuaire"
                aria-label="Accueil Lumira"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-abyss-500/50 text-stellar-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
              >
                <Home className="h-4 w-4" />
              </Link>
              <span className="font-playfair text-sm italic text-stellar-200">Lumira</span>
            </div>

            <div className="hidden items-center gap-2 lg:flex" aria-label="Statut d'accès">
              <ShieldCheck className="h-4 w-4 text-horizon-300" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-200">
                Accès à vie
              </span>
            </div>

            {isAuthenticated && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((open) => !open)}
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                  className="flex min-h-[44px] items-center gap-2 rounded-xl border border-white/[0.08] bg-abyss-500/50 px-2 py-2 text-left transition-colors hover:bg-abyss-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 sm:px-3"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-horizon-300 to-horizon-500 text-sm font-bold text-abyss-800">
                    {userInitial}
                  </span>
                  <span className="hidden max-w-[150px] truncate text-sm text-stellar-200 sm:block">
                    {userName}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-stellar-500 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <>
                      <button
                        type="button"
                        aria-label="Fermer le menu profil"
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setIsProfileOpen(false)}
                      />
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/[0.08] bg-abyss-600/95 shadow-abyss backdrop-blur-xl"
                      >
                        <div className="border-b border-white/[0.05] p-4">
                          <p className="truncate text-sm font-medium text-stellar-100">
                            {userName}
                          </p>
                          <p className="truncate text-xs text-stellar-500">{user?.email}</p>
                          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-horizon-400/25 bg-horizon-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-horizon-200">
                            <ShieldCheck className="h-3 w-3" /> Accès à vie
                          </p>
                        </div>
                        <nav className="p-2">
                          {PROFILE_MENU_NAV.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.key}
                                href={item.route}
                                role="menuitem"
                                onClick={() => setIsProfileOpen(false)}
                                className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-sm text-stellar-200 hover:bg-white/[0.05]"
                              >
                                <Icon className="h-5 w-5 text-horizon-300" />
                                <span>{item.label}</span>
                              </Link>
                            );
                          })}
                        </nav>
                        <div className="border-t border-white/[0.05] p-2">
                          <button
                            type="button"
                            onClick={() => {
                              logout();
                              setIsProfileOpen(false);
                            }}
                            className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-rose-300 hover:bg-rose-400/10"
                          >
                            <LogOut className="h-5 w-5" /> Déconnexion
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </header>
          <main className="sanctuaire-main flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
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
