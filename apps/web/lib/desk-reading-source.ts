import type { Order, UserProfile } from '@/components/desk-v2/types';

export type DeskReadingSourceKind = 'SEALED_INTAKE' | 'LEGACY_PROFILE';

export type DeskReadingSource = {
  source: DeskReadingSourceKind;
  sealedAt: string | null;
  profile: UserProfile | undefined;
};

type IntakeProfileField = Exclude<keyof UserProfile, 'id'>;

const SNAPSHOT_FIELDS: IntakeProfileField[] = [
  'birthDate',
  'birthTime',
  'birthPlace',
  'specificQuestion',
  'objective',
  'facePhotoUrl',
  'palmPhotoUrl',
  'highs',
  'lows',
  'fears',
  'rituals',
  'ailments',
  'deliveryStyle',
  'pace',
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Resolves the material shown to an expert. A valid sealed intake is immutable
 * order data, while legacy orders keep their historical profile fallback.
 */
export function resolveDeskReadingSource(
  order: Pick<Order, 'clientInputs' | 'user'>,
): DeskReadingSource {
  const intake = asRecord(asRecord(order.clientInputs).readingIntake);
  const sealedAt = nonEmptyString(intake.sealedAt);
  const snapshot = asRecord(intake.profile);

  if (sealedAt && nonEmptyString(snapshot.birthDate) && nonEmptyString(snapshot.birthPlace)) {
    const profile: UserProfile = {
      id: order.user.profile?.id || 'sealed-intake',
      ...order.user.profile,
    };

    for (const field of SNAPSHOT_FIELDS) {
      const value = snapshot[field];
      if (field === 'pace') {
        if (typeof value === 'number') profile.pace = value;
      } else if (value === null || value === undefined) {
        profile[field] = undefined;
      } else {
        profile[field] = nonEmptyString(value);
      }
    }

    return { source: 'SEALED_INTAKE', sealedAt, profile };
  }

  return { source: 'LEGACY_PROFILE', sealedAt: null, profile: order.user.profile };
}
