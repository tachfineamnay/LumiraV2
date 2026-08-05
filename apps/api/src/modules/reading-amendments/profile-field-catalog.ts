import { BadRequestException } from '@nestjs/common';

export const PROFILE_FIELD_KEYS = [
  'usageName',
  'birthDate',
  'birthTime',
  'birthPlace',
  'specificQuestion',
  'objective',
  'highs',
  'lows',
  'lifeEvents',
  'ailments',
  'fears',
  'rituals',
  'facePhotoUrl',
] as const;

export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number];

export interface ProfileFieldDefinition {
  key: ProfileFieldKey;
  label: string;
  input: 'text' | 'textarea' | 'date' | 'photo';
  maxLength: number;
}

export const PROFILE_FIELD_CATALOG: Record<ProfileFieldKey, ProfileFieldDefinition> = {
  usageName: { key: 'usageName', label: "Prénom d’usage", input: 'text', maxLength: 120 },
  birthDate: { key: 'birthDate', label: 'Date de naissance', input: 'date', maxLength: 10 },
  birthTime: { key: 'birthTime', label: 'Heure de naissance', input: 'text', maxLength: 16 },
  birthPlace: { key: 'birthPlace', label: 'Lieu de naissance', input: 'text', maxLength: 180 },
  specificQuestion: {
    key: 'specificQuestion',
    label: 'Question précise',
    input: 'textarea',
    maxLength: 2000,
  },
  objective: { key: 'objective', label: 'Objectif de la lecture', input: 'textarea', maxLength: 2000 },
  highs: { key: 'highs', label: 'Ce qui porte actuellement', input: 'textarea', maxLength: 2000 },
  lows: { key: 'lows', label: 'Ce qui freine actuellement', input: 'textarea', maxLength: 2000 },
  lifeEvents: { key: 'lifeEvents', label: 'Période ou événement marquant', input: 'textarea', maxLength: 2000 },
  ailments: { key: 'ailments', label: 'Inconforts ou fragilités', input: 'textarea', maxLength: 1500 },
  fears: { key: 'fears', label: 'Peurs ou blocages', input: 'textarea', maxLength: 2000 },
  rituals: { key: 'rituals', label: 'Pratiques ou rituels', input: 'textarea', maxLength: 1500 },
  facePhotoUrl: { key: 'facePhotoUrl', label: 'Photo du visage', input: 'photo', maxLength: 512 },
};

const PROFILE_FIELD_SET = new Set<string>(PROFILE_FIELD_KEYS);

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
  return unique as ProfileFieldKey[];
}

export function profileFieldLabels(fields: ProfileFieldKey[]): string[] {
  return fields.map((field) => PROFILE_FIELD_CATALOG[field].label);
}
