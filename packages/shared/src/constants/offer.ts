/**
 * Canonical V1 early-adopter offer — single source of truth for price & access.
 * Server checkout must resolve amounts from this constant, never from the client.
 *
 * Access is NOT lifetime: early buyers get Sanctuaire access for a fixed window.
 */
export const LUMIRA_EARLY_OFFER = {
  code: 'lumira_early_v1',
  /** @deprecated Wrong product semantics — kept only as checkout alias */
  legacyLifetimeCode: 'lumira_lifetime_v1',
  publicName: 'Cercle des Initiés',
  audience: 'early_adopters' as const,
  amountCents: 1700,
  currency: 'EUR',
  priceEuros: 17,
  paymentType: 'one_time' as const,
  /** Sanctuaire access duration after payment (early cohort) */
  accessDurationMonths: 3,
  access: 'fixed_term' as const,
  /** Announced delivery window after the client dossier is sealed */
  deliveryWindowHours: { min: 24, max: 48 } as const,
  guaranteedDeliverables: [
    'dossier_client_securise',
    'lecture_personnalisee',
    'revision_expert_humain',
    'pdf_prive',
    'narration_audio_privee',
    'acces_sanctuaire',
  ] as const,
  /** Explicitly out of scope for V1 public promises */
  notPromisedInV1: [
    'acces_a_vie',
    'mandala',
    'journal_des_reves',
    'guidance_30_jours',
    'chat_illimite',
    'predictions_certaines',
    'resultats_medicaux_ou_therapeutiques',
  ] as const,
} as const;

/** @deprecated Use LUMIRA_EARLY_OFFER — name kept during rename migration */
export const LUMIRA_LIFETIME_OFFER = LUMIRA_EARLY_OFFER;

export type LumiraEarlyOfferCode = typeof LUMIRA_EARLY_OFFER.code;

/** Catalog keys accepted by checkout — all resolve to LUMIRA_EARLY_OFFER */
export const EARLY_CHECKOUT_ALIASES = [
  LUMIRA_EARLY_OFFER.code,
  LUMIRA_EARLY_OFFER.legacyLifetimeCode,
  '1',
  '2',
  '3',
  '4',
  'initie',
  'subscription',
] as const;

/** @deprecated Use EARLY_CHECKOUT_ALIASES */
export const LIFETIME_CHECKOUT_ALIASES = EARLY_CHECKOUT_ALIASES;

export type EarlyCheckoutAlias = (typeof EARLY_CHECKOUT_ALIASES)[number];

export function isEarlyCheckoutAlias(value: string): value is EarlyCheckoutAlias {
  return (EARLY_CHECKOUT_ALIASES as readonly string[]).includes(value.toLowerCase().trim());
}

/** @deprecated Use isEarlyCheckoutAlias */
export const isLifetimeCheckoutAlias = isEarlyCheckoutAlias;

export function resolveEarlyOfferAmountCents(productKey?: string | null): number {
  if (!productKey) return LUMIRA_EARLY_OFFER.amountCents;
  if (!isEarlyCheckoutAlias(productKey)) {
    throw new Error(`Unknown productLevel: ${productKey}`);
  }
  return LUMIRA_EARLY_OFFER.amountCents;
}

/** @deprecated Use resolveEarlyOfferAmountCents */
export const resolveLifetimeOfferAmountCents = resolveEarlyOfferAmountCents;

/** Compute Sanctuaire access end date from the payment timestamp. */
export function getEarlyAccessExpiresAt(
  paidAt: Date,
  durationMonths: number = LUMIRA_EARLY_OFFER.accessDurationMonths,
): Date {
  const expires = new Date(paidAt.getTime());
  expires.setUTCMonth(expires.getUTCMonth() + durationMonths);
  return expires;
}

/** True while the early access window is still open. */
export function isEarlyAccessActive(
  paidAt: Date | string | null | undefined,
  now: Date = new Date(),
  durationMonths: number = LUMIRA_EARLY_OFFER.accessDurationMonths,
): boolean {
  if (!paidAt) return false;
  const paidDate = paidAt instanceof Date ? paidAt : new Date(paidAt);
  if (Number.isNaN(paidDate.getTime())) return false;
  return getEarlyAccessExpiresAt(paidDate, durationMonths).getTime() > now.getTime();
}
