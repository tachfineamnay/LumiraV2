import { BadRequestException } from '@nestjs/common';

export const PROFILE_FIELD_KEYS = [
  'birthDate',
  'birthPlace',
  'intention',
  'facePhotoUrl',
  'palmPhotoUrl',
  'palmRole',
] as const;

export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number];
export type RequestableProfileFieldKey = Exclude<ProfileFieldKey, 'palmRole'>;

export type ProfileFieldInput =
  | 'date'
  | 'text'
  | 'intention'
  | 'photo'
  | 'palm-role';

export interface ProfileFieldDefinition {
  key: ProfileFieldKey;
  label: string;
  input: ProfileFieldInput;
  maxLength: number;
  requestable: boolean;
  required: boolean;
}

export const PROFILE_FIELD_CATALOG: Record<ProfileFieldKey, ProfileFieldDefinition> = {
  birthDate: {
    key: 'birthDate',
    label: 'Date de naissance',
    input: 'date',
    maxLength: 10,
    requestable: true,
    required: true,
  },
  birthPlace: {
    key: 'birthPlace',
    label: 'Lieu de naissance',
    input: 'text',
    maxLength: 180,
    requestable: true,
    required: true,
  },
  intention: {
    key: 'intention',
    label: 'Intention de lecture',
    input: 'intention',
    maxLength: 2000,
    requestable: true,
    required: true,
  },
  facePhotoUrl: {
    key: 'facePhotoUrl',
    label: 'Photo du visage',
    input: 'photo',
    maxLength: 512,
    requestable: true,
    required: true,
  },
  palmPhotoUrl: {
    key: 'palmPhotoUrl',
    label: 'Photo de la paume',
    input: 'photo',
    maxLength: 512,
    requestable: true,
    required: true,
  },
  palmRole: {
    key: 'palmRole',
    label: 'Main photographiée',
    input: 'palm-role',
    maxLength: 20,
    requestable: false,
    required: false,
  },
};

const PROFILE_FIELD_SET = new Set<string>(PROFILE_FIELD_KEYS);
const REQUESTABLE_FIELD_SET = new Set<string>(
  PROFILE_FIELD_KEYS.filter((key) => PROFILE_FIELD_CATALOG[key].requestable),
);

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

export function publicProfileFields(fields: ProfileFieldKey[]): RequestableProfileFieldKey[] {
  return fields.filter((field): field is RequestableProfileFieldKey => field !== 'palmRole');
}

export function profileFieldLabels(fields: ProfileFieldKey[]): string[] {
  return publicProfileFields(fields).map((field) => PROFILE_FIELD_CATALOG[field].label);
}

export function expandProfileAmendmentValues(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key !== 'intention') {
      patch[key] = value;
      continue;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Le bloc intention est invalide');
    }
    const intention = value as Record<string, unknown>;
    patch.intentionMode = intention.intentionMode;
    patch.openReading = intention.openReading === true;
    patch.specificQuestion = intention.specificQuestion ?? null;
    patch.objective = intention.objective ?? null;
  }
  return patch;
}
