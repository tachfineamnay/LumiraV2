export type CheckoutAttemptPhase = 'payment_ready' | 'confirming' | 'finalizing';

export interface CheckoutAttempt {
  clientSecret: string;
  paymentIntentId: string;
  phase: CheckoutAttemptPhase;
  updatedAt: string;
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
    const paymentIntentId =
      typeof attempt.clientSecret === 'string'
        ? paymentIntentIdFromClientSecret(attempt.clientSecret)
        : null;
    if (
      typeof attempt.clientSecret !== 'string' ||
      !paymentIntentId ||
      typeof attempt.paymentIntentId !== 'string' ||
      attempt.paymentIntentId !== paymentIntentId ||
      !['payment_ready', 'confirming', 'finalizing'].includes(attempt.phase || '')
    ) {
      sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
      return null;
    }

    return attempt as CheckoutAttempt;
  } catch {
    return null;
  }
}

export function saveCheckoutAttempt(
  attempt: Omit<CheckoutAttempt, 'updatedAt'>,
): CheckoutAttempt {
  const persistedAttempt: CheckoutAttempt = { ...attempt, updatedAt: new Date().toISOString() };
  sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(persistedAttempt));
  return persistedAttempt;
}

export function clearCheckoutAttempt() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
}
