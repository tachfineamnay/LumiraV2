import Link from 'next/link';
import { MobileNavigation, type NavigationItem } from './MobileNavigation';

const navItems: readonly NavigationItem[] = [
  { name: "L'offre", href: '/#niveaux' },
  { name: 'Notre approche', href: '/notre-approche' },
  { name: 'Questions fréquentes', href: '/faq' },
];

/** Server-rendered landing shell; only the mobile drawer hydrates. */
export function Header() {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-void/95 py-3 backdrop-blur-sm">
      <nav className="mx-auto flex max-w-[1400px] items-center justify-between px-4 md:px-6 lg:px-12">
        <Link href="/" className="group relative z-50">
          <span className="font-playfair text-lg italic tracking-tight text-white transition-colors duration-500 group-hover:text-cosmic-gold md:text-2xl">
            Oracle Lumira
          </span>
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-12 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group relative text-sm font-medium uppercase tracking-widest text-white/70 transition-colors hover:text-white"
            >
              {item.name}
              <span className="absolute -bottom-2 left-1/2 h-px w-0 -translate-x-1/2 bg-cosmic-gold transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </div>

        <div className="relative z-50 flex items-center gap-3 md:gap-8">
          <a
            href="/sanctuaire/login"
            className="hidden text-sm font-medium text-white/90 transition-colors hover:text-cosmic-gold sm:block"
          >
            Connexion
          </a>
          <a
            href="/#niveaux"
            className="hidden items-center justify-center rounded-full border border-white/10 bg-white/5 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-all duration-500 hover:border-cosmic-gold/30 hover:bg-white/10 md:flex"
          >
            Commencer
          </a>
          <MobileNavigation items={navItems} />
        </div>
      </nav>
    </header>
  );
}
