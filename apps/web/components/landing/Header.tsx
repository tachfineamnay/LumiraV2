'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

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
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-white hover:text-cosmic-gold transition-colors"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="fixed inset-0 bg-void/98 z-40 flex items-center justify-center">
          <div className="flex flex-col items-center gap-8">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="font-playfair italic text-4xl text-white hover:text-cosmic-gold transition-colors"
              >
                {item.name}
              </Link>
            ))}
            <div className="mt-8 flex flex-col gap-4 text-center">
              <Link
                href="/sanctuaire/login"
                onClick={() => setMobileOpen(false)}
                className="text-white/60 text-sm uppercase tracking-widest"
              >
                Connexion
              </Link>
              <Link
                href="#niveaux"
                onClick={() => setMobileOpen(false)}
                className="text-cosmic-gold text-sm uppercase tracking-widest border-b border-cosmic-gold/30 pb-1"
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
