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
 * The home view has one source of truth for wording and transitions. A reading
 * cannot be shown as in preparation until the client has completed their final
 * validation; order data remains server-owned.
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
        title: 'Votre préparation vous attend',
        description: 'Prenez votre temps. Vos éléments sont enregistrés automatiquement.',
        actionLabel: 'Reprendre ma préparation',
      };
    }
    return {
      kind: 'PREPARE',
      title: 'Préparez votre première lecture',
      description: 'Prenez le temps nécessaire. Votre progression est enregistrée automatiquement.',
      actionLabel: 'Préparer ma lecture',
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
      description: 'Notre équipe vérifie les éléments avant leur mise à disposition.',
      order: latestOrder,
    };
  }

  // This is based on the server-side profile validation. An order can be
  // temporarily absent while its fulfilment record is being synchronized; do
  // not manufacture an order client-side just to render this state.
  return {
    kind: 'PREPARING',
    title: 'Votre lecture est en préparation',
    description: 'Vous n’avez plus rien à faire. Nous vous écrirons dès qu’elle sera prête.',
    order: latestOrder,
  };
}
