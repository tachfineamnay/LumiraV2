/**
 * Meta Pixel helpers. Every function no-ops when the pixel is not configured
 * (NEXT_PUBLIC_META_PIXEL_ID absent) or not yet loaded, so call sites never
 * need to guard.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type PixelEventData = Record<string, string | number | undefined>;

function track(
  kind: 'track' | 'trackCustom',
  event: string,
  data?: PixelEventData,
  eventId?: string,
) {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (eventId) {
    window.fbq(kind, event, data ?? {}, { eventID: eventId });
  } else {
    window.fbq(kind, event, data ?? {});
  }
}

export function trackInitiateCheckout(valueEur: number) {
  track('track', 'InitiateCheckout', { value: valueEur, currency: 'EUR' });
}

/**
 * paymentIntentId is used as eventID so Meta deduplicates the Purchase when
 * both the inline flow and the 3DS redirect flow fire for the same payment.
 */
export function trackPurchase(valueEur: number, paymentIntentId: string) {
  track('track', 'Purchase', { value: valueEur, currency: 'EUR' }, paymentIntentId);
}
