export type CanonicalDeliveryStyle =
  | 'DOUX_ET_CLAIR'
  | 'DIRECT_ET_CONCRET'
  | 'SYMBOLIQUE_ET_PROFOND';

const LEGACY_DELIVERY_STYLE_MAP: Record<string, CanonicalDeliveryStyle> = {
  Gentle: 'DOUX_ET_CLAIR',
  Direct: 'DIRECT_ET_CONCRET',
  Mystic: 'SYMBOLIQUE_ET_PROFOND',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeLegacyDeliveryStyle(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return LEGACY_DELIVERY_STYLE_MAP[value] ?? value;
}

/**
 * Normalizes only historical values that the current client can no longer
 * represent. The upstream object is returned unchanged when no migration is
 * needed so callers can preserve the original response bytes and headers.
 */
export function normalizeLegacyOnboardingPayload(payload: unknown): unknown {
  if (!isRecord(payload) || !isRecord(payload.data)) return payload;

  const normalizedStyle = normalizeLegacyDeliveryStyle(payload.data.deliveryStyle);
  if (normalizedStyle === payload.data.deliveryStyle) return payload;

  return {
    ...payload,
    data: {
      ...payload.data,
      deliveryStyle: normalizedStyle,
    },
  };
}
