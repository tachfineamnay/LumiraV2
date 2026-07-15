'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PRIMARY_NAV, MORE_NAV, isNavActive, isMoreNavActive } from '@/lib/sanctuaireNav';

export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const closeMore = useCallback(() => setMoreOpen(false), []);

  useEffect(() => {
    closeMore();
  }, [pathname, closeMore]);

  useEffect(() => {
    if (!moreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMore();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen, closeMore]);

  const moreActive = isMoreNavActive(pathname);

  return (
    <>
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
        aria-label="Navigation principale"
      >
        <div className="absolute inset-0 bg-abyss-800/95 backdrop-blur-xl border-t border-white/[0.04]" />

        <div className="relative flex items-center justify-around px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.route);

            return (
              <Link
                key={item.key}
                href={item.route}
                className="flex flex-col items-center gap-0.5 p-1.5 min-w-[56px] min-h-[52px] group"
              >
                <div
                  className={`relative p-2 rounded-xl transition-all duration-300 ${
                    active ? 'bg-horizon-400/15' : 'group-hover:bg-white/5'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="mobileNavIndicator"
                      className="absolute inset-0 bg-gradient-to-br from-horizon-400/20 to-horizon-500/10 rounded-xl border border-horizon-400/20"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={`relative z-10 w-5 h-5 transition-colors duration-300 ${
                      active ? 'text-horizon-300' : 'text-stellar-500 group-hover:text-stellar-300'
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors duration-300 ${
                    active ? 'text-horizon-300' : 'text-stellar-500 group-hover:text-stellar-300'
                  }`}
                >
                  {item.shortLabel || item.label}
                </span>
              </Link>
            );
          })}

          {/* Plus */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Plus de destinations"
            aria-expanded={moreOpen}
            className="flex flex-col items-center gap-0.5 p-1.5 min-w-[56px] min-h-[52px] group"
          >
            <div
              className={`relative p-2 rounded-xl transition-all duration-300 ${
                moreActive || moreOpen ? 'bg-horizon-400/15' : 'group-hover:bg-white/5'
              }`}
            >
              {(moreActive || moreOpen) && (
                <div className="absolute inset-0 bg-gradient-to-br from-horizon-400/20 to-horizon-500/10 rounded-xl border border-horizon-400/20" />
              )}
              <MoreHorizontal
                className={`relative z-10 w-5 h-5 ${
                  moreActive || moreOpen ? 'text-horizon-300' : 'text-stellar-500'
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-medium ${
                moreActive || moreOpen ? 'text-horizon-300' : 'text-stellar-500'
              }`}
            >
              Plus
            </span>
          </button>
        </div>
      </motion.nav>

      {/* More sheet */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={closeMore}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Plus de destinations"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[70] lg:hidden
                         bg-abyss-800 border-t border-white/10 rounded-t-3xl
                         pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20 mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
                <h2 className="text-sm font-semibold text-stellar-100 mt-2">Plus</h2>
                <button
                  type="button"
                  onClick={closeMore}
                  aria-label="Fermer"
                  className="p-2 min-w-[44px] min-h-[44px] rounded-xl hover:bg-white/5 text-stellar-400 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="px-3 pb-4 space-y-1">
                {MORE_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = isNavActive(pathname, item.route);
                  return (
                    <Link
                      key={item.key}
                      href={item.route}
                      onClick={closeMore}
                      className={`flex items-center gap-3 px-4 py-3.5 min-h-[52px] rounded-xl transition-colors ${
                        active
                          ? 'bg-horizon-400/10 text-horizon-300'
                          : 'text-stellar-300 hover:bg-white/5'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          active ? 'bg-horizon-400/20' : 'bg-white/5'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
