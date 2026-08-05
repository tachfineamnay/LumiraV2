import { z } from 'zod';

export const DELIVERY_STYLES = [
  'DOUX_ET_CLAIR',
  'DIRECT_ET_CONCRET',
  'SYMBOLIQUE_ET_PROFOND',
] as const;

export const INTENTION_MODES = ['QUESTION', 'SITUATION', 'OPEN'] as const;
export type IntentionMode = (typeof INTENTION_MODES)[number];

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
const PRIVATE_PHOTO_PREFIX = 's3://onboarding/';

export function isPersistedPrivatePhoto(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith(PRIVATE_PHOTO_PREFIX) &&
    !value.includes('..') &&
    !/^https?:\/\//i.test(value)
  );
}

export function inferIntentionModeFromValues(value: {
  intentionMode?: IntentionMode;
  specificQuestion?: string;
  objective?: string;
  openReading?: boolean;
}): IntentionMode | null {
  if (value.intentionMode) return value.intentionMode;
  if (value.openReading === true) return 'OPEN';
  if (value.specificQuestion?.trim()) return 'QUESTION';
  if (value.objective?.trim()) return 'SITUATION';
  return null;
}

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
  intentionMode: z.enum(INTENTION_MODES).optional(),
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
  palmRole: z.enum(['PALM_LEFT', 'PALM_RIGHT', 'PALM_UNKNOWN']),
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

export const readingPreparationSubmissionSchema = readingPreparationSchema.superRefine(
  (data, context) => {
    const intentionMode = inferIntentionModeFromValues(data);
    if (!intentionMode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['specificQuestion'],
        message: 'Choisissez la manière dont vous souhaitez orienter votre lecture.',
      });
    }

    const question = data.specificQuestion.trim();
    const objective = data.objective.trim();
    if (intentionMode === 'QUESTION' && question.length < 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['specificQuestion'],
        message: 'Formulez votre question en au moins 10 caractères.',
      });
    }
    if (intentionMode === 'SITUATION' && objective.length < 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['objective'],
        message: 'Décrivez votre situation ou votre direction en au moins 10 caractères.',
      });
    }
    if (intentionMode === 'OPEN' && !data.openReading) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['specificQuestion'],
        message: 'Confirmez explicitement la lecture ouverte.',
      });
    }
    if (intentionMode !== 'OPEN' && data.openReading) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['specificQuestion'],
        message: 'Le mode d’intention sélectionné ne correspond pas à une lecture ouverte.',
      });
    }

    if (!isPersistedPrivatePhoto(data.facePhoto)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['facePhoto'],
        message: 'Ajoutez et enregistrez une photo du visage avant de transmettre.',
      });
    }
    if (!isPersistedPrivatePhoto(data.palmPhoto)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['palmPhoto'],
        message: 'Ajoutez et enregistrez une photo de la paume avant de transmettre.',
      });
    }
    if (!data.consent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consent'],
        message: 'Relisez puis confirmez la transmission de votre dossier.',
      });
    }
  },
);

export type ReadingPreparationData = z.infer<typeof readingPreparationSchema>;
