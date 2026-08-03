'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { LANDING_NAV_ITEMS } from '../../lib/landing-navigation';
import { LandingAnchorLink } from './LandingAnchorLink';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const scrollPositionRef = useRef(0);
  const restoreScrollOnCloseRef = useRef(true);
  const restoreFocusOnCloseRef = useRef(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = useCallback((restoreScroll: boolean, restoreFocus = true) => {
    restoreScrollOnCloseRef.current = restoreScroll;
    restoreFocusOnCloseRef.current = restoreFocus;
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileMenu(true);
    };

    const bodyStyle = document.body.style;
    const triggerButton = menuButtonRef.current;
    const previousStyles = {
      overflow: bodyStyle.overflow,
      paddingRight: bodyStyle.paddingRight,
      position: bodyStyle.position,
      top: bodyStyle.top,
      width: bodyStyle.width,
    };
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    restoreScrollOnCloseRef.current = true;
    restoreFocusOnCloseRef.current = true;
    scrollPositionRef.current = window.scrollY;
    bodyStyle.overflow = 'hidden';
    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollPositionRef.current}px`;
    bodyStyle.width = '100%';
    if (scrollbarWidth > 0) bodyStyle.paddingRight = `${scrollbarWidth}px`;

    const focusFirstMenuItem = () => {
      const focusable = menuRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    };

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const frame = window.requestAnimationFrame(focusFirstMenuItem);
    window.addEventListener('keydown', onEscape);
    window.addEventListener('keydown', trapFocus);

    return () => {
      window.cancelAnimationFrame(frame);
      bodyStyle.overflow = previousStyles.overflow;
      bodyStyle.paddingRight = previousStyles.paddingRight;
      bodyStyle.position = previousStyles.position;
      bodyStyle.top = previousStyles.top;
      bodyStyle.width = previousStyles.width;
      window.removeEventListener('keydown', onEscape);
      window.removeEventListener('keydown', trapFocus);

      if (restoreScrollOnCloseRef.current) {
        window.scrollTo(0, scrollPositionRef.current);
      }
      if (restoreFocusOnCloseRef.current) {
        window.requestAnimationFrame(() => triggerButton?.focus());
      }
    };
  }, [closeMobileMenu, mobileOpen]);

  const leaveMobileMenu = useCallback(() => closeMobileMenu(false, false), [closeMobileMenu]);

  return (
    <header
      data-landing-header
      className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled
          ? 'border-b border-white/5 bg-void/90 pb-3 pt-[max(0.75rem,var(--safe-area-top))] backdrop-blur-md md:py-4'
          : 'bg-transparent pb-5 pt-[max(1.25rem,var(--safe-area-top))] md:py-8'
      }`}
    >
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between px-4 md:px-6 lg:px-12">
        <Link href="/" className="group relative z-50" aria-label="Oracle Lumira — Accueil">
          <span className="font-playfair text-lg italic tracking-tight text-white transition-colors duration-500 group-hover:text-cosmic-gold md:text-2xl">
            Oracle Lumira
          </span>
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 xl:flex 2xl:gap-12">
          {LANDING_NAV_ITEMS.map((item) => (
            <LandingAnchorLink
              key={item.id}
              sectionId={item.id}
              className="group relative whitespace-nowrap text-sm font-medium uppercase tracking-widest text-white/70 transition-colors hover:text-white"
            >
              {item.name}
              <span className="absolute -bottom-2 left-1/2 h-px w-0 -translate-x-1/2 bg-cosmic-gold transition-all duration-300 group-hover:w-full" />
            </LandingAnchorLink>
          ))}
        </div>

        <div className="relative z-50 flex items-center gap-3 md:gap-6 xl:gap-8">
          <Link
            href="/sanctuaire/login"
            className="hidden text-sm font-medium text-white/90 transition-colors hover:text-cosmic-gold sm:block"
          >
            Connexion
          </Link>

          <LandingAnchorLink
            sectionId="niveaux"
            className="group hidden items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-all duration-500 hover:border-cosmic-gold/30 hover:bg-white/10 md:flex"
          >
            <span className="transition-colors group-hover:text-cosmic-gold">Commencer</span>
          </LandingAnchorLink>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => (mobileOpen ? closeMobileMenu(true) : setMobileOpen(true))}
            className="min-h-[44px] min-w-[44px] p-2 text-white transition-colors hover:text-cosmic-gold xl:hidden"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div
          id="mobile-menu"
          ref={menuRef}
          className="fixed inset-0 z-40 flex min-h-[100dvh] items-start justify-center overflow-y-auto overscroll-contain bg-void px-6 pb-[calc(var(--safe-area-bottom)+1.5rem)] pt-[calc(var(--safe-area-top)+6.5rem)]"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation principale"
        >
          <div className="flex w-full max-w-md flex-col items-stretch gap-3 text-center">
            {LANDING_NAV_ITEMS.map((item) => (
              <LandingAnchorLink
                key={item.id}
                sectionId={item.id}
                beforeNavigate={leaveMobileMenu}
                className="flex min-h-[52px] items-center justify-center rounded-xl px-3 py-2 font-playfair text-3xl italic text-white transition-colors hover:text-cosmic-gold sm:text-4xl"
              >
                {item.name}
              </LandingAnchorLink>
            ))}

            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/10 pt-5 sm:grid-cols-2">
              <Link
                href="/notre-approche"
                onClick={leaveMobileMenu}
                className="flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-xs uppercase tracking-widest text-white/50 transition-colors hover:text-white"
              >
                Notre approche
              </Link>
              <Link
                href="/faq"
                onClick={leaveMobileMenu}
                className="flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-xs uppercase tracking-widest text-white/50 transition-colors hover:text-white"
              >
                Questions fréquentes
              </Link>
            </div>

            <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-5 text-center">
              <Link
                href="/sanctuaire/login"
                onClick={leaveMobileMenu}
                className="flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-sm uppercase tracking-widest text-white/60"
              >
                Connexion
              </Link>
              <LandingAnchorLink
                sectionId="niveaux"
                beforeNavigate={leaveMobileMenu}
                className="flex min-h-[48px] items-center justify-center rounded-xl border border-cosmic-gold/30 px-3 py-2 text-sm uppercase tracking-widest text-cosmic-gold"
              >
                Commencer l&apos;expérience
              </LandingAnchorLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
