import { z } from 'zod';

export const DELIVERY_STYLES = [
  'DOUX_ET_CLAIR',
  'DIRECT_ET_CONCRET',
  'SYMBOLIQUE_ET_PROFOND',
] as const;

export const LIFE_AREA_KEYS = [
  'relations',
  'travail',
  'corps',
  'creativite',
  'interieur',
  'direction',
] as const;
export type LifeAreaKey = (typeof LIFE_AREA_KEYS)[number];

export const LIFE_AREA_STATES = ['FLUIDE', 'TENDU', 'EN_QUESTION'] as const;
export type LifeAreaState = (typeof LIFE_AREA_STATES)[number];

export const LIFE_AREA_LABELS: Record<LifeAreaKey, string> = {
  relations: 'Relations & famille',
  travail: 'Travail & argent',
  corps: 'Corps & énergie',
  creativite: 'Créativité & élans',
  interieur: 'Vie intérieure',
  direction: 'Direction de vie',
};

export const LIFE_AREA_STATE_LABELS: Record<LifeAreaState, string> = {
  FLUIDE: 'Fluide',
  TENDU: 'Tendu',
  EN_QUESTION: 'En question',
};

const lifeAreaEntrySchema = z.object({
  state: z.enum(LIFE_AREA_STATES),
  note: z.string().max(300, 'Cette note ne peut pas dépasser 300 caractères.').optional(),
});
export type LifeAreaEntry = z.infer<typeof lifeAreaEntrySchema>;

export const lifeAreasSchema = z.object({
  relations: lifeAreaEntrySchema.optional(),
  travail: lifeAreaEntrySchema.optional(),
  corps: lifeAreaEntrySchema.optional(),
  creativite: lifeAreaEntrySchema.optional(),
  interieur: lifeAreaEntrySchema.optional(),
  direction: lifeAreaEntrySchema.optional(),
});
export type LifeAreas = Partial<Record<LifeAreaKey, LifeAreaEntry>>;

const optionalText = (maximum: number, message: string) => z.string().max(maximum, message);

function parseCalendarDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
}

export const readingPreparationSchema = z.object({
  usageName: optionalText(120, "Ce prénom d'usage ne peut pas dépasser 120 caractères."),
  birthDate: z
    .string()
    .min(1, 'Indiquez votre date de naissance.')
    .refine((value) => parseCalendarDate(value) !== null, 'Cette date de naissance est invalide.')
    .refine((value) => {
      const timestamp = parseCalendarDate(value);
      return timestamp !== null && timestamp <= Date.now();
    }, 'La date de naissance ne peut pas être dans le futur.'),
  birthTime: optionalText(16, "L'heure de naissance ne peut pas dépasser 16 caractères."),
  birthPlace: z
    .string()
    .trim()
    .min(2, 'Précisez au moins une ville ou un lieu.')
    .max(180, 'Le lieu de naissance ne peut pas dépasser 180 caractères.'),
  specificQuestion: optionalText(2000, 'Votre question ne peut pas dépasser 2 000 caractères.'),
  objective: optionalText(2000, 'Votre intention ne peut pas dépasser 2 000 caractères.'),
  openReading: z.boolean(),
  facePhoto: z.string(),
  palmPhoto: z.string(),
  highs: optionalText(2000, 'Cette réponse ne peut pas dépasser 2 000 caractères.'),
  lows: optionalText(2000, 'Cette réponse ne peut pas dépasser 2 000 caractères.'),
  lifeEvents: optionalText(2000, 'Cette réponse ne peut pas dépasser 2 000 caractères.'),
  lifeAreas: lifeAreasSchema.optional(),
  strongSide: optionalText(2000, 'Cette réponse ne peut pas dépasser 2 000 caractères.').optional(),
  weakSide: optionalText(2000, 'Cette réponse ne peut pas dépasser 2 000 caractères.').optional(),
  strongZone: optionalText(2000, 'Cette réponse ne peut pas dépasser 2 000 caractères.').optional(),
  weakZone: optionalText(2000, 'Cette réponse ne peut pas dépasser 2 000 caractères.').optional(),
  ailments: optionalText(1500, 'Cette réponse ne peut pas dépasser 1 500 caractères.'),
  fears: optionalText(2000, 'Cette réponse ne peut pas dépasser 2 000 caractères.'),
  rituals: optionalText(1500, 'Cette réponse ne peut pas dépasser 1 500 caractères.'),
  deliveryStyle: z.enum(DELIVERY_STYLES),
  pace: z.number().int().min(0).max(100),
  consent: z.boolean(),
});

export const readingPreparationSubmissionSchema = readingPreparationSchema
  .refine(
    (data) => Boolean(data.specificQuestion.trim() || data.objective.trim() || data.openReading),
    {
      path: ['specificQuestion'],
      message: 'Écrivez une question, une intention, ou choisissez une lecture ouverte.',
    },
  )
  .refine((data) => data.consent, {
    path: ['consent'],
    message: 'Relisez puis confirmez la transmission de votre dossier.',
  });

export type ReadingPreparationData = z.infer<typeof readingPreparationSchema>;
