import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

/**
 * Hero above the fold — fully server-rendered for LCP.
 * No framer-motion / filter blur (those delay paint until hydration).
 */
export function LandingHero() {
  return (
    <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-4 pt-24 md:pt-32 pb-16 md:pb-20 overflow-hidden z-10 selection:bg-cosmic-gold/20">
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay" />

      <div className="relative max-w-[1600px] mx-auto w-full flex flex-col items-center motion-safe:animate-hero-enter">
        <div className="mb-8 md:mb-12 flex items-center gap-3">
          <div className="flex -space-x-3" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/20"
              />
            ))}
          </div>
          <p className="text-cosmic-ethereal/60 text-[10px] md:text-xs tracking-[0.15em] md:tracking-[0.2em] uppercase font-medium">
            2 500+ âmes éveillées · 4.9/5
          </p>
        </div>

        <div className="relative">
          <h1 className="text-[clamp(3rem,13vw,10rem)] leading-[0.85] font-playfair italic tracking-[-0.05em] select-none">
            <span className="block text-white/90 mix-blend-overlay opacity-90">Oracle</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-b from-[#FFD700] to-white -mt-1 md:-mt-6 text-glow-hero">
              Lumira
            </span>
          </h1>

          <div className="mt-8 md:mt-12 max-w-xl mx-auto px-2">
            <p className="text-base md:text-xl lg:text-2xl text-white/85 font-light leading-relaxed tracking-wide">
              Ce que les autres mettent des années à comprendre sur eux-mêmes —
            </p>
            <p className="text-base md:text-xl lg:text-2xl text-cosmic-gold/90 font-light leading-relaxed tracking-wide mt-2">
              Lumira vous le révèle en 24 heures.
            </p>
            <p className="text-white/40 text-[11px] md:text-sm mt-4 md:mt-5 uppercase tracking-[0.15em] md:tracking-[0.2em]">
              Analyse vibratoire · Intelligence IA · Expert humain
            </p>
          </div>
        </div>

        <div className="mt-10 md:mt-16 flex flex-col items-center gap-4 md:gap-6 w-full px-4">
          <Link
            href="#niveaux"
            className="group relative pointer-events-auto w-full max-w-xs md:max-w-none md:w-auto"
          >
            <div className="absolute inset-0 bg-cosmic-gold/30 rounded-full blur-[50px] opacity-0 group-hover:opacity-70 transition-opacity duration-700 scale-150" />
            <div className="relative px-8 md:px-16 py-4 md:py-6 rounded-full border border-white/10 bg-white/[0.02] text-white tracking-[0.2em] md:tracking-[0.25em] text-xs uppercase font-bold group-hover:bg-white/[0.08] group-hover:border-cosmic-gold/50 transition-all duration-500 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_30px_rgba(255,215,0,0.2)] text-center w-full">
              <span className="relative z-10 group-hover:text-cosmic-gold transition-colors duration-500">
                Découvrir ma lecture
              </span>
              <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-cosmic-gold to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500 opacity-50" />
            </div>
          </Link>

          <div className="flex items-center gap-5 md:gap-8 mt-4 md:mt-6 opacity-50">
            <div className="flex flex-col items-center">
              <span className="text-white font-playfair text-lg md:text-xl italic">4.9</span>
              <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-widest">
                Note
              </span>
            </div>
            <div className="w-px h-6 md:h-8 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-white font-playfair text-lg md:text-xl italic">24h</span>
              <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-widest">
                Livraison
              </span>
            </div>
            <div className="w-px h-6 md:h-8 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-white font-playfair text-lg md:text-xl italic">17€</span>
              <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-widest">
                early · 3 mois
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20">
        <span className="text-[9px] uppercase tracking-[0.3em]">Découvrir</span>
        <ChevronDown className="w-4 h-4 motion-safe:animate-bounce" aria-hidden />
      </div>
    </section>
  );
}
