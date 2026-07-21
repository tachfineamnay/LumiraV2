'use client';

import { useState, useEffect } from 'react';
import { Quote, Star } from 'lucide-react';

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Sophie M.',
    initials: 'SM',
    title: "Architecte d'Intérieur · Paris",
    rating: 5,
    text: "Une expérience d'une rare élégance. L'Oracle a su capter des fréquences de mon passé que je pensais oubliées. La justesse de l'analyse est troublante.",
    highlight: "La justesse de l'analyse est troublante.",
    date: 'Initiée le 12 Déc',
  },
  {
    id: 2,
    name: 'Jean-Pierre D.',
    initials: 'JP',
    title: 'Dirigeant Tech · Lyon',
    rating: 5,
    text: "Au-delà du mysticisme, il y a une mathématique implacable dans ces lectures. Un outil de connaissance de soi d'une puissance redoutable.",
    highlight: "Un outil de connaissance de soi d'une puissance redoutable.",
    date: 'Initié le 08 Déc',
  },
  {
    id: 3,
    name: 'Élodie L.',
    initials: 'ÉL',
    title: 'Artiste Sonore · Bordeaux',
    rating: 5,
    text: 'Les fréquences binaurales fournies avec la lecture sont devenues mon rituel quotidien. Une qualité de production sonore digne des plus grands studios.',
    highlight: 'Devenues mon rituel quotidien.',
    date: 'Initiée le 15 Déc',
  },
  {
    id: 4,
    name: 'Yasmine K.',
    initials: 'YK',
    title: 'Coach certifiée · Marseille',
    rating: 5,
    text: "J'ai pleuré en lisant mon PDF. Pas de tristesse — de reconnaissance. Quelque chose en moi se sentait enfin vu, nommé, compris.",
    highlight: 'Quelque chose en moi se sentait enfin vu, nommé, compris.',
    date: 'Initiée le 02 Jan',
  },
];

function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-[10px]' : 'w-14 h-14 text-sm';
  return (
    <div
      className={`${sizeClass} rounded-full ring-1 ring-white/10 bg-gradient-to-br from-amber-500/30 to-purple-500/20 flex items-center justify-center font-medium text-amber-100/90`}
      aria-hidden
    >
      {initials}
    </div>
  );
}

export function TestimonialsCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const t = TESTIMONIALS[current];

  return (
    <section
      id="temoignages"
      className="py-16 md:py-32 relative bg-void overflow-hidden content-visibility-auto"
    >
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-10 md:mb-20">
          <span className="text-white/20 text-[10px] uppercase tracking-[0.3em] font-bold block mb-6">
            Résonances
          </span>
          <h2 className="font-playfair italic text-3xl md:text-4xl lg:text-5xl text-white">
            Ils ont osé se regarder en face.
          </h2>
          <p className="text-white/35 text-base font-light mt-4 max-w-lg mx-auto">
            Voici ce qu&apos;ils ont trouvé.
          </p>
        </div>

        <div className="flex justify-center items-center gap-3 md:gap-4 mb-8 md:mb-16">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className="w-4 h-4 text-amber-400 fill-amber-400" aria-hidden />
            ))}
          </div>
          <span className="font-playfair italic text-2xl text-white">4.9</span>
          <span className="text-white/30 text-sm">· 2 500+ lectures réalisées</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div className="relative">
            <div key={t.id} className="motion-safe:animate-hero-enter">
              <Quote className="w-12 h-12 text-cosmic-gold opacity-25 mb-8" aria-hidden />

              <p className="font-playfair italic text-xl md:text-2xl lg:text-3xl text-amber-300/80 leading-snug mb-6">
                &ldquo;{t.highlight}&rdquo;
              </p>

              <p className="text-white/50 text-base font-light leading-relaxed mb-10">{t.text}</p>

              <div className="flex items-center gap-5">
                <Avatar initials={t.initials} />
                <div>
                  <div className="text-white font-playfair italic text-xl">{t.name}</div>
                  <div className="text-white/35 text-xs uppercase tracking-widest mt-1">
                    {t.title}
                  </div>
                  <div className="text-amber-400/40 text-[10px] uppercase tracking-widest mt-1">
                    {t.date}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-14" role="tablist" aria-label="Témoignages">
              {TESTIMONIALS.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={current === i}
                  aria-label={`Témoignage ${item.name}`}
                  onClick={() => setCurrent(i)}
                  className={`h-[2px] transition-all duration-500 ${
                    current === i ? 'w-16 bg-amber-400/80' : 'w-8 bg-white/10 hover:bg-white/25'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="hidden lg:flex flex-col gap-5">
            {TESTIMONIALS.filter((_, i) => i !== current)
              .slice(0, 3)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrent(TESTIMONIALS.indexOf(item))}
                  className="text-left p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar initials={item.initials} size="sm" />
                    <div>
                      <span className="text-white/70 text-sm font-medium">{item.name}</span>
                      <span className="text-white/25 text-xs ml-2">
                        · {item.title.split(' · ')[0]}
                      </span>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className="w-3 h-3 text-amber-400/50 fill-amber-400/50"
                          aria-hidden
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-white/40 text-sm font-light leading-relaxed line-clamp-2 group-hover:text-white/60 transition-colors duration-300">
                    &ldquo;{item.text}&rdquo;
                  </p>
                </button>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
