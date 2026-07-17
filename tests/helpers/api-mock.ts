/**
 * Playwright API Mocking helpers for Sanctuaire E2E tests.
 * Intercepts BFF (/api/bff/*) + session routes after httpOnly migration.
 */
import { Page, Route } from '@playwright/test';
import {
  createTestUser,
  createTestProfile,
  createTestOrder,
  createTestInsights,
  createTestSpiritualPath,
  createTestSubscription,
  createTestEntitlements,
  createTestDream,
  type TestUser,
  type TestOrder,
} from './fixtures-factory';

const BFF = '**/api/bff';

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

// =============================================================================
// AUTH MOCK — Simulates authenticated Sanctuaire session (httpOnly cookie)
// =============================================================================

export interface MockAuthOptions {
  user?: Partial<TestUser>;
  subscribed?: boolean;
  hasOrders?: boolean;
  profileCompleted?: boolean;
  orderStatus?: TestOrder['status'];
  onboardingProgress?: {
    currentStep: number;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    data?: Record<string, unknown>;
  } | null;
}

/**
 * Sets session cookie + mocks BFF data-loading calls.
 * Call BEFORE navigating to /sanctuaire pages.
 */
export async function mockSanctuaireAuth(page: Page, options: MockAuthOptions = {}) {
  const {
    subscribed = true,
    hasOrders = true,
    profileCompleted = true,
    orderStatus,
    onboardingProgress = null,
  } = options;

  const user = createTestUser(options.user);
  const profile = createTestProfile(user.id, { profileCompleted });
  const order = hasOrders
    ? createTestOrder({ userId: user.id, email: user.email, status: orderStatus })
    : null;
  const entitlements = createTestEntitlements(subscribed);

  // httpOnly session cookie (Playwright can set httpOnly cookies).
  // Use url only (not path/domain) so it matches Playwright baseURL (127.0.0.1:3100).
  const cookieUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100';
  await page.context().addCookies([
    {
      name: 'sanctuaire_token',
      value: 'mock-jwt-token-valid',
      url: cookieUrl,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  // Session probe used by SanctuaireAuthContext bootstrap
  await page.route('**/api/auth/sanctuaire/session', async (route: Route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, { authenticated: true });
      return;
    }
    if (route.request().method() === 'POST') {
      await fulfillJson(route, { ok: true });
      return;
    }
    if (route.request().method() === 'DELETE') {
      await fulfillJson(route, { ok: true });
      return;
    }
    await route.continue();
  });

  // Magic-link request via BFF. The mock session above represents the
  // already-consumed link used by authenticated page tests.
  await page.route(`${BFF}/auth/sanctuaire-v2`, async (route: Route) => {
    await fulfillJson(route, {
      success: true,
      message: 'Si un accès existe pour cette adresse, un lien de connexion vient d’être envoyé.',
    });
  });

  await page.route(`${BFF}/users/profile`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        profile,
        stats: { totalOrders: hasOrders ? 1 : 0, completedOrders: hasOrders ? 1 : 0 },
      });
    } else {
      await fulfillJson(route, { success: true });
    }
  });

  await page.route(`${BFF}/users/entitlements`, async (route: Route) => {
    await fulfillJson(route, entitlements);
  });

  await page.route(`${BFF}/users/orders/completed`, async (route: Route) => {
    await fulfillJson(route, order ? [order] : []);
  });

  await page.route(`${BFF}/users/onboarding`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, onboardingProgress);
      return;
    }
    await fulfillJson(route, { currentStep: 1, status: 'IN_PROGRESS', data: {} });
  });

  const sub = subscribed ? createTestSubscription(user.id, 'ACTIVE') : null;
  await page.route(`${BFF}/subscriptions/status`, async (route: Route) => {
    await fulfillJson(
      route,
      sub
        ? { hasSubscription: true, subscription: sub }
        : { hasSubscription: false, subscription: null },
    );
  });

  return { user, profile, order, entitlements, subscription: sub };
}

// =============================================================================
// INSIGHTS MOCK
// =============================================================================

export interface MockInsightsOptions {
  userId?: string;
  withAudio?: boolean;
  allViewed?: boolean;
}

export async function mockInsightsApi(page: Page, options: MockInsightsOptions = {}) {
  const userId = options.userId ?? 'user-1';
  const insights = createTestInsights(userId);

  if (options.withAudio) {
    insights.forEach(
      (i) => (i.audioUrl = `https://s3.example.com/audio/${i.category.toLowerCase()}.mp3`),
    );
  }
  if (options.allViewed) {
    insights.forEach((i) => (i.viewedAt = new Date().toISOString()));
  }

  const INSIGHT_METADATA: Record<
    string,
    { label: string; description: string; icon: string; color: string }
  > = {
    SPIRITUEL: {
      label: 'Spirituel',
      description: 'Éveil, connexion au divin',
      icon: 'Sparkles',
      color: 'horizon',
    },
    RELATIONS: {
      label: 'Relations',
      description: 'Amour, famille, amitiés',
      icon: 'Heart',
      color: 'rose',
    },
    MISSION: {
      label: 'Mission',
      description: 'But de vie, vocation',
      icon: 'Compass',
      color: 'serenity',
    },
    CREATIVITE: {
      label: 'Créativité',
      description: 'Expression artistique',
      icon: 'Palette',
      color: 'orange',
    },
    EMOTIONS: {
      label: 'Émotions',
      description: 'État intérieur, guérison',
      icon: 'Cloud',
      color: 'violet',
    },
    TRAVAIL: {
      label: 'Travail',
      description: 'Carrière, projets pro',
      icon: 'Briefcase',
      color: 'emerald',
    },
    SANTE: {
      label: 'Santé',
      description: 'Bien-être, énergie vitale',
      icon: 'Activity',
      color: 'green',
    },
    FINANCE: {
      label: 'Finance',
      description: 'Prospérité, abondance',
      icon: 'Wallet',
      color: 'amber',
    },
  };

  const categories = insights.map((i) => ({
    category: i.category,
    metadata: INSIGHT_METADATA[i.category],
    insight: i,
    isNew: i.viewedAt === null,
  }));

  await page.route(`${BFF}/insights`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, { categories, metadata: INSIGHT_METADATA });
    } else {
      await route.continue();
    }
  });

  await page.route(/\/api\/bff\/insights\/\w+\/view/, async (route: Route) => {
    if (route.request().method() === 'PATCH') {
      await fulfillJson(route, { success: true, viewedAt: new Date().toISOString() });
    } else {
      await route.continue();
    }
  });

  return { insights, categories };
}

// =============================================================================
// SPIRITUAL PATH MOCK
// =============================================================================

export async function mockSpiritualPathApi(page: Page, userId: string = 'user-1') {
  const path = createTestSpiritualPath(userId);

  await page.route(`${BFF}/client/spiritual-path`, async (route: Route) => {
    await fulfillJson(route, { exists: true, ...path });
  });

  await page.route(
    /\/api\/bff\/client\/spiritual-path\/steps\/[\w-]+\/complete/,
    async (route: Route) => {
      await fulfillJson(route, {
        success: true,
        step: { isCompleted: true, completedAt: new Date().toISOString() },
      });
    },
  );

  return path;
}

// =============================================================================
// CHAT MOCK
// =============================================================================

export interface MockChatOptions {
  subscribed?: boolean;
  messagesUsed?: number;
}

export async function mockChatApi(page: Page, options: MockChatOptions = {}) {
  const { subscribed = true, messagesUsed = 0 } = options;

  await page.route(`${BFF}/client/chat/quota`, async (route: Route) => {
    await fulfillJson(route, {
      hasAccess: true,
      isUnlimited: subscribed,
      quota: subscribed ? -1 : 3,
      used: messagesUsed,
      remaining: subscribed ? -1 : Math.max(0, 3 - messagesUsed),
    });
  });

  await page.route(`${BFF}/client/chat/history`, async (route: Route) => {
    await fulfillJson(route, { sessionId: null, messages: [] });
  });

  await page.route(`${BFF}/client/chat`, async (route: Route) => {
    if (route.request().method() === 'POST') {
      if (!subscribed && messagesUsed >= 3) {
        await fulfillJson(
          route,
          { error: 'QUOTA_EXCEEDED', message: 'Quota de messages dépassé.' },
          403,
        );
      } else {
        await fulfillJson(route, {
          response: "Votre question touche à l'essence même de votre lecture.",
          sessionId: 'session-mock-1',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      await route.continue();
    }
  });
}

// =============================================================================
// DREAMS MOCK
// =============================================================================

export async function mockDreamsApi(page: Page, userId: string = 'user-1') {
  const dream1 = createTestDream(userId);
  const dream2 = createTestDream(userId, {
    id: 'dream-2',
    content: "J'étais sur un bateau naviguant vers une île mystérieuse.",
    emotion: 'joie',
    symbols: ['eau', 'île', 'voyage'],
  });

  await page.route(`${BFF}/dreams`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await fulfillJson(route, [dream1, dream2]);
    } else if (route.request().method() === 'POST') {
      await fulfillJson(
        route,
        createTestDream(userId, {
          id: `dream-new-${Date.now()}`,
          content: 'Nouveau rêve créé.',
          interpretation: {
            summary: 'Interprétation fraîche de votre rêve.',
            symbols: ['lumière'],
            guidance: 'Suivez votre intuition.',
          },
        }),
        201,
      );
    }
  });

  return [dream1, dream2];
}

// =============================================================================
// DRAWS / READINGS MOCK
// =============================================================================

export async function mockDrawsApi(page: Page, userId: string = 'user-1') {
  const order1 = createTestOrder({ userId, status: 'COMPLETED' });
  const order2 = createTestOrder({ userId, status: 'PROCESSING' });

  await page.route(`${BFF}/client/readings`, async (route: Route) => {
    await fulfillJson(route, {
      readings: [
        {
          ...order1,
          title: "Lecture d'Âme",
          archetype: 'Le Sage',
          intention: 'Une lecture validée pour accompagner votre réflexion.',
          assets: { pdf: `/api/readings/${order1.orderNumber}/file`, audio: null },
        },
      ],
      pending: [
        {
          ...order2,
          title: "Lecture d'Âme",
          archetype: null,
          assets: { pdf: null, audio: null },
        },
      ],
    });
  });

  await page.route(/\/api\/bff\/readings\/[\w-]+\/download/, async (route: Route) => {
    await fulfillJson(route, { url: 'https://s3.example.com/readings/test-reading.pdf' });
  });

  return [order1, order2];
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT MOCK
// =============================================================================

export async function mockSubscriptionManagementApi(page: Page) {
  await page.route(`${BFF}/subscriptions/cancel`, async (route: Route) => {
    await fulfillJson(route, { status: 'ACTIVE', cancelAtPeriodEnd: true });
  });

  await page.route(`${BFF}/subscriptions/resume`, async (route: Route) => {
    await fulfillJson(route, { status: 'ACTIVE', cancelAtPeriodEnd: false });
  });
}

// =============================================================================
// FULL MOCK — Combines all mocks for comprehensive E2E tests
// =============================================================================

export async function mockFullSanctuaire(page: Page, options: MockAuthOptions = {}) {
  const auth = await mockSanctuaireAuth(page, options);
  await mockInsightsApi(page, { userId: auth.user.id, withAudio: true });
  await mockSpiritualPathApi(page, auth.user.id);
  await mockChatApi(page, { subscribed: options.subscribed ?? true });
  await mockDreamsApi(page, auth.user.id);
  await mockDrawsApi(page, auth.user.id);
  await mockSubscriptionManagementApi(page);
  return auth;
}
