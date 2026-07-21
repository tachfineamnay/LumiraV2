import Link from 'next/link';
import {
  Crown,
  Sparkles,
  MessageCircle,
  Star,
  Check,
  ShieldCheck,
  FileText,
  Headphones,
  Palette,
  Compass,
  PenLine,
} from 'lucide-react';
import { SUBSCRIPTION } from '../../lib/products';

const GROUP_ICONS = [
  [FileText, Headphones, Palette],
  [MessageCircle, Compass, PenLine],
] as const;

export function LandingPricing() {
  return (
    <section id="niveaux" className="py-16 md:py-24 relative z-10 content-visibility-auto">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-cosmic-gold text-xs font-bold tracking-widest uppercase">
            L&apos;offre de lancement
          </span>
          <h2 className="font-playfair italic text-4xl md:text-5xl lg:text-6xl text-cosmic-divine mt-4 mb-6">
            Tout. Pour le prix d&apos;un déjeuner.
          </h2>
          <p className="text-cosmic-ethereal max-w-2xl mx-auto text-lg leading-relaxed font-light">
            Nous aurions pu facturer chaque livrable séparément. Nous avons choisi l&apos;accès
            complet à <span className="text-white/80 font-medium">29€ une seule fois</span> — parce
            que votre transformation ne devrait pas avoir de prix d&apos;entrée prohibitif.
          </p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-amber-500/20 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

          <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-abyss-600/80 via-abyss-700/90 to-abyss-600/80">
            <div className="p-5 sm:p-8 md:p-12 pb-0 md:pb-0">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
                <div>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
                    <Crown className="w-3.5 h-3.5 text-amber-400" aria-hidden />
                    <span className="text-[11px] font-bold tracking-widest uppercase text-amber-300">
                      {SUBSCRIPTION.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl text-white/30 line-through font-light">97€</span>
                    <span className="text-5xl md:text-6xl font-playfair italic text-white">
                      {SUBSCRIPTION.price}€
                    </span>
                    <span className="text-lg text-white/40">paiement unique</span>
                  </div>
                  <p className="mt-2 text-white/50 text-sm">
                    Accès à vie · Aucun renouvellement · Offre de lancement
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end gap-3">
                  <Link
                    href="/commande"
                    className="group/btn relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-abyss-900 font-bold text-base hover:from-amber-400 hover:to-amber-500 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(245,158,11,0.4)]"
                  >
                    <Sparkles className="w-5 h-5" aria-hidden />
                    Commencer mon voyage — {SUBSCRIPTION.price}€
                  </Link>
                  <div className="flex items-center gap-1.5 text-emerald-400/70 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
                    <span>{SUBSCRIPTION.guaranteeText}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-8 md:mx-12 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="p-5 sm:p-8 md:p-12 pt-6 md:pt-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {SUBSCRIPTION.featureGroups.map((group, gi) => (
                  <div key={group.title}>
                    <h3 className="text-sm font-bold tracking-widest uppercase text-amber-400/80 mb-5 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-xs text-amber-400">
                        {gi + 1}
                      </span>
                      {group.title}
                    </h3>
                    <div className="space-y-4">
                      {group.items.map((item, i) => {
                        const Icon = GROUP_ICONS[gi]?.[i] || Star;
                        return (
                          <div key={item.label} className="flex gap-3">
                            <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Icon className="w-4 h-4 text-amber-400/70" aria-hidden />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-white/90 block">
                                {item.label}
                              </span>
                              <span className="text-xs text-white/45 leading-relaxed">
                                {item.detail}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-8 md:mx-12 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="p-4 md:p-6 md:px-12 flex flex-wrap items-center justify-center gap-x-4 md:gap-x-6 gap-y-2 text-white/40 text-xs">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400/60" aria-hidden />
                <span>Accès immédiat au sanctuaire</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400/60" aria-hidden />
                <span>Paiement sécurisé Stripe</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400/60" aria-hidden />
                <span>Lecture livrée sous 24h</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400/60" aria-hidden />
                <span>Révisée par un expert humain</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
