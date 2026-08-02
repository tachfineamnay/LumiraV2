const TRANSFORMATIONS = [
  {
    emoji: '🌙',
    before: 'Je me sens perdue, tiraillée entre mille directions sans savoir laquelle prendre.',
    after:
      'J\'ai compris que ma "dispersion" était en réalité ma plus grande force : je suis née pour explorer, pas pour me fixer.',
    name: 'Camille, 31 ans',
    domain: 'Chemin de vie 3 · Ascendant Gémeaux',
  },
  {
    emoji: '🔥',
    before: "Je donne tout dans mes relations mais je reste toujours l'oubliée, celle qui attend.",
    after:
      "La lecture a révélé mon schéma de don excessif. Aujourd'hui j'attire des personnes qui me voient vraiment.",
    name: 'Yasmine, 28 ans',
    domain: 'Venus en maison 12 · Nœud Nord Balance',
  },
  {
    emoji: '⚡',
    before: "J'ai peur de mes propres ambitions. Comme si je n'avais pas le droit de vouloir plus.",
    after:
      "L'Oracle a identifié une blessure de légitimité profonde. Depuis, j'ai lancé mon entreprise.",
    name: 'David, 36 ans',
    domain: 'Soleil en maison 10 · Saturne rétrograde',
  },
];

export function BeforeAfterSection() {
  return (
    <section className="py-16 md:py-32 relative overflow-hidden content-visibility-auto">
      <div className="absolute left-0 top-1/3 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="mb-20">
          <span className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-bold block mb-4">
            Ce que nos initiés vivent
          </span>
          <h2 className="font-playfair italic text-4xl md:text-5xl lg:text-7xl text-white">
            Avant. <span className="text-cosmic-gold opacity-70">Après.</span>
          </h2>
          <p className="text-white/40 mt-6 max-w-lg text-base font-light leading-relaxed">
            Une lecture Lumira ne donne pas des réponses génériques. Elle met des mots précis sur ce
            que vous vivez — et ouvre le chemin vers ce que vous désirez vraiment.
          </p>
        </div>

        <div className="space-y-6">
          {TRANSFORMATIONS.map((item) => (
            <div
              key={item.name}
              className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-[2rem] overflow-hidden border border-white/5 group hover:border-amber-500/15 transition-colors duration-500"
            >
              <div className="p-6 sm:p-10 md:p-14 relative">
                <div className="absolute top-8 right-8 text-white/5 text-6xl font-playfair select-none group-hover:text-white/8 transition-colors duration-500">
                  Avant
                </div>
                <span className="text-white/20 text-[10px] uppercase tracking-[0.3em] font-bold block mb-6">
                  Avant la lecture
                </span>
                <p className="font-playfair italic text-xl md:text-2xl text-white/70 leading-relaxed">
                  &ldquo;{item.before}&rdquo;
                </p>
              </div>

              <div className="bg-gradient-to-br from-amber-500/[0.06] to-purple-900/[0.06] p-6 sm:p-10 md:p-14 relative border-t md:border-t-0 md:border-l border-amber-500/10">
                <div className="absolute top-8 right-8 text-amber-500/5 text-6xl font-playfair select-none group-hover:text-amber-500/10 transition-colors duration-500">
                  Après
                </div>
                <span className="text-amber-400/60 text-[10px] uppercase tracking-[0.3em] font-bold block mb-6">
                  Après la révélation
                </span>
                <p className="font-playfair italic text-xl md:text-2xl text-white leading-relaxed">
                  &ldquo;{item.after}&rdquo;
                </p>
                <div className="mt-8 flex items-center gap-4">
                  <span className="text-2xl" aria-hidden>
                    {item.emoji}
                  </span>
                  <div>
                    <div className="text-white/80 text-sm font-medium">{item.name}</div>
                    <div className="text-white/30 text-xs mt-1 uppercase tracking-widest">
                      {item.domain}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
