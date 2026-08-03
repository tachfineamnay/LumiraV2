const PERSPECTIVES = [
  {
    before: 'Je me sens perdue, tiraillée entre plusieurs directions sans savoir laquelle choisir.',
    after:
      'La lecture propose une grille pour distinguer ce qui relève d’un besoin d’exploration, d’une hésitation ou d’une priorité réelle.',
  },
  {
    before: 'Je donne beaucoup dans mes relations, mais j’ai souvent l’impression de rester en retrait.',
    after:
      'La mise en perspective aide à observer les habitudes relationnelles et les limites qui méritent d’être reformulées.',
  },
  {
    before: 'Mes ambitions m’attirent autant qu’elles m’intimident, comme si je n’étais pas encore légitime.',
    after:
      'La lecture offre des repères symboliques pour nommer cette tension et réfléchir à une prochaine étape concrète.',
  },
] as const;

export function BeforeAfterSection() {
  return (
    <section
      id="avant-apres"
      className="relative z-10 overflow-hidden bg-cosmic-void py-16 md:py-32"
      aria-labelledby="before-after-title"
      data-landing-proof-section="before-after"
    >
      <div
        className="pointer-events-none absolute left-0 top-1/3 h-[600px] w-[600px] rounded-full bg-purple-900/10 blur-[150px]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 md:px-12">
        <div className="mb-14 max-w-2xl md:mb-20">
          <span className="mb-4 block text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
            Situations illustratives
          </span>
          <h2
            id="before-after-title"
            className="font-playfair text-4xl italic text-white md:text-5xl lg:text-7xl"
          >
            Avant. <span className="text-cosmic-gold/70">Après.</span>
          </h2>
          <p className="mt-6 max-w-xl text-base font-light leading-relaxed text-white/45">
            Une lecture interprétative ne promet pas une transformation automatique. Elle peut
            offrir des mots, des angles de lecture et des repères pour regarder une situation
            autrement.
          </p>
        </div>

        <div className="space-y-5 md:space-y-6">
          {PERSPECTIVES.map((item, index) => (
            <article
              key={item.before}
              className="group grid grid-cols-1 overflow-hidden rounded-[1.75rem] border border-white/5 transition-colors duration-500 hover:border-amber-500/15 md:grid-cols-2 md:rounded-[2rem]"
            >
              <div className="relative p-6 sm:p-10 md:p-14">
                <span
                  className="pointer-events-none absolute right-8 top-6 select-none font-playfair text-5xl text-white/[0.04] md:top-8 md:text-6xl"
                  aria-hidden
                >
                  Avant
                </span>
                <span className="mb-6 block text-[10px] font-bold uppercase tracking-[0.3em] text-white/25">
                  Situation {String(index + 1).padStart(2, '0')}
                </span>
                <p className="relative font-playfair text-xl italic leading-relaxed text-white/70 md:text-2xl">
                  « {item.before} »
                </p>
              </div>

              <div className="relative border-t border-amber-500/10 bg-gradient-to-br from-amber-500/[0.06] to-purple-900/[0.06] p-6 sm:p-10 md:border-l md:border-t-0 md:p-14">
                <span
                  className="pointer-events-none absolute right-8 top-6 select-none font-playfair text-5xl text-amber-500/[0.06] md:top-8 md:text-6xl"
                  aria-hidden
                >
                  Après
                </span>
                <span className="mb-6 block text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400/60">
                  Mise en perspective
                </span>
                <p className="relative font-playfair text-xl italic leading-relaxed text-white md:text-2xl">
                  {item.after}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
