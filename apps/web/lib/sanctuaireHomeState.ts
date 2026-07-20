export type ReadingOrderStatus =
  | 'PAID'
  | 'PROCESSING'
  | 'AWAITING_VALIDATION'
  | 'COMPLETED'
  | string;

export interface SanctuaireHomeOrder {
  id: string;
  orderNumber: string;
  status: ReadingOrderStatus;
  deliveredAt: string | null;
  createdAt: string;
}

export interface SanctuaireHomeProfile {
  profileCompleted: boolean;
}

export interface SanctuaireHomeDraft {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  currentStep: number;
}

export type SanctuaireHomeState =
  | { kind: 'PREPARE'; title: string; description: string; actionLabel: string }
  | { kind: 'RESUME'; title: string; description: string; actionLabel: string }
  | { kind: 'PREPARING'; title: string; description: string; order?: SanctuaireHomeOrder }
  | { kind: 'EXPERT_REVIEW'; title: string; description: string; order: SanctuaireHomeOrder }
  | { kind: 'READY'; title: string; description: string; order: SanctuaireHomeOrder };

/**
 * One source of truth for the client-facing reading lifecycle. Before the
 * profile is sealed, wording must reinforce agency: the client chooses,
 * reviews and explicitly transmits the information used for the base reading.
 */
export function resolveSanctuaireHomeState({
  profile,
  draft,
  orders,
}: {
  profile: SanctuaireHomeProfile | null;
  draft: SanctuaireHomeDraft | null;
  orders: SanctuaireHomeOrder[];
}): SanctuaireHomeState {
  if (!profile?.profileCompleted) {
    if (draft?.status === 'IN_PROGRESS') {
      return {
        kind: 'RESUME',
        title: 'Votre brouillon est prêt à être repris',
        description:
          'Votre brouillon privé est sauvegardé automatiquement. Relisez, complétez ou retirez ce que vous souhaitez transmettre ; il ne sera envoyé à la production qu’après votre confirmation finale.',
        actionLabel: 'Continuer mon dossier',
      };
    }
    return {
      kind: 'PREPARE',
      title: 'Préparez la base de votre lecture',
      description:
        'Comptez quelques minutes pour renseigner vos repères et, si vous le souhaitez, votre intention et vos photos. Vous relirez tout avant la transmission.',
      actionLabel: 'Préparer mon dossier',
    };
  }

  const latestOrder = [...orders].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )[0];

  if (latestOrder?.status === 'COMPLETED') {
    return {
      kind: 'READY',
      title: 'Votre lecture est prête',
      description:
        'Prenez le temps de l’écouter ou de la lire. Votre synthèse reste disponible pour retrouver l’essentiel.',
      order: latestOrder,
    };
  }

  if (latestOrder?.status === 'AWAITING_VALIDATION') {
    return {
      kind: 'EXPERT_REVIEW',
      title: 'Votre lecture est relue par l’équipe',
      description: 'Une dernière vérification humaine est en cours avant sa mise à disposition.',
      order: latestOrder,
    };
  }

  return {
    kind: 'PREPARING',
    title: 'Votre dossier a bien été reçu',
    description:
      'L’équipe Lumira prépare votre lecture à partir des éléments que vous avez confirmés. Vous n’avez plus rien à faire ; nous vous écrirons dès qu’elle sera prête.',
    order: latestOrder,
  };
}
