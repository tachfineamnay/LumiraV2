'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
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

  const handleAnchorClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!href.startsWith('#')) return;
      event.preventDefault();
      const target = document.querySelector<HTMLElement>(href);
      if (!target) {
        window.location.assign(href);
        return;
      }
      setPendingAnchor(href);
      closeMobileMenu(false, false);
    },
    [closeMobileMenu],
  );

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen || !pendingAnchor) return;

    const target = document.querySelector<HTMLElement>(pendingAnchor);
    if (!target) {
      window.location.assign(pendingAnchor);
      return;
    }

    // The overlay locks body with position: fixed. React runs that effect's
    // cleanup before this effect, so the native target scroll is applied to
    // the restored document rather than being reset to the pre-menu position.
    // Earlier landing sections use content-visibility for paint work. The
    // first scroll makes them render; repeat over the following frames so
    // their resolved height cannot leave the offer above or below the view.
    let secondFrame: number | undefined;
    let thirdFrame: number | undefined;
    const scrollTarget = () => target.scrollIntoView({ block: 'start', behavior: 'auto' });
    const firstFrame = window.requestAnimationFrame(() => {
      scrollTarget();
      secondFrame = window.requestAnimationFrame(() => {
        scrollTarget();
        thirdFrame = window.requestAnimationFrame(() => {
          scrollTarget();
          window.history.pushState(null, '', pendingAnchor);
          setPendingAnchor(null);
        });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) window.cancelAnimationFrame(secondFrame);
      if (thirdFrame !== undefined) window.cancelAnimationFrame(thirdFrame);
    };
  }, [mobileOpen, pendingAnchor]);

  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash;
      if (!hash) return;
      window.requestAnimationFrame(() => {
        document.querySelector(hash)?.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
    };

    const timeout = window.setTimeout(scrollToHash, 500);
    window.addEventListener('hashchange', scrollToHash);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('hashchange', scrollToHash);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileMenu(true);
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
    scrollPositionRef.current = window.scrollY;
    bodyStyle.overflow = 'hidden';
    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollPositionRef.current}px`;
    bodyStyle.width = '100%';
    if (scrollbarWidth > 0) bodyStyle.paddingRight = `${scrollbarWidth}px`;

    window.addEventListener('keydown', onKey);

    const focusFirstMenuItem = () => {
      const focusable = menuRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirstMenuItem);
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
    window.addEventListener('keydown', trapFocus);

    return () => {
      window.cancelAnimationFrame(frame);
      bodyStyle.overflow = previousStyles.overflow;
      bodyStyle.paddingRight = previousStyles.paddingRight;
      bodyStyle.position = previousStyles.position;
      bodyStyle.top = previousStyles.top;
      bodyStyle.width = previousStyles.width;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', trapFocus);
      if (restoreScrollOnCloseRef.current) {
        window.scrollTo(0, scrollPositionRef.current);
      }
      if (restoreFocusOnCloseRef.current) {
        window.requestAnimationFrame(() => triggerButton?.focus());
      }
    };
  }, [closeMobileMenu, mobileOpen]);

  const navItems = [
    { name: "L'offre", href: '/#niveaux' },
    { name: 'Notre approche', href: '/notre-approche' },
    { name: 'Questions fréquentes', href: '/faq' },
  ];

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-void/90 border-b border-white/5 pb-3 pt-[max(0.75rem,var(--safe-area-top))] md:py-4'
          : 'bg-transparent pb-5 pt-[max(1.25rem,var(--safe-area-top))] md:py-8'
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
            href="/#niveaux"
            className="hidden md:flex items-center justify-center px-6 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cosmic-gold/30 text-white text-xs uppercase tracking-widest font-bold transition-all duration-500 group"
          >
            <span className="group-hover:text-cosmic-gold transition-colors">Commencer</span>
          </Link>

          <button
            ref={menuButtonRef}
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
          ref={menuRef}
          className="fixed inset-0 z-40 flex min-h-[100dvh] items-start justify-center overflow-y-auto overscroll-contain bg-void px-6 pt-[calc(var(--safe-area-top)+6.5rem)] pb-[calc(var(--safe-area-bottom)+1.5rem)]"
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
                href="/#niveaux"
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
