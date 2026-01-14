import { z } from "zod";

// =============================================================================
// BIRTH DATA SCHEMA
// =============================================================================

export const birthDataSchema = z.object({
    birthDate: z.string().min(1, "La date de naissance est requise"),
    birthTime: z.string().optional(),
    birthPlace: z.string().min(2, "Le lieu de naissance doit contenir au moins 2 caractères"),
});

export type BirthData = z.infer<typeof birthDataSchema>;

// =============================================================================
// INTENTION SCHEMA
// =============================================================================

export const intentionSchema = z.object({
    spiritualQuestion: z
        .string()
        .min(10, "Votre question doit contenir au moins 10 caractères")
        .max(1000, "Votre question ne peut pas dépasser 1000 caractères"),
});

export type IntentionData = z.infer<typeof intentionSchema>;

// =============================================================================
// PHOTOS SCHEMA
// =============================================================================

export const photosSchema = z.object({
    facePhoto: z.string().optional(),
    palmPhoto: z.string().optional(),
});

export type PhotosData = z.infer<typeof photosSchema>;

// =============================================================================
// COMPLETE ONBOARDING SCHEMA
// =============================================================================

export const completeOnboardingSchema = birthDataSchema
    .merge(intentionSchema)
    .merge(photosSchema);

export type CompleteOnboardingData = z.infer<typeof completeOnboardingSchema>;
