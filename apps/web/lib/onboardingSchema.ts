import { z } from 'zod';

export const DELIVERY_STYLES = [
  'DOUX_ET_CLAIR',
  'DIRECT_ET_CONCRET',
  'SYMBOLIQUE_ET_PROFOND',
] as const;

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

// Compatibility exports for the archived onboarding variants. They are kept
// until those components are removed, but the active flow uses the schema above.
export const birthDataSchema = readingPreparationSchema.pick({
  birthDate: true,
  birthTime: true,
  birthPlace: true,
});
export type BirthData = z.infer<typeof birthDataSchema>;

export const intentionSchema = z.object({
  spiritualQuestion: z
    .string()
    .min(10, 'Votre question doit contenir au moins 10 caractères.')
    .max(1000, 'Votre question ne peut pas dépasser 1 000 caractères.'),
});
export type IntentionData = z.infer<typeof intentionSchema>;

export const photosSchema = readingPreparationSchema.pick({ facePhoto: true, palmPhoto: true });
export type PhotosData = z.infer<typeof photosSchema>;

export const completeOnboardingSchema = birthDataSchema.merge(intentionSchema).merge(photosSchema);
export type CompleteOnboardingData = z.infer<typeof completeOnboardingSchema>;
