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
        title: 'Votre dossier vous attend',
        description:
          'Relisez, complétez ou retirez les éléments que vous souhaitez transmettre. Rien ne part avant votre scellement final.',
        actionLabel: 'Reprendre mon dossier',
      };
    }
    return {
      kind: 'PREPARE',
      title: 'Choisissez la base de votre lecture',
      description:
        'Vous décidez des informations, photos et éléments personnels transmis. Vous pourrez tout relire avant de sceller l’envoi.',
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
      description: 'Retrouvez votre lecture, son audio et son PDF dans votre espace.',
      order: latestOrder,
    };
  }

  if (latestOrder?.status === 'AWAITING_VALIDATION') {
    return {
      kind: 'EXPERT_REVIEW',
      title: 'Votre lecture est en vérification',
      description: 'Notre équipe relit et sécurise le contenu avant sa mise à disposition.',
      order: latestOrder,
    };
  }

  return {
    kind: 'PREPARING',
    title: 'Votre dossier a bien été transmis',
    description:
      'Les éléments que vous avez choisis sont maintenant utilisés pour préparer votre lecture. Nous vous écrirons dès qu’elle sera prête.',
    order: latestOrder,
  };
}
