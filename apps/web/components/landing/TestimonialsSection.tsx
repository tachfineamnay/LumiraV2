import { Quote, Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    quote:
      "J’ai pleuré en lisant mon PDF. Pas de tristesse — de reconnaissance. Quelque chose en moi se sentait enfin vu, nommé, compris.",
    author: 'Retour anonymisé 01',
  },
  {
    quote:
      "Au-delà du mysticisme, il y a une mathématique implacable dans ces lectures. Un outil de connaissance de soi d’une puissance redoutable.",
    author: 'Retour anonymisé 02',
  },
  {
    quote:
      "Une expérience d’une rare élégance. L’Oracle a su capter des fréquences de mon passé que je pensais oubliées. La justesse de l’analyse est troublante.",
    author: 'Retour anonymisé 03',
  },
] as const;

export function TestimonialsSection() {
  const [featured, ...secondary] = TESTIMONIALS;

  return (
    <section
      id="temoignages"
      className="relative z-10 scroll-mt-32 overflow-hidden bg-void py-16 md:scroll-mt-36 md:py-32"
      aria-labelledby="testimonials-title"
      data-landing-section
      data-landing-proof-section="testimonials"
    >
      <div
        className="pointer-events-none absolute left-1/4 top-1/2 h-[600px] w-[600px] -translate-y-1/2 rounded-full bg-purple-900/10 blur-[150px]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center md:mb-20">
          <span className="mb-6 block text-[10px] font-bold uppercase tracking-[0.3em] text-white/20">
            Résonances
          </span>
          <h2
            id="testimonials-title"
            className="font-playfair text-3xl italic text-white md:text-4xl lg:text-5xl"
          >
            Ils ont osé se regarder en face.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm font-light leading-relaxed text-white/35 md:text-base">
            Extraits anonymisés de retours publiés précédemment, sans photo ni donnée personnelle.
          </p>
        </div>

        <div className="mb-10 flex items-center justify-center gap-3 text-white/35 md:mb-16">
          <div className="flex gap-1" aria-label="Avis très positifs">
            {[1, 2, 3, 4, 5].map((value) => (
              <Star
                key={value}
                className="h-4 w-4 fill-amber-400 text-amber-400"
                aria-hidden
              />
            ))}
          </div>
          <span className="text-xs uppercase tracking-[0.18em]">Retours anonymisés</span>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14">
          <article className="relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-[2rem] border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.07] via-white/[0.02] to-purple-900/[0.08] p-8 md:p-12">
            <Quote className="h-12 w-12 text-cosmic-gold/30" aria-hidden />
            <blockquote className="my-10 font-playfair text-2xl italic leading-snug text-amber-100/90 md:text-3xl lg:text-4xl">
              « {featured.quote} »
            </blockquote>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
              {featured.author}
            </p>
          </article>

          <div className="flex flex-col gap-4 md:gap-5">
            {secondary.map((item, index) => (
              <article
                key={item.author}
                className="group flex-1 rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] md:p-7"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cosmic-gold/50">
                    Résonance {String(index + 2).padStart(2, '0')}
                  </span>
                  <Quote className="h-4 w-4 text-white/15" aria-hidden />
                </div>
                <blockquote className="font-playfair text-lg italic leading-relaxed text-white/65 transition-colors group-hover:text-white/80 md:text-xl">
                  « {item.quote} »
                </blockquote>
                <p className="mt-5 text-[10px] uppercase tracking-[0.18em] text-white/25">
                  {item.author}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
