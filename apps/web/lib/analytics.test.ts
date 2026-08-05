import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import {
  getGaClientContext,
  trackGaViewItem,
  trackGaBeginCheckout,
  trackGaAddPaymentInfo,
} from './analytics';
import { cleanUrlForAnalytics } from '../components/analytics/GoogleAnalyticsSpaTracker';
import { CONSENT_COOKIE_NAME } from './consent';

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  clear(): void {
    this.store = {};
  }
}

describe_analytics();

function describe_analytics() {
  let gtagCalls: unknown[][] = [];
  let localStorageMock: LocalStorageMock;
  let cookieStore = '';

  beforeEach(() => {
    gtagCalls = [];
    localStorageMock = new LocalStorageMock();
    cookieStore = '';
    delete (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { document: unknown }).document = {
      get cookie() {
        return cookieStore;
      },
      set cookie(val: string) {
        cookieStore = val;
      },
    };
  });

  function setupWindow(gtagMock?: (...args: unknown[]) => void) {
    (globalThis as unknown as { window: unknown }).window = {
      gtag: gtagMock || ((...args: unknown[]) => gtagCalls.push(args)),
      localStorage: localStorageMock,
    };
  }

  function setConsentCookie(value: 'granted' | 'denied') {
    cookieStore = `${CONSENT_COOKIE_NAME}=${value}; path=/; SameSite=Lax`;
  }

  test('cleanUrlForAnalytics - nettoie les paramètres sensibles', () => {
    const searchParams = new URLSearchParams(
      'payment_intent=pi_123&payment_intent_client_secret=secret_456&token=jwt_789&email=test%40example.com&coupon=EARLY10',
    );
    const cleaned = cleanUrlForAnalytics('/commande', searchParams);

    assert.strictEqual(cleaned, '/commande?coupon=EARLY10');
    assert.strictEqual(cleaned.includes('payment_intent'), false);
    assert.strictEqual(cleaned.includes('secret_456'), false);
    assert.strictEqual(cleaned.includes('test@example.com'), false);
  });

  test('getGaClientContext - retourne null sans consentement ou sans window', async () => {
    setupWindow();
    const ctxNoConsent = await getGaClientContext(50);
    assert.strictEqual(ctxNoConsent, null);

    setConsentCookie('denied');
    const ctxDenied = await getGaClientContext(50);
    assert.strictEqual(ctxDenied, null);
  });

  test('getGaClientContext - extrait client_id et session_id de gtag lorsque consenti', async () => {
    setupWindow((...args: unknown[]) => {
      const [command, _target, key, callback] = args as [
        string,
        string,
        string,
        (val: unknown) => void,
      ];
      if (command === 'get' && key === 'client_id') {
        callback('123456789.987654321');
      } else if (command === 'get' && key === 'session_id') {
        callback('1700000000');
      }
    });

    setConsentCookie('granted');
    (process.env as Record<string, string>).NEXT_PUBLIC_GA_ID = 'G-TEST';

    const ctx = await getGaClientContext(200);
    assert.notStrictEqual(ctx, null);
    assert.strictEqual(ctx?.clientId, '123456789.987654321');
    assert.strictEqual(ctx?.sessionId, '1700000000');
    assert.ok(ctx?.capturedAt);
  });

  test('trackGaViewItem - n’émet rien sans consentement', () => {
    setupWindow();
    trackGaViewItem();
    assert.strictEqual(gtagCalls.length, 0);
  });

  test('trackGaViewItem - émet payload view_item avec consentement', () => {
    setupWindow();
    setConsentCookie('granted');
    (process.env as Record<string, string>).NEXT_PUBLIC_GA_ID = 'G-TEST';

    trackGaViewItem();
    assert.strictEqual(gtagCalls.length, 1);
    assert.strictEqual(gtagCalls[0][0], 'event');
    assert.strictEqual(gtagCalls[0][1], 'view_item');
  });

  test('trackGaBeginCheckout - émet payload begin_checkout avec consentement', () => {
    setupWindow();
    setConsentCookie('granted');
    (process.env as Record<string, string>).NEXT_PUBLIC_GA_ID = 'G-TEST';

    trackGaBeginCheckout();
    assert.strictEqual(gtagCalls.length, 1);
    assert.strictEqual(gtagCalls[0][0], 'event');
    assert.strictEqual(gtagCalls[0][1], 'begin_checkout');
  });

  test('trackGaAddPaymentInfo - émet payload add_payment_info avec consentement', () => {
    setupWindow();
    setConsentCookie('granted');
    (process.env as Record<string, string>).NEXT_PUBLIC_GA_ID = 'G-TEST';

    trackGaAddPaymentInfo();
    assert.strictEqual(gtagCalls.length, 1);
    assert.strictEqual(gtagCalls[0][0], 'event');
    assert.strictEqual(gtagCalls[0][1], 'add_payment_info');
  });
}
