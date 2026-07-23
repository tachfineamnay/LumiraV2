import sanctuaireApi from './sanctuaireApi';

const FIRST_VISIT_KEY = 'sanctuaire_first_visit';

async function persistSanctuaireSession(token: string) {
  const response = await fetch('/api/auth/sanctuaire/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Failed to persist session cookie (${response.status})${detail ? `: ${detail}` : ''}`,
    );
  }
}

/**
 * After Stripe reports payment succeeded:
 * 1. Confirm with API (marks order PAID + issues Sanctuaire JWT)
 * 2. Persist httpOnly session cookie
 * 3. Mark first visit for onboarding
 * Returns the buyer email for analytics and UI only.
 */
export async function completeCheckoutSession(paymentIntentId: string): Promise<{ email: string }> {
  const response = await sanctuaireApi.post('/payments/confirm-checkout', {
    paymentIntentId,
  });

  const { token, user } = response.data;
  if (!token || !user?.email) {
    throw new Error('confirm-checkout did not return a session');
  }

  await persistSanctuaireSession(token);
  sessionStorage.setItem(FIRST_VISIT_KEY, 'true');

  return { email: user.email as string };
}

/**
 * Redirect into Sanctuaire after one-time checkout.
 * The authenticated session is already stored in an httpOnly cookie. Do not
 * include any credential-like or identity data in the redirect URL.
 */
export function buildSanctuairePostCheckoutUrl(): string {
  return '/sanctuaire?onboarding=1';
}
