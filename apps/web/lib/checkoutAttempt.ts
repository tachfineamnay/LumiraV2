export type CheckoutAttemptPhase = 'preparing' | 'payment_ready' | 'confirming' | 'finalizing';

export interface CheckoutAttempt {
  checkoutAttemptId: string;
  phase: CheckoutAttemptPhase;
  updatedAt: string;
  clientSecret?: string;
  paymentIntentId?: string;
}

const CHECKOUT_ATTEMPT_KEY = 'lumira_checkout_attempt_v1';

export function paymentIntentIdFromClientSecret(clientSecret: string): string | null {
  const separatorIndex = clientSecret.indexOf('_secret_');
  const paymentIntentId = separatorIndex === -1 ? '' : clientSecret.slice(0, separatorIndex);
  return paymentIntentId.startsWith('pi_') ? paymentIntentId : null;
}

export function readCheckoutAttempt(): CheckoutAttempt | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY);
    if (!value) return null;
    const attempt = JSON.parse(value) as Partial<CheckoutAttempt>;
    const isPreparing = attempt.phase === 'preparing';
    const paymentIntentId =
      typeof attempt.clientSecret === 'string'
        ? paymentIntentIdFromClientSecret(attempt.clientSecret)
        : null;
    if (
      typeof attempt.checkoutAttemptId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(attempt.checkoutAttemptId) ||
      !['preparing', 'payment_ready', 'confirming', 'finalizing'].includes(attempt.phase || '') ||
      (!isPreparing &&
        (typeof attempt.clientSecret !== 'string' ||
          !paymentIntentId ||
          typeof attempt.paymentIntentId !== 'string' ||
          attempt.paymentIntentId !== paymentIntentId))
    ) {
      sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
      return null;
    }

    return attempt as CheckoutAttempt;
  } catch {
    return null;
  }
}

export function saveCheckoutAttempt(attempt: Omit<CheckoutAttempt, 'updatedAt'>): CheckoutAttempt {
  const persistedAttempt: CheckoutAttempt = { ...attempt, updatedAt: new Date().toISOString() };
  sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(persistedAttempt));
  return persistedAttempt;
}

export function clearCheckoutAttempt() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
}
