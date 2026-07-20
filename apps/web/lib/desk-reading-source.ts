import type { Order, UserProfile } from '@/components/desk-v2/types';

export type DeskReadingSourceKind =
  | 'SEALED_INTAKE'
  | 'LEGACY_PROFILE'
  | 'WAITING_CLIENT'
  | 'INVALID_INTAKE';

export type DeskReadingSource = {
  source: DeskReadingSourceKind;
  intakeRequired: boolean;
  readyForProduction: boolean;
  sealedAt: string | null;
  contentHash: string | null;
  reason: string | null;
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
  'strongSide',
  'weakSide',
  'strongZone',
  'weakZone',
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function snapshotProfile(value: unknown, fallbackId: string): UserProfile | undefined {
  const snapshot = asRecord(value);
  if (Object.keys(snapshot).length === 0) return undefined;

  const profile: UserProfile = { id: fallbackId };
  for (const field of SNAPSHOT_FIELDS) {
    let fieldValue = snapshot[field];
    if (field === 'facePhotoUrl') fieldValue = snapshot.facePhoto ?? fieldValue;
    if (field === 'palmPhotoUrl') fieldValue = snapshot.palmPhoto ?? fieldValue;

    if (field === 'pace') {
      if (typeof fieldValue === 'number' && Number.isFinite(fieldValue)) {
        profile.pace = fieldValue;
      }
    } else {
      profile[field] = nonEmptyString(fieldValue);
    }
  }
  return profile;
}

function isUsableSnapshot(profile: UserProfile | undefined): boolean {
  return Boolean(profile?.birthDate && profile?.birthPlace);
}

/**
 * Resolves the material shown to an expert. A valid sealed intake is immutable
 * order data, while legacy orders keep their historical profile fallback.
 */
export function resolveDeskReadingSource(
  order: Pick<Order, 'clientInputs' | 'intakeRequired' | 'readingIntake' | 'user'>,
): DeskReadingSource {
  const required = order.intakeRequired === true;
  const relational = asRecord(order.readingIntake);
  const relationalStatus = nonEmptyString(relational.status);
  const relationalSealedAt = nonEmptyString(relational.sealedAt) || null;
  const relationalHash = nonEmptyString(relational.contentHash) || null;
  const relationalProfile = snapshotProfile(
    relational.data,
    order.user.profile?.id || 'sealed-intake',
  );

  const validRelational = Boolean(
    relationalStatus === 'SEALED' &&
    relationalSealedAt &&
    relationalHash &&
    isUsableSnapshot(relationalProfile),
  );
  if (validRelational) {
    return {
      source: 'SEALED_INTAKE',
      intakeRequired: required,
      readyForProduction: true,
      sealedAt: relationalSealedAt,
      contentHash: relationalHash,
      reason: null,
      profile: relationalProfile,
    };
  }

  if (required) {
    const invalid = relationalStatus === 'SEALED';
    return {
      source: invalid ? 'INVALID_INTAKE' : 'WAITING_CLIENT',
      intakeRequired: true,
      readyForProduction: false,
      sealedAt: relationalSealedAt,
      contentHash: relationalHash,
      reason: invalid
        ? 'Le dossier scellé est incomplet ou son empreinte est absente.'
        : 'Le client doit encore finaliser et sceller son dossier.',
      profile: relationalProfile,
    };
  }

  // Historical snapshots live under clientInputs.readingIntake.profile.
  const legacyIntake = asRecord(asRecord(order.clientInputs).readingIntake);
  const legacySealedAt = nonEmptyString(legacyIntake.sealedAt) || null;
  const legacyProfile = snapshotProfile(
    legacyIntake.profile ?? legacyIntake.data,
    order.user.profile?.id || 'legacy-sealed-intake',
  );
  if (legacySealedAt && isUsableSnapshot(legacyProfile)) {
    return {
      source: 'SEALED_INTAKE',
      intakeRequired: false,
      readyForProduction: true,
      sealedAt: legacySealedAt,
      contentHash: nonEmptyString(legacyIntake.contentHash) || null,
      reason: null,
      profile: legacyProfile,
    };
  }

  return {
    source: 'LEGACY_PROFILE',
    intakeRequired: false,
    readyForProduction: true,
    sealedAt: null,
    contentHash: null,
    reason: null,
    profile: order.user.profile,
  };
}
