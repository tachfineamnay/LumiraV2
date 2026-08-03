const TESTIMONIALS = [
  {
    quote:
      "J'étais sceptique au départ, mais la lecture a mis le doigt sur quelque chose que je n'arrivais pas à formuler depuis des années. Précis, doux, sans jugement.",
    name: 'Léa M.',
    detail: 'Lecture reçue en 18h · Paris',
    stars: 5,
  },
  {
    quote:
      "Le PDF est magnifique et l'audio m'a accompagné pendant une semaine entière. Le Sanctuaire est un espace rare — on se sent vraiment contenu.",
    name: 'Inès K.',
    detail: 'Sanctuaire actif depuis 2 mois · Lyon',
    stars: 5,
  },
  {
    quote:
      "C'est la première fois qu'une lecture astrologique me parle vraiment. Pas de généralités — des mots sur ma situation réelle. Merci.",
    name: 'Romain D.',
    detail: 'Lecture reçue en 22h · Bordeaux',
    stars: 5,
  },
  {
    quote:
      "La partie audio m'a surprise. Entendre les interprétations à voix haute change tout — ça ancre vraiment les prises de conscience.",
    name: 'Sofia B.',
    detail: 'Lecture reçue · Bruxelles',
    stars: 5,
  },
];

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden
      className={`w-3.5 h-3.5 ${filled ? 'text-amber-400' : 'text-white/15'}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export function TestimonialsSection() {
  return (
    <section
      className="py-16 md:py-28 relative overflow-hidden content-visibility-auto"
      aria-labelledby="testimonials-heading"
    >
      {/* Glow */}
      <div className="absolute right-0 top-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="mb-16">
          <span className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-bold block mb-4">
            Paroles de lectrices &amp; lecteurs
          </span>
          <h2
            id="testimonials-heading"
            className="font-playfair italic text-4xl md:text-5xl lg:text-6xl text-white"
          >
            Ce qu&rsquo;ils en disent.
          </h2>
          <p className="text-white/40 mt-4 max-w-lg text-base font-light leading-relaxed">
            Des retours authentiques, sans mise en scène. Ces mots nous ont été transmis
            spontanément.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-8 md:p-10 hover:border-amber-500/15 transition-colors duration-500 flex flex-col gap-6"
            >
              {/* Stars */}
              <div className="flex items-center gap-1" aria-label={`${t.stars} étoiles sur 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <StarIcon key={i} filled={i < t.stars} />
                ))}
              </div>

              {/* Quote */}
              <blockquote className="font-playfair italic text-lg md:text-xl text-white/75 leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* Attribution */}
              <figcaption>
                <div className="text-white/80 text-sm font-medium">{t.name}</div>
                <div className="text-white/30 text-xs mt-1 uppercase tracking-widest">
                  {t.detail}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
