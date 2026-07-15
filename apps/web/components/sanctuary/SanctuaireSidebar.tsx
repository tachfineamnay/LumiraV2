'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Star, ChevronRight, Sparkles } from 'lucide-react';
import { SIDEBAR_NAV, PROFILE_NAV_ITEM, isNavActive } from '@/lib/sanctuaireNav';

export function SanctuaireSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 glass-sidebar z-40">
      <div className="p-6 border-b border-white/5">
        <Link href="/sanctuaire" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-horizon-400 to-horizon-500 flex items-center justify-center shadow-gold-soft">
            <Star className="w-5 h-5 text-abyss-800 fill-abyss-800" />
          </div>
          <div>
            <span className="text-lg font-playfair italic text-stellar-100 group-hover:text-horizon-300 transition-colors">
              Sanctuaire
            </span>
            <span className="block text-[10px] text-stellar-500 uppercase tracking-wider">
              Oracle Lumira
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {SIDEBAR_NAV.map((item, index) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.route);

            return (
              <motion.li
                key={item.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={item.route}
                  className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-all duration-300 group ${
                    active
                      ? 'bg-horizon-400/10 text-horizon-300 border-l-2 border-horizon-400'
                      : 'text-stellar-400 hover:text-stellar-200 hover:bg-white/5'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      active ? 'text-horizon-400' : 'text-stellar-500 group-hover:text-stellar-300'
                    }`}
                  />
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  {item.sublabel && !active && (
                    <span className="text-[10px] text-stellar-600">{item.sublabel}</span>
                  )}
                  {active && <ChevronRight className="w-4 h-4 text-horizon-400/50" />}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/5 space-y-3">
        {(() => {
          const Icon = PROFILE_NAV_ITEM.icon;
          const active = isNavActive(pathname, PROFILE_NAV_ITEM.route);
          return (
            <Link
              href={PROFILE_NAV_ITEM.route}
              className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-all ${
                active
                  ? 'bg-horizon-400/10 text-horizon-300'
                  : 'text-stellar-400 hover:text-stellar-200 hover:bg-white/5'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{PROFILE_NAV_ITEM.label}</span>
            </Link>
          );
        })()}

        <div className="p-4 rounded-2xl bg-gradient-to-br from-serenity-600/20 to-serenity-700/10 border border-serenity-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-serenity-300" />
            <span className="text-sm font-bold text-serenity-200">Évoluer</span>
          </div>
          <p className="text-xs text-stellar-500 mb-3 leading-relaxed">
            Découvrez les niveaux supérieurs de votre parcours spirituel
          </p>
          <Link href="/commande">
            <button
              type="button"
              className="w-full py-2.5 min-h-[44px] rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-800 text-sm font-semibold hover:shadow-gold-glow transition-all"
            >
              Voir les offres
            </button>
          </Link>
        </div>
      </div>
    </aside>
  );
}
