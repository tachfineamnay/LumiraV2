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
 * Returns the buyer email for optional redirect params.
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
  sessionStorage.setItem('sanctuaire_email', user.email);

  // Clear any previous onboarding draft so the new buyer starts clean
  localStorage.removeItem('holistic_wizard_draft');
  localStorage.removeItem('holistic_wizard_email');

  return { email: user.email as string };
}

/**
 * Redirect into Sanctuaire after one-time checkout.
 * Uses onboarding=1 + fv_ token — never subscription=success (that triggers
 * the subscription-activation poller and strips auth params).
 */
export function buildSanctuairePostCheckoutUrl(email: string): string {
  const firstVisitToken = `fv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const params = new URLSearchParams({
    email,
    token: firstVisitToken,
    onboarding: '1',
  });
  return `/sanctuaire?${params.toString()}`;
}
