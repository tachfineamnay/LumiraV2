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
  intakeRequired?: boolean;
  intakeStatus?: 'DRAFT' | 'SEALED' | null;
  intakeSealedAt?: string | null;
}

export interface SanctuaireHomeProfile {
  profileCompleted: boolean;
}

export interface SanctuaireHomeDraft {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  currentStep: number;
  orderId?: string;
}

export type SanctuaireHomeState =
  | { kind: 'PREPARE'; title: string; description: string; actionLabel: string }
  | { kind: 'RESUME'; title: string; description: string; actionLabel: string }
  | { kind: 'PREPARING'; title: string; description: string; order?: SanctuaireHomeOrder }
  | { kind: 'EXPERT_REVIEW'; title: string; description: string; order: SanctuaireHomeOrder }
  | { kind: 'READY'; title: string; description: string; order: SanctuaireHomeOrder };

/**
 * The onboarding endpoint returns the server-selected order scope. Keep that
 * identity when rendering the home and dossier views: picking a newer order
 * locally can make a valid draft look empty or merge two readings.
 */
export function resolveSanctuaireActiveOrder({
  draft,
  orders,
}: {
  draft: SanctuaireHomeDraft | null;
  orders: SanctuaireHomeOrder[];
}): SanctuaireHomeOrder | undefined {
  const scopedOrder = draft?.orderId ? orders.find((order) => order.id === draft.orderId) : null;
  if (scopedOrder) return scopedOrder;
  return [...orders].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )[0];
}

/**
 * One source of truth for the client-facing reading lifecycle. Before the
 * profile is sealed, wording reinforces agency: the client chooses, reviews
 * and explicitly transmits the information used for the reading.
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
  const activeOrder = resolveSanctuaireActiveOrder({ draft, orders });
  const draftMatchesActiveOrder = activeOrder?.intakeRequired
    ? Boolean(draft?.orderId && activeOrder.id && draft.orderId === activeOrder.id)
    : !draft?.orderId || !activeOrder?.id || draft.orderId === activeOrder.id;
  const activeIntakeIsSealed = Boolean(
    activeOrder?.intakeStatus === 'SEALED' ||
    activeOrder?.intakeSealedAt ||
    (draftMatchesActiveOrder && draft?.status === 'COMPLETED'),
  );
  const needsOrderIntake = Boolean(activeOrder?.intakeRequired && !activeIntakeIsSealed);

  if (!profile?.profileCompleted || needsOrderIntake) {
    if (draftMatchesActiveOrder && draft?.status === 'IN_PROGRESS') {
      return {
        kind: 'RESUME',
        title: 'Votre brouillon est prêt à être repris',
        description:
          'Vos informations restent privées et modifiables. Relisez, complétez ou retirez ce que vous souhaitez avant de sceller votre dossier.',
        actionLabel: 'Reprendre mon dossier',
      };
    }
    return {
      kind: 'PREPARE',
      title: 'Préparez la base de votre lecture',
      description:
        'Quelques minutes suffisent. Vous choisissez ce que vous transmettez, puis vous relisez chaque élément avant le scellement final.',
      actionLabel: 'Préparer mon dossier',
    };
  }

  if (activeOrder?.status === 'COMPLETED') {
    return {
      kind: 'READY',
      title: 'Votre lecture est prête',
      description:
        'Commencez par l’écouter ou la lire à votre rythme. Votre synthèse vous permet ensuite de retrouver rapidement les repères essentiels.',
      order: activeOrder,
    };
  }

  if (activeOrder?.status === 'AWAITING_VALIDATION') {
    return {
      kind: 'EXPERT_REVIEW',
      title: 'Votre lecture est relue par l’équipe',
      description:
        'La préparation est terminée. Une dernière vérification humaine est en cours avant la mise à disposition du PDF et de l’audio.',
      order: activeOrder,
    };
  }

  return {
    kind: 'PREPARING',
    title: 'Votre dossier a bien été reçu',
    description:
      'Vous n’avez plus rien à faire. Le délai habituel est de 24 à 48 heures et nous vous écrirons dès que votre lecture aura été relue et validée.',
    order: activeOrder,
  };
}
