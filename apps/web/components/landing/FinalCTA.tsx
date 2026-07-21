import { Sparkles, ShieldCheck, Clock, Star } from 'lucide-react';
import Link from 'next/link';
import { SUBSCRIPTION } from '../../lib/products';

export function FinalCTA() {
  return (
    <section className="relative py-16 md:py-40 overflow-hidden content-visibility-auto">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-900/5 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div className="mb-8">
          <span className="inline-flex items-center gap-2 text-amber-400/70 text-[11px] uppercase tracking-[0.3em] font-bold">
            <span className="w-8 h-px bg-amber-400/30" />
            Votre transformation commence ici
            <span className="w-8 h-px bg-amber-400/30" />
          </span>
        </div>

        <h2 className="font-playfair italic text-4xl md:text-5xl lg:text-7xl text-white leading-[1.05] mb-6 md:mb-8">
          Êtes-vous prêt à{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
            vous voir vraiment ?
          </span>
        </h2>

        <p className="text-white/60 text-base md:text-lg font-light leading-relaxed max-w-2xl mx-auto mb-10 md:mb-16">
          Des milliers de personnes ont reçu leur lecture. Elles décrivent toutes le même moment :
          celui où les mots de l&apos;Oracle ont mis des mots sur quelque chose qu&apos;elles
          ressentaient depuis des années sans pouvoir l&apos;exprimer.
        </p>

        <div className="flex flex-col items-center gap-6">
          <Link
            href="/commande"
            className="group relative inline-flex items-center gap-3 px-8 md:px-12 py-4 md:py-6 rounded-2xl text-abyss-900 font-bold text-base md:text-lg overflow-hidden w-full max-w-xs justify-center md:w-auto bg-gold-gradient shadow-gold-glow"
          >
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
            <Sparkles className="w-6 h-6 relative z-10" aria-hidden />
            <span className="relative z-10 tracking-wide">
              Recevoir ma Lecture — {SUBSCRIPTION.price}€
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 text-white/30 text-xs">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400/50" aria-hidden />
              Livraison sous 24h
            </span>
            <span className="w-1 h-1 rounded-full bg-white/10" />
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/50" aria-hidden />
              Satisfait ou remboursé 14 jours
            </span>
            <span className="w-1 h-1 rounded-full bg-white/10" />
            <span className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-amber-400/50 fill-amber-400/50" aria-hidden />
              4.9 / 5 sur 2 500+ lectures
            </span>
          </div>
        </div>

        <p className="mt-16 text-white/20 text-xs uppercase tracking-[0.25em] font-light">
          Une seule lecture peut changer votre trajectoire.
        </p>
      </div>
    </section>
  );
}
