import { BadRequestException } from '@nestjs/common';

export const PROFILE_FIELD_KEYS = [
  'birthDate',
  'birthPlace',
  'facePhotoUrl',
  'palmPhotoUrl',
  'palmRole',
] as const;

export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number];
export type RequestableProfileFieldKey = Exclude<ProfileFieldKey, 'palmRole'>;

export interface ProfileFieldDefinition {
  key: ProfileFieldKey;
  label: string;
  input: 'text' | 'date' | 'photo' | 'palm-role';
  maxLength: number;
}

export const PROFILE_FIELD_CATALOG: Record<ProfileFieldKey, ProfileFieldDefinition> = {
  birthDate: {
    key: 'birthDate',
    label: 'Date de naissance',
    input: 'date',
    maxLength: 10,
  },
  birthPlace: {
    key: 'birthPlace',
    label: 'Lieu de naissance',
    input: 'text',
    maxLength: 180,
  },
  facePhotoUrl: {
    key: 'facePhotoUrl',
    label: 'Photo du visage',
    input: 'photo',
    maxLength: 512,
  },
  palmPhotoUrl: {
    key: 'palmPhotoUrl',
    label: 'Photo de la paume',
    input: 'photo',
    maxLength: 512,
  },
  palmRole: {
    key: 'palmRole',
    label: 'Main photographiée',
    input: 'palm-role',
    maxLength: 20,
  },
};

const PROFILE_FIELD_SET = new Set<string>(PROFILE_FIELD_KEYS);
const REQUESTABLE_FIELD_SET = new Set<string>([
  'birthDate',
  'birthPlace',
  'facePhotoUrl',
  'palmPhotoUrl',
]);

/** Parses already persisted fields. */
export function parseProfileFields(values: string[]): ProfileFieldKey[] {
  const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  if (unique.length === 0) {
    throw new BadRequestException('Sélectionnez au moins une information à demander');
  }
  for (const key of unique) {
    if (!PROFILE_FIELD_SET.has(key)) {
      throw new BadRequestException(`Champ de complément interdit : ${key}`);
    }
  }
  if (unique.includes('palmRole') && !unique.includes('palmPhotoUrl')) {
    throw new BadRequestException('La main photographiée ne peut être demandée sans la paume');
  }
  return unique as ProfileFieldKey[];
}

/**
 * Validates an expert request and automatically couples the hand side with a
 * requested palm photo. The client never receives an arbitrary JSON path.
 */
export function normalizeRequestedProfileFields(values: string[]): ProfileFieldKey[] {
  const requested = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  if (requested.length === 0) {
    throw new BadRequestException('Sélectionnez au moins une information manquante');
  }
  for (const key of requested) {
    if (!REQUESTABLE_FIELD_SET.has(key)) {
      throw new BadRequestException(`Information non demandable : ${key}`);
    }
  }
  if (requested.includes('palmPhotoUrl')) requested.push('palmRole');
  return parseProfileFields(requested);
}

export function profileFieldLabels(fields: ProfileFieldKey[]): string[] {
  return fields.map((field) => PROFILE_FIELD_CATALOG[field].label);
}
