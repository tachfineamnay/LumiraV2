'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { CommandPalette } from './CommandPalette';

interface DeskLayoutProps {
  children: ReactNode;
}

export function DeskLayout({ children }: DeskLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((o) => !o), []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  // Close drawer on Escape
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileNav();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen, closeMobileNav]);

  // Close drawer when resizing to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) closeMobileNav();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [closeMobileNav]);

  return (
    <div className="flex h-dvh min-h-0 bg-desk-bg text-desk-text overflow-hidden">
      <CommandPalette />

      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={closeMobileNav} />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Header onMenuClick={toggleMobileNav} mobileNavOpen={mobileNavOpen} />
        <main className="flex-1 overflow-auto min-h-0">{children}</main>
      </div>
    </div>
  );
}
