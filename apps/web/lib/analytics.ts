import { SUBSCRIPTION } from './products';
import { readConsentCookie } from './consent';

export const GA4_ITEM_NAME = 'Lecture Oracle Lumira';

export interface GaClientContext {
  clientId: string;
  sessionId?: string;
  capturedAt: string;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function getGaTrackingId(): string | undefined {
  return process.env.NEXT_PUBLIC_GA_ID;
}

function isGaAvailable(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.gtag === 'function' && Boolean(getGaTrackingId())
  );
}

function hasAnalyticsConsent(): boolean {
  return readConsentCookie() === 'granted';
}

function createGaItem() {
  return {
    item_id: SUBSCRIPTION.code,
    item_name: GA4_ITEM_NAME,
    affiliation: 'Oracle Lumira',
    item_brand: 'Oracle Lumira',
    item_category: 'Lecture personnalisée',
    price: SUBSCRIPTION.price,
    quantity: 1,
  };
}

/**
 * Récupère le client_id et session_id de gtag (si le consentement est accordé).
 * Timeout maximal de 800 ms pour ne jamais bloquer le checkout.
 */
export function getGaClientContext(timeoutMs = 800): Promise<GaClientContext | null> {
  return new Promise((resolve) => {
    if (!isGaAvailable() || !hasAnalyticsConsent()) {
      resolve(null);
      return;
    }

    const gaId = getGaTrackingId();
    if (!gaId) {
      resolve(null);
      return;
    }

    let settled = false;
    let clientIdVal: string | undefined;
    let sessionIdVal: string | undefined;
    let clientReceived = false;
    let sessionReceived = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        if (clientIdVal) {
          resolve({
            clientId: clientIdVal,
            sessionId: sessionIdVal,
            capturedAt: new Date().toISOString(),
          });
        } else {
          resolve(null);
        }
      }
    }, timeoutMs);

    function checkDone() {
      if (!settled && clientReceived && sessionReceived) {
        settled = true;
        clearTimeout(timer);
        if (clientIdVal) {
          resolve({
            clientId: clientIdVal,
            sessionId: sessionIdVal,
            capturedAt: new Date().toISOString(),
          });
        } else {
          resolve(null);
        }
      }
    }

    try {
      window.gtag?.('get', gaId, 'client_id', (cid: unknown) => {
        if (typeof cid === 'string' && cid.trim()) {
          clientIdVal = cid.trim();
        }
        clientReceived = true;
        checkDone();
      });

      window.gtag?.('get', gaId, 'session_id', (sid: unknown) => {
        if (typeof sid === 'string' || typeof sid === 'number') {
          sessionIdVal = String(sid).trim();
        }
        sessionReceived = true;
        checkDone();
      });
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

/**
 * Envoie l'événement e-commerce GA4 `view_item` lorsque l'offre est réellement affichée.
 */
export function trackGaViewItem(): void {
  try {
    if (!isGaAvailable() || !hasAnalyticsConsent()) return;

    window.gtag?.('event', 'view_item', {
      currency: 'EUR',
      value: SUBSCRIPTION.price,
      items: [createGaItem()],
    });
  } catch (err) {
    console.error('[GA4 Analytics] Error tracking view_item:', err);
  }
}

/**
 * Envoie l'événement e-commerce GA4 `begin_checkout` lorsque le formulaire valide déclenche l'intention de paiement.
 */
export function trackGaBeginCheckout(): void {
  try {
    if (!isGaAvailable() || !hasAnalyticsConsent()) return;

    window.gtag?.('event', 'begin_checkout', {
      currency: 'EUR',
      value: SUBSCRIPTION.price,
      items: [createGaItem()],
    });
  } catch (err) {
    console.error('[GA4 Analytics] Error tracking begin_checkout:', err);
  }
}

/**
 * Envoie l'événement e-commerce GA4 `add_payment_info` lorsque le client soumet le formulaire Stripe.
 */
export function trackGaAddPaymentInfo(): void {
  try {
    if (!isGaAvailable() || !hasAnalyticsConsent()) return;

    window.gtag?.('event', 'add_payment_info', {
      currency: 'EUR',
      value: SUBSCRIPTION.price,
      payment_type: 'stripe',
      items: [createGaItem()],
    });
  } catch (err) {
    console.error('[GA4 Analytics] Error tracking add_payment_info:', err);
  }
}
