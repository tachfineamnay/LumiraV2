import { BookOpen, Headphones, Palette, MessageCircle, Moon, Compass } from 'lucide-react';

const DELIVERABLES = [
  {
    icon: BookOpen,
    title: 'Votre PDF Personnalisé',
    subtitle: '20–30 pages · Révisé par un expert',
    description:
      'Une analyse complète de votre empreinte vibratoire. 8 domaines de vie — amour, argent, vocation, santé, famille, karma, ombre, potentiel — décryptés avec une précision qui va vous couper le souffle.',
    highlight: 'Reçu sous 24h après votre commande',
    color: 'from-amber-500/10 to-transparent',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
    badge: '📄',
  },
  {
    icon: Headphones,
    title: 'Narration Audio Immersive',
    subtitle: 'Voix méditative · 432 Hz binaural',
    description:
      'Écoutez votre lecture en état de réceptivité maximale. Chaque insight est narré sur des fréquences sonores qui ouvrent votre conscience — les mêmes utilisées dans les monastères tibétains.',
    highlight: 'Inclus avec chaque lecture',
    color: 'from-purple-500/10 to-transparent',
    border: 'border-purple-500/20',
    iconColor: 'text-purple-400',
    badge: '🎧',
  },
  {
    icon: Palette,
    title: 'Mandala Vibratoire HD',
    subtitle: 'Œuvre unique · Générée à partir de vous',
    description:
      'Une création artistique sacrée basée sur votre date, heure et lieu de naissance. Chaque courbe, chaque symbole reflète votre essence. Unique, imprimable, à encadrer.',
    highlight: 'Votre signature vibratoire en image',
    color: 'from-teal-500/10 to-transparent',
    border: 'border-teal-500/20',
    iconColor: 'text-teal-400',
    badge: '🎨',
  },
  {
    icon: MessageCircle,
    title: 'Chat Illimité avec Lumira',
    subtitle: 'Oracle IA · Mémoire de votre parcours',
    description:
      "Posez toutes vos questions. Lumira se souvient de votre lecture, de vos enjeux, de vos progrès. Ce n'est pas un chatbot générique — c'est votre guide personnel qui vous connaît vraiment.",
    highlight: 'Disponible 24h/24, 7j/7',
    color: 'from-amber-500/10 to-transparent',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
    badge: '💬',
  },
  {
    icon: Compass,
    title: 'Parcours Spirituel 30 Jours',
    subtitle: 'Rituels · Méditations · Exercices quotidiens',
    description:
      'Un programme sur-mesure basé sur vos révélations. Chaque jour, un rituel, une méditation guidée ou un exercice de conscience calibré à votre profil vibratoire unique.',
    highlight: 'Un chemin, pas juste une lecture',
    color: 'from-rose-500/10 to-transparent',
    border: 'border-rose-500/20',
    iconColor: 'text-rose-400',
    badge: '🧭',
  },
  {
    icon: Moon,
    title: 'Journal des Rêves',
    subtitle: 'Symbolisme onirique · Interprétation IA',
    description:
      "Notez vos rêves au réveil et recevez en secondes une interprétation symbolique profonde, connectée à votre profil astral. Les rêves sont le langage de votre inconscient — Lumira vous aide à l'entendre.",
    highlight: 'Votre inconscient parle. Écoutez-le.',
    color: 'from-indigo-500/10 to-transparent',
    border: 'border-indigo-500/20',
    iconColor: 'text-indigo-400',
    badge: '🌙',
  },
];

export function WhatYouGet() {
  return (
    <section className="py-16 md:py-32 relative overflow-hidden content-visibility-auto">
      <div className="absolute right-0 top-1/4 w-[700px] h-[700px] bg-amber-900/8 rounded-full blur-[180px] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="mb-20">
          <span className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-bold block mb-4">
            Ce que vous recevez exactement
          </span>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <h2 className="font-playfair italic text-4xl md:text-5xl lg:text-7xl text-white max-w-2xl leading-tight">
              Tout ce dont vous avez{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                toujours eu besoin.
              </span>
            </h2>
            <p className="text-white/40 max-w-sm text-base font-light leading-relaxed">
              Pas un horoscope. Pas des généralités. Un miroir précis de qui vous êtes — et un GPS
              vers qui vous pouvez devenir.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DELIVERABLES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`relative rounded-[1.5rem] md:rounded-[2rem] border ${item.border} bg-gradient-to-br ${item.color} p-6 md:p-10 group hover:scale-[1.02] transition-transform duration-500`}
              >
                <div className="absolute top-8 right-8 text-4xl select-none opacity-40 group-hover:opacity-70 transition-opacity duration-500">
                  {item.badge}
                </div>

                <div
                  className={`w-12 h-12 rounded-xl border ${item.border} flex items-center justify-center mb-6`}
                >
                  <Icon className={`w-5 h-5 ${item.iconColor}`} aria-hidden />
                </div>

                <h3 className="font-playfair italic text-2xl text-white mb-1">{item.title}</h3>
                <p
                  className={`text-[11px] uppercase tracking-widest ${item.iconColor} opacity-70 mb-5`}
                >
                  {item.subtitle}
                </p>
                <p className="text-white/55 text-sm leading-relaxed font-light">
                  {item.description}
                </p>

                <div
                  className={`mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full border ${item.border} bg-white/[0.02]`}
                >
                  <span
                    className={`text-[10px] uppercase tracking-widest ${item.iconColor} opacity-80 font-bold`}
                  >
                    {item.highlight}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 md:mt-16 p-6 md:p-10 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 bg-white/[0.02] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-white/60 text-sm uppercase tracking-widest font-bold mb-2">
              Valeur totale estimée
            </p>
            <div className="flex items-baseline gap-3">
              <span className="font-playfair italic text-4xl text-white/30 line-through">197€</span>
              <span className="font-playfair italic text-5xl text-white">29€</span>
              <span className="text-amber-400 text-sm font-bold uppercase tracking-widest">
                accès à vie
              </span>
            </div>
            <p className="text-white/30 text-xs mt-2">Paiement unique · Aucun renouvellement</p>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-sm font-light max-w-sm leading-relaxed">
              Nous aurions pu vendre chaque livrable séparément. Nous avons choisi de tout inclure —
              parce que vous méritez l&apos;expérience complète.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
