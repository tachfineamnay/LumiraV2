import { z } from "zod";

// =============================================================================
// HOLISTIC DIAGNOSTIC SCHEMA - Grand Diagnostic Vibratoire
// =============================================================================

// -----------------------------------------------------------------------------
// ENUMS & LITERALS
// -----------------------------------------------------------------------------

export const DeliveryStyleEnum = z.enum(["Direct", "Gentle", "Mystic"]);
export type DeliveryStyle = z.infer<typeof DeliveryStyleEnum>;

export const PaceEnum = z.enum(["Fast", "Slow"]);
export type Pace = z.infer<typeof PaceEnum>;

export const LateralityEnum = z.enum(["Left", "Right"]);
export type Laterality = z.infer<typeof LateralityEnum>;

// -----------------------------------------------------------------------------
// STEP 1: VIBRATION (L'État Vibratoire)
// -----------------------------------------------------------------------------

export const vibrationSchema = z.object({
    highs: z
        .string()
        .min(10, "Partagez au moins quelques mots sur ce qui illumine votre vie")
        .max(2000, "Maximum 2000 caractères"),
    lows: z
        .string()
        .min(10, "Partagez au moins quelques mots sur ce qui pèse sur votre âme")
        .max(2000, "Maximum 2000 caractères"),
});

export type VibrationData = z.infer<typeof vibrationSchema>;

// -----------------------------------------------------------------------------
// STEP 2: SOMATIC (Le Corps Mémoire)
// -----------------------------------------------------------------------------

export const somaticSchema = z.object({
    ailments: z
        .string()
        .max(1500, "Maximum 1500 caractères")
        .optional()
        .or(z.literal("")),
    strongSide: LateralityEnum,
    weakSide: LateralityEnum,
    strongZone: z
        .string()
        .min(2, "Indiquez votre zone de puissance")
        .max(100, "Maximum 100 caractères"),
    weakZone: z
        .string()
        .min(2, "Indiquez votre zone de vulnérabilité")
        .max(100, "Maximum 100 caractères"),
});

export type SomaticData = z.infer<typeof somaticSchema>;

// -----------------------------------------------------------------------------
// STEP 3: RHYTHM (La Fréquence)
// -----------------------------------------------------------------------------

export const rhythmSchema = z.object({
    deliveryStyle: DeliveryStyleEnum,
    pace: z.number().min(0).max(100), // 0 = Slow, 100 = Fast (slider value)
});

export type RhythmData = z.infer<typeof rhythmSchema>;

// -----------------------------------------------------------------------------
// STEP 4: IDENTITY (L'Ancrage)
// -----------------------------------------------------------------------------

export const identitySchema = z.object({
    birthDate: z.string().min(1, "La date de naissance est requise"),
    birthTime: z.string().optional().or(z.literal("")),
    birthPlace: z.string().min(2, "Le lieu de naissance doit contenir au moins 2 caractères"),
    facePhoto: z.string().optional().or(z.literal("")),
    palmPhoto: z.string().optional().or(z.literal("")),
});

export type IdentityData = z.infer<typeof identitySchema>;

// -----------------------------------------------------------------------------
// STEP 5: INTENTIONS (Vos Attentes)
// -----------------------------------------------------------------------------

export const intentionsSchema = z.object({
    specificQuestion: z
        .string()
        .max(2000, "Maximum 2000 caractères")
        .optional()
        .or(z.literal("")),
    objective: z
        .string()
        .max(2000, "Maximum 2000 caractères")
        .optional()
        .or(z.literal("")),
    fears: z
        .string()
        .max(2000, "Maximum 2000 caractères")
        .optional()
        .or(z.literal("")),
    rituals: z
        .string()
        .max(1500, "Maximum 1500 caractères")
        .optional()
        .or(z.literal("")),
});

export type IntentionsData = z.infer<typeof intentionsSchema>;

// -----------------------------------------------------------------------------
// STEP 6: CONSENT (Le Scellement)
// -----------------------------------------------------------------------------

export const consentSchema = z.object({
    gdprConsent: z.boolean().refine((val) => val === true, {
        message: "Vous devez consentir pour continuer",
    }),
});

export type ConsentData = z.infer<typeof consentSchema>;

// -----------------------------------------------------------------------------
// COMPLETE HOLISTIC DIAGNOSTIC SCHEMA
// -----------------------------------------------------------------------------

export const holisticDiagnosticSchema = vibrationSchema
    .merge(somaticSchema)
    .merge(rhythmSchema)
    .merge(identitySchema)
    .merge(intentionsSchema)
    .merge(consentSchema);

export type HolisticDiagnosticData = z.infer<typeof holisticDiagnosticSchema>;

// -----------------------------------------------------------------------------
// PARTIAL SCHEMAS FOR STEP VALIDATION
// -----------------------------------------------------------------------------

export const stepSchemas = {
    vibration: vibrationSchema,
    somatic: somaticSchema,
    rhythm: rhythmSchema,
    identity: identitySchema,
    intentions: intentionsSchema,
    consent: consentSchema,
} as const;

// -----------------------------------------------------------------------------
// DEFAULT VALUES
// -----------------------------------------------------------------------------

export const defaultHolisticData: Partial<HolisticDiagnosticData> = {
    highs: "",
    lows: "",
    ailments: "",
    strongSide: "Right",
    weakSide: "Left",
    strongZone: "",
    weakZone: "",
    deliveryStyle: "Gentle",
    pace: 50,
    birthDate: "",
    birthTime: "",
    birthPlace: "",
    facePhoto: "",
    palmPhoto: "",
    specificQuestion: "",
    objective: "",
    fears: "",
    rituals: "",
    gdprConsent: false,
};

// -----------------------------------------------------------------------------
// BODY ZONE SUGGESTIONS
// -----------------------------------------------------------------------------

export const BODY_ZONES = {
    strength: [
        "Épaules",
        "Regard",
        "Mains",
        "Poitrine",
        "Dos",
        "Jambes",
        "Mâchoire",
        "Front",
        "Bras",
        "Pieds",
    ],
    weakness: [
        "Ventre",
        "Gorge",
        "Cœur",
        "Nuque",
        "Bas du dos",
        "Genoux",
        "Plexus solaire",
        "Tempes",
        "Hanches",
        "Chevilles",
    ],
} as const;

// -----------------------------------------------------------------------------
// DELIVERY STYLE DESCRIPTIONS
// -----------------------------------------------------------------------------

export const DELIVERY_STYLES = {
    Direct: {
        icon: "⚔️",
        title: "L'Épée",
        subtitle: "Vérité crue, directe",
        description: "Vous préférez la franchise absolue, même quand elle tranche.",
    },
    Gentle: {
        icon: "🛡️",
        title: "Le Bouclier",
        subtitle: "Douceur, protection",
        description: "Vous avez besoin d'être accompagné avec bienveillance.",
    },
    Mystic: {
        icon: "🔮",
        title: "Le Miroir",
        subtitle: "Symbolique, énigmatique",
        description: "Vous préférez les métaphores et les révélations progressives.",
    },
} as const;
