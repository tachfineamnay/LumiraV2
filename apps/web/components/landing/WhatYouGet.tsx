import { BookOpen, Headphones, Shield, FileText, UserCheck, Landmark } from 'lucide-react';
import { SUBSCRIPTION } from '../../lib/products';

const DELIVERABLES = [
  {
    icon: Shield,
    title: 'Dossier client sécurisé',
    subtitle: 'Privé · Lié à votre compte',
    description:
      'Vos informations et médias restent dans un espace protégé. Aucune ressource privée n’est accessible par identifiant seul.',
    highlight: 'Confidentialité par conception',
    color: 'from-amber-500/10 to-transparent',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: BookOpen,
    title: 'Lecture personnalisée',
    subtitle: 'Interprétative · Sur-mesure',
    description:
      'Une lecture construite à partir de votre dossier scellé. Contenu d’accompagnement — jamais une promesse médicale ou une prédiction certaine.',
    highlight: 'Basée sur votre dossier',
    color: 'from-amber-500/10 to-transparent',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: UserCheck,
    title: 'Révision par un expert humain',
    subtitle: 'Validation avant livraison',
    description:
      'Un expert relit et valide le contenu avant que vos livrables ne soient mis à disposition dans le Sanctuaire.',
    highlight: 'Contrôle humain obligatoire',
    color: 'from-teal-500/10 to-transparent',
    border: 'border-teal-500/20',
    iconColor: 'text-teal-400',
  },
  {
    icon: FileText,
    title: 'PDF privé',
    subtitle: 'Lecture écrite · Espace sécurisé',
    description:
      'Votre lecture écrite, accessible uniquement depuis votre Sanctuaire après validation.',
    highlight: `Sous ${SUBSCRIPTION.deliveryLabel.includes('24') ? '24 à 48h' : 'délai annoncé'} après scellement`,
    color: 'from-amber-500/10 to-transparent',
    border: 'border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: Headphones,
    title: 'Narration audio privée',
    subtitle: 'Version audio · Privée',
    description:
      'Écoutez votre lecture dans votre espace privé. Le fichier audio reste réservé à votre compte.',
    highlight: 'Inclus avec la lecture',
    color: 'from-purple-500/10 to-transparent',
    border: 'border-purple-500/20',
    iconColor: 'text-purple-400',
  },
  {
    icon: Landmark,
    title: 'Accès au Sanctuaire',
    subtitle: `Early · ${SUBSCRIPTION.accessDurationMonths} mois`,
    description:
      'Paiement unique : accès au Sanctuaire pendant 3 mois pour les early adopters — sans abonnement mensuel ni renouvellement automatique.',
    highlight: SUBSCRIPTION.accessLabel,
    color: 'from-indigo-500/10 to-transparent',
    border: 'border-indigo-500/20',
    iconColor: 'text-indigo-400',
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
              Les 6 livrables{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                de l&apos;offre early.
              </span>
            </h2>
            <p className="text-white/40 max-w-sm text-base font-light leading-relaxed">
              Pas de mandala, pas de chat illimité, pas de journal des rêves dans la V1. Une lecture
              complète, révisée, livrée — avec 3 mois d&apos;accès Sanctuaire.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {DELIVERABLES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`relative p-6 md:p-8 rounded-[1.5rem] border ${item.border} bg-gradient-to-b ${item.color} overflow-hidden`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center ${item.iconColor}`}
                  >
                    <Icon className="w-5 h-5" aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-base">{item.title}</h3>
                    <p className="text-white/35 text-xs">{item.subtitle}</p>
                  </div>
                </div>
                <p className="text-white/50 text-sm font-light leading-relaxed mb-4">
                  {item.description}
                </p>
                <p className={`text-xs font-medium ${item.iconColor}`}>{item.highlight}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 md:mt-16 p-6 md:p-10 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 bg-white/[0.02] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-white/60 text-sm uppercase tracking-widest font-bold mb-2">
              Offre early
            </p>
            <div className="flex items-baseline gap-3">
              <span className="font-playfair italic text-5xl text-white">
                {SUBSCRIPTION.price}€
              </span>
              <span className="text-amber-400 text-sm font-bold uppercase tracking-widest">
                early · {SUBSCRIPTION.accessDurationMonths} mois
              </span>
            </div>
            <p className="text-white/30 text-xs mt-2">Paiement unique · Aucun renouvellement</p>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-sm font-light max-w-sm leading-relaxed">
              {SUBSCRIPTION.deliveryLabel}. Accès Sanctuaire limité à{' '}
              {SUBSCRIPTION.accessDurationMonths} mois pour cette cohorte early.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
