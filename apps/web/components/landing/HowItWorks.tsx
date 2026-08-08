import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { SUBSCRIPTION } from '../../lib/products';

export function HowItWorks() {
  return (
    <section
      id="comment-ca-marche"
      className="py-16 md:py-32 relative overflow-hidden bg-void content-visibility-auto"
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 md:mb-20 gap-8">
          <div>
            <span className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-bold block mb-4">
              Comment ça marche
            </span>
            <h2 className="font-playfair italic text-4xl md:text-5xl lg:text-7xl text-white">
              Personnel.
              <br />
              <span className="text-cosmic-gold opacity-80">Simple. Encadré.</span>
            </h2>
          </div>
          <div className="max-w-sm">
            <p className="text-white/50 text-sm leading-relaxed font-light">
              Vous n&apos;avez pas besoin de connaître l&apos;astrologie ni d&apos;adhérer à une croyance.
              Lumira part de ce que vous vivez, de vos repères et de l&apos;intention que vous choisissez
              de transmettre.
            </p>
            <Link
              href="/commande"
              className="inline-flex items-center gap-2 mt-6 text-amber-400/70 hover:text-amber-400 text-xs uppercase tracking-widest transition-colors group"
            >
              Commencer maintenant
              <ArrowRight
                className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform"
                aria-hidden
              />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 h-auto">
          <div className="md:col-span-7 bg-white/[0.03] border border-white/5 p-7 md:p-12 rounded-[2rem] relative overflow-hidden group hover:border-white/10 transition-colors duration-500 flex flex-col justify-end min-h-[320px] md:min-h-0">
            <div className="absolute top-8 right-8 text-[140px] font-playfair leading-none text-white/[0.02] group-hover:text-white/[0.04] transition-colors duration-700 select-none">
              01
            </div>
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center mb-6 text-3xl">
                🎯
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
                <span className="text-[10px] font-bold tracking-widest uppercase text-amber-300">
                  Après votre commande
                </span>
              </div>
              <h3 className="text-2xl md:text-3xl lg:text-4xl font-playfair italic text-white mb-4">
                Vous constituez votre dossier
              </h3>
              <p className="text-white/55 text-lg font-light leading-relaxed max-w-md">
                Dans votre Sanctuaire privé, vous transmettez vos repères, votre intention et vos
                photos. Vous pouvez relire et modifier votre dossier avant de le sceller.
              </p>
              <p className="text-white/25 text-sm mt-4 italic">
                L&apos;essentiel d&apos;abord. Le contexte complémentaire reste facultatif.
              </p>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col gap-6 md:gap-8">
            <div className="flex-1 bg-white/[0.03] border border-white/5 p-6 md:p-10 rounded-[2rem] relative overflow-hidden group hover:border-white/10 transition-colors duration-500 flex flex-col justify-center">
              <div className="absolute top-4 right-6 text-[80px] font-playfair leading-none text-white/[0.02] group-hover:text-white/[0.05] transition-colors duration-500 select-none">
                02
              </div>
              <h3 className="text-2xl font-playfair italic text-white mb-2 flex items-center gap-3">
                <span className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-xl">
                  ⚡
                </span>
                L&apos;IA prépare, l&apos;expert affine
              </h3>
              <p className="text-white/50 text-sm font-light leading-relaxed mt-3">
                La lecture est préparée à partir de votre dossier scellé. Un expert humain peut
                orienter le travail, relire, corriger et valider le contenu avant toute livraison.
              </p>
            </div>

            <div className="flex-1 bg-gradient-to-br from-cosmic-gold/[0.06] to-transparent border border-cosmic-gold/20 p-6 md:p-10 rounded-[2rem] relative overflow-hidden group hover:bg-cosmic-gold/[0.09] transition-colors duration-500 flex flex-col justify-center">
              <div className="absolute top-4 right-6 text-[80px] font-playfair leading-none text-cosmic-gold/[0.05] group-hover:text-cosmic-gold/[0.1] transition-colors duration-500 select-none">
                03
              </div>
              <h3 className="text-2xl font-playfair italic text-white mb-2 flex items-center gap-3">
                <span className="w-10 h-10 rounded-full border border-cosmic-gold/30 flex items-center justify-center text-xl text-cosmic-gold">
                  ✨
                </span>
                Votre lecture vous attend
              </h3>
              <p className="text-white/65 text-sm font-light leading-relaxed mt-3">
                PDF privé, narration audio et accès au Sanctuaire pendant{' '}
                {SUBSCRIPTION.accessDurationMonths} mois.{' '}
                <span className="text-amber-300/80 font-medium">
                  Livraison sous 24 à 48h après scellement du dossier.
                </span>
              </p>
              <ArrowRight
                className="absolute bottom-10 right-10 text-cosmic-gold opacity-40 w-6 h-6 -rotate-45 group-hover:opacity-80 transition-opacity duration-500"
                aria-hidden
              />
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-white/5 pt-10 flex flex-wrap justify-center gap-x-12 gap-y-4 text-white/25 text-[10px] uppercase tracking-widest">
          <span>🔒 Paiement sécurisé Stripe</span>
          <span>⚡ Livraison 24 à 48h après scellement</span>
          <span>💎 Révision humaine incluse</span>
          <span>↩️ Satisfait ou remboursé 14 jours</span>
        </div>
      </div>
    </section>
  );
}
