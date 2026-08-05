import { SUBSCRIPTION } from './products';

export const GA4_ITEM_NAME = 'Lecture Oracle Lumira';

/**
 * Helper TypeScript global pour Google Analytics (gtag.js).
 */
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Envoie l'événement e-commerce GA4 `begin_checkout`.
 * Ne lève jamais d'exception vers le parcours utilisateur.
 */
export function trackGaBeginCheckout(): void {
  try {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
      return;
    }

    window.gtag('event', 'begin_checkout', {
      currency: 'EUR',
      value: SUBSCRIPTION.price,
      items: [
        {
          item_id: SUBSCRIPTION.code,
          item_name: GA4_ITEM_NAME,
          price: SUBSCRIPTION.price,
          quantity: 1,
        },
      ],
    });
  } catch (err) {
    console.error('[GA4 Analytics] Error tracking begin_checkout:', err);
  }
}

/**
 * Envoie l'événement e-commerce GA4 `purchase`.
 * Utilise `localStorage` et `transaction_id` pour dédupliquer les envois pour un même PaymentIntent.
 * Ne lève jamais d'exception vers le parcours utilisateur.
 */
export function trackGaPurchase(paymentIntentId: string): void {
  try {
    if (!paymentIntentId || typeof window === 'undefined' || typeof window.gtag !== 'function') {
      return;
    }

    const dedupeKey = `lumira_ga4_purchase_${paymentIntentId}`;

    try {
      if (window.localStorage.getItem(dedupeKey)) {
        return;
      }
      window.localStorage.setItem(dedupeKey, 'true');
    } catch {
      // Si localStorage est désactivé ou refuse l'écriture (mode privé), on continue l'émission
    }

    window.gtag('event', 'purchase', {
      transaction_id: paymentIntentId,
      currency: 'EUR',
      value: SUBSCRIPTION.price,
      items: [
        {
          item_id: SUBSCRIPTION.code,
          item_name: GA4_ITEM_NAME,
          price: SUBSCRIPTION.price,
          quantity: 1,
        },
      ],
    });
  } catch (err) {
    console.error('[GA4 Analytics] Error tracking purchase:', err);
  }
}
