'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export type NavigationItem = { name: string; href: string };

export function MobileNavigation({ items }: { items: readonly NavigationItem[] }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const scrollPositionRef = useRef(0);
  const restoreFocusRef = useRef(true);

  const close = useCallback((restoreFocus = true) => {
    restoreFocusRef.current = restoreFocus;
    setOpen(false);
  }, []);

  const followAnchor = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      const destination = new URL(href, window.location.origin);
      if (!destination.hash || destination.pathname !== window.location.pathname) {
        close();
        return;
      }

      event.preventDefault();
      const target = document.getElementById(decodeURIComponent(destination.hash.slice(1)));
      close(false);
      window.requestAnimationFrame(() => {
        target?.scrollIntoView({ block: 'start', behavior: 'auto' });
        window.history.pushState(null, '', destination.hash);
      });
    },
    [close],
  );

  useEffect(() => {
    if (!open) return;

    const bodyStyle = document.body.style;
    const previous = {
      overflow: bodyStyle.overflow,
      paddingRight: bodyStyle.paddingRight,
      position: bodyStyle.position,
      top: bodyStyle.top,
      width: bodyStyle.width,
    };
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const trigger = triggerRef.current;
    scrollPositionRef.current = window.scrollY;
    bodyStyle.overflow = 'hidden';
    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${scrollPositionRef.current}px`;
    bodyStyle.width = '100%';
    if (scrollbarWidth > 0) bodyStyle.paddingRight = `${scrollbarWidth}px`;

    const focusable = () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const frame = window.requestAnimationFrame(() => focusable()[0]?.focus());
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      Object.assign(bodyStyle, previous);
      window.removeEventListener('keydown', onKeyDown);
      window.scrollTo(0, scrollPositionRef.current);
      if (restoreFocusRef.current) window.requestAnimationFrame(() => trigger?.focus());
    };
  }, [close, open]);

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="relative z-50 min-h-[44px] min-w-[44px] p-2 text-white transition-colors hover:text-cosmic-gold"
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={open}
        aria-controls="mobile-menu"
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {open && (
        <div
          id="mobile-menu"
          ref={menuRef}
          className="fixed inset-0 z-40 flex min-h-[100dvh] items-start justify-center overflow-y-auto overscroll-contain bg-void px-6 pt-[calc(var(--safe-area-top)+6.5rem)] pb-[calc(var(--safe-area-bottom)+1.5rem)]"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation principale"
        >
          <div className="flex w-full max-w-md flex-col items-stretch gap-4 text-center">
            {items.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={(event) => followAnchor(event, item.href)}
                className="flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 font-playfair text-3xl italic text-white transition-colors hover:text-cosmic-gold sm:text-4xl"
              >
                {item.name}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-6 text-center">
              <a
                href="/sanctuaire/login"
                onClick={() => close()}
                className="flex min-h-[44px] items-center justify-center rounded-xl px-3 py-2 text-sm uppercase tracking-widest text-white/60"
              >
                Connexion
              </a>
              <Link
                href="/#niveaux"
                onClick={(event) => followAnchor(event, '/#niveaux')}
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-cosmic-gold/30 px-3 py-2 text-sm uppercase tracking-widest text-cosmic-gold"
              >
                Commencer l&apos;expérience
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
