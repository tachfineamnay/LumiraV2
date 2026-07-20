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
  const latestOrder = [...orders].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )[0];
  const draftMatchesLatestOrder = latestOrder?.intakeRequired
    ? Boolean(draft?.orderId && latestOrder.id && draft.orderId === latestOrder.id)
    : !draft?.orderId || !latestOrder?.id || draft.orderId === latestOrder.id;
  const latestIntakeIsSealed = Boolean(
    latestOrder?.intakeStatus === 'SEALED' ||
    latestOrder?.intakeSealedAt ||
    (draftMatchesLatestOrder && draft?.status === 'COMPLETED'),
  );
  const needsOrderIntake = Boolean(latestOrder?.intakeRequired && !latestIntakeIsSealed);

  if (!profile?.profileCompleted || needsOrderIntake) {
    if (draftMatchesLatestOrder && draft?.status === 'IN_PROGRESS') {
      return {
        kind: 'RESUME',
        title: 'Votre brouillon est prêt à être repris',
        description:
          'Votre brouillon privé reste disponible, même si vous revenez demain ou plus tard. Relisez, complétez ou retirez ce que vous souhaitez transmettre avant de le sceller.',
        actionLabel: 'Reprendre mon dossier',
      };
    }
    return {
      kind: 'PREPARE',
      title: 'Préparez la base de votre lecture',
      description:
        'Quelques minutes suffisent pour partager vos repères et ce qui compte pour vous. Tout reste privé, modifiable et reprenable jusqu’à votre scellement final.',
      actionLabel: 'Préparer mon dossier',
    };
  }

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
