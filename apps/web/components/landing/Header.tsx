'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollPositionRef = useRef(0);
  const restoreScrollOnCloseRef = useRef(true);

  const closeMobileMenu = useCallback((restoreScroll: boolean) => {
    restoreScrollOnCloseRef.current = restoreScroll;
    setMobileOpen(false);
  }, []);

  const handleAnchorClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      event.preventDefault();
      const target = document.querySelector(href) as HTMLElement | null;
      closeMobileMenu(false);
      const bodyStyle = document.body.style;
      bodyStyle.overflow = '';
      bodyStyle.paddingRight = '';
      bodyStyle.position = '';
      bodyStyle.top = '';
      bodyStyle.width = '';
      if (window.location.hash !== href) window.history.pushState(null, '', href);
      if (target) window.scrollTo({ top: target.offsetTop, behavior: 'auto' });
    },
    [closeMobileMenu],
  );

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileMenu(true);
    };

    const bodyStyle = document.body.style;
    const previousStyles = {
      overflow: bodyStyle.overflow,
      paddingRight: bodyStyle.paddingRight,
      position: bodyStyle.position,
      top: bodyStyle.top,
      width: bodyStyle.width,
    };
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    restoreScrollOnCloseRef.current = true;
    scrollPositionRef.current = window.scrollY;
    bodyStyle.overflow = 'hidden';
    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollPositionRef.current}px`;
    bodyStyle.width = '100%';
    if (scrollbarWidth > 0) bodyStyle.paddingRight = `${scrollbarWidth}px`;

    window.addEventListener('keydown', onKey);
    return () => {
      bodyStyle.overflow = previousStyles.overflow;
      bodyStyle.paddingRight = previousStyles.paddingRight;
      bodyStyle.position = previousStyles.position;
      bodyStyle.top = previousStyles.top;
      bodyStyle.width = previousStyles.width;
      window.removeEventListener('keydown', onKey);
      if (restoreScrollOnCloseRef.current) {
        window.scrollTo(0, scrollPositionRef.current);
      }
    };
  }, [closeMobileMenu, mobileOpen]);

  const navItems = [
    { name: "L'Offre", href: '#niveaux' },
    { name: 'Comment ça marche', href: '#comment-ca-marche' },
    { name: 'Témoignages', href: '#temoignages' },
  ];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        scrolled ? 'bg-void/90 border-b border-white/5 py-3 md:py-4' : 'bg-transparent py-5 md:py-8'
      }`}
    >
      <nav className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-12 flex items-center justify-between">
        <Link href="/" className="group relative z-50">
          <span className="font-playfair italic text-lg md:text-2xl text-white tracking-tight group-hover:text-cosmic-gold transition-colors duration-500">
            Oracle Lumira
          </span>
        </Link>

        <div className="hidden lg:flex items-center gap-12 absolute left-1/2 -translate-x-1/2">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="relative text-sm font-medium tracking-widest uppercase text-white/70 hover:text-white transition-colors group"
            >
              {item.name}
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-px bg-cosmic-gold group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3 md:gap-8 relative z-50">
          <Link
            href="/sanctuaire/login"
            className="hidden sm:block text-sm font-medium text-white/90 hover:text-cosmic-gold transition-colors"
          >
            Connexion
          </Link>

          <Link
            href="#niveaux"
            className="hidden md:flex items-center justify-center px-6 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cosmic-gold/30 text-white text-xs uppercase tracking-widest font-bold transition-all duration-500 group"
          >
            <span className="group-hover:text-cosmic-gold transition-colors">Commencer</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (mobileOpen) {
                closeMobileMenu(true);
              } else {
                setMobileOpen(true);
              }
            }}
            className="lg:hidden min-h-[44px] min-w-[44px] p-2 text-white hover:text-cosmic-gold transition-colors"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div
          id="mobile-menu"
          className="fixed inset-0 z-40 flex min-h-[100dvh] items-start justify-center overflow-y-auto overscroll-contain bg-void/98 px-6 pt-[calc(env(safe-area-inset-top)+6.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation principale"
        >
          <div className="flex w-full max-w-md flex-col items-stretch gap-4 text-center">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={(event) => handleAnchorClick(event, item.href)}
                className="flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 font-playfair text-3xl italic text-white transition-colors hover:text-cosmic-gold sm:text-4xl"
              >
                {item.name}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-6 text-center">
              <Link
                href="/sanctuaire/login"
                onClick={() => closeMobileMenu(true)}
                className="flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-sm uppercase tracking-widest text-white/60"
              >
                Connexion
              </Link>
              <Link
                href="#niveaux"
                onClick={(event) => handleAnchorClick(event, '#niveaux')}
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-cosmic-gold/30 px-3 py-2 text-sm uppercase tracking-widest text-cosmic-gold"
              >
                Commencer l&apos;expérience
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
