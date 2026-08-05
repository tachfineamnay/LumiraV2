import assert from 'node:assert';
import { test, beforeEach } from 'node:test';
import { trackGaBeginCheckout, trackGaPurchase } from './analytics';
import { SUBSCRIPTION } from './products';

// Mock minimal du navigateur et de localStorage pour les tests Node.js
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

  beforeEach(() => {
    gtagCalls = [];
    localStorageMock = new LocalStorageMock();

    // Reset window
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  function setupWindow(gtagMock?: (...args: unknown[]) => void) {
    (globalThis as unknown as { window: unknown }).window = {
      gtag: gtagMock || ((...args: unknown[]) => gtagCalls.push(args)),
      localStorage: localStorageMock,
    };
  }

  test('trackGaBeginCheckout - aucun crash si window est indisponible', () => {
    assert.doesNotThrow(() => {
      trackGaBeginCheckout();
    });
  });

  test('trackGaBeginCheckout - aucun crash si window.gtag est absent', () => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: localStorageMock,
    };

    assert.doesNotThrow(() => {
      trackGaBeginCheckout();
    });
    assert.strictEqual(gtagCalls.length, 0);
  });

  test('trackGaBeginCheckout - payload exact émis lorsque gtag est disponible', () => {
    setupWindow();
    trackGaBeginCheckout();

    assert.strictEqual(gtagCalls.length, 1);
    assert.deepStrictEqual(gtagCalls[0], [
      'event',
      'begin_checkout',
      {
        currency: 'EUR',
        value: SUBSCRIPTION.price,
        items: [
          {
            item_id: SUBSCRIPTION.code,
            item_name: 'Lecture Oracle Lumira',
            price: SUBSCRIPTION.price,
            quantity: 1,
          },
        ],
      },
    ]);
  });

  test('trackGaPurchase - aucun crash si window est indisponible', () => {
    assert.doesNotThrow(() => {
      trackGaPurchase('pi_test123');
    });
  });

  test('trackGaPurchase - aucun crash si window.gtag est absent', () => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: localStorageMock,
    };

    assert.doesNotThrow(() => {
      trackGaPurchase('pi_test123');
    });
    assert.strictEqual(gtagCalls.length, 0);
  });

  test('trackGaPurchase - payload exact avec transaction_id égal au PaymentIntent Stripe', () => {
    setupWindow();
    trackGaPurchase('pi_3MtwBwLkdIwHu7ix28a3t0AL');

    assert.strictEqual(gtagCalls.length, 1);
    assert.deepStrictEqual(gtagCalls[0], [
      'event',
      'purchase',
      {
        transaction_id: 'pi_3MtwBwLkdIwHu7ix28a3t0AL',
        currency: 'EUR',
        value: 17,
        items: [
          {
            item_id: 'lumira_early_v1',
            item_name: 'Lecture Oracle Lumira',
            price: 17,
            quantity: 1,
          },
        ],
      },
    ]);
  });

  test('trackGaPurchase - déduplication idempotente (seul le 1er appel est émis pour le même PaymentIntent)', () => {
    setupWindow();

    trackGaPurchase('pi_3MtwBwLkdIwHu7ix28a3t0AL');
    trackGaPurchase('pi_3MtwBwLkdIwHu7ix28a3t0AL');
    trackGaPurchase('pi_3MtwBwLkdIwHu7ix28a3t0AL');

    assert.strictEqual(gtagCalls.length, 1);
    assert.strictEqual(
      localStorageMock.getItem('lumira_ga4_purchase_pi_3MtwBwLkdIwHu7ix28a3t0AL'),
      'true',
    );
  });

  test('trackGaPurchase - gère silencieusement les erreurs de localStorage sans bloquer le tracking', () => {
    (globalThis as unknown as { window: unknown }).window = {
      gtag: (...args: unknown[]) => gtagCalls.push(args),
      get localStorage(): Storage {
        throw new Error('Access denied');
      },
    };

    assert.doesNotThrow(() => {
      trackGaPurchase('pi_error_storage_123');
    });

    assert.strictEqual(gtagCalls.length, 1);
    assert.strictEqual(
      (gtagCalls[0][2] as { transaction_id: string }).transaction_id,
      'pi_error_storage_123',
    );
  });
}
