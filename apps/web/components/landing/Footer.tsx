import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { LANDING_NAV_ITEMS } from '../../lib/landing-navigation';
import { LandingAnchorLink } from './LandingAnchorLink';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const legalLinks = [
    { name: 'Mentions légales', href: '/mentions-legales' },
    { name: 'Confidentialité', href: '/confidentialite' },
    { name: 'CGV', href: '/cgv' },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-void pb-12 pt-16 content-visibility-auto md:pt-32">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" aria-hidden />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 md:px-12">
        <div className="mb-12 grid grid-cols-1 gap-8 md:mb-24 md:grid-cols-4 md:gap-12 lg:gap-24">
          <div className="md:col-span-2">
            <Link href="/" className="group mb-8 inline-block">
              <span className="font-playfair text-3xl italic text-white transition-colors duration-500 group-hover:text-cosmic-gold md:text-5xl">
                Oracle Lumira
              </span>
            </Link>
            <p className="max-w-sm text-lg font-light leading-relaxed text-white/40">
              Architecture vibratoire et cartographie de l&apos;âme par algorithmes sacrés.
            </p>
          </div>

          <div>
            <span className="mb-8 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
              Navigation
            </span>
            <ul className="space-y-4">
              {LANDING_NAV_ITEMS.map((item) => (
                <li key={item.id}>
                  <LandingAnchorLink
                    sectionId={item.id}
                    className="group flex items-center gap-2 text-sm font-medium tracking-wide text-white/60 transition-colors hover:text-white"
                  >
                    {item.name}
                    <ArrowUpRight
                      className="h-3 w-3 translate-x-1 -translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
                      aria-hidden
                    />
                  </LandingAnchorLink>
                </li>
              ))}
              <li>
                <Link
                  href="/sanctuaire/login"
                  className="group flex items-center gap-2 text-sm font-medium tracking-wide text-white/60 transition-colors hover:text-white"
                >
                  Connexion
                  <ArrowUpRight
                    className="h-3 w-3 translate-x-1 -translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <span className="mb-8 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
              Connect
            </span>
            <ul className="space-y-4">
              <li>
                <a
                  href="mailto:contact@oraclelumira.com"
                  className="text-sm font-medium tracking-wide text-white/60 transition-colors hover:text-white"
                >
                  contact@oraclelumira.com
                </a>
              </li>
              <li>
                <Link
                  href="/notre-approche"
                  className="text-sm font-medium tracking-wide text-white/60 transition-colors hover:text-white"
                >
                  Notre approche
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-sm font-medium tracking-wide text-white/60 transition-colors hover:text-white"
                >
                  Questions fréquentes
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-6 border-t border-white/5 pt-8 text-[10px] font-mono uppercase tracking-widest text-white/30 md:flex-row md:items-end">
          <div className="flex flex-col gap-2">
            <span>© {currentYear} Lumira Systems Inc.</span>
            <span>All rights reserved.</span>
          </div>

          <div className="flex flex-wrap gap-4 md:gap-8">
            {legalLinks.map((link) => (
              <Link key={link.name} href={link.href} className="transition-colors hover:text-white">
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
            <span>System Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
