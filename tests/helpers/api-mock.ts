/**
 * Playwright API Mocking helpers for Sanctuaire E2E tests.
 * Intercepts network requests to simulate backend responses.
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
    createTestChatMessages,
    createTestDream,
    type TestUser,
    type TestSubscription,
    type InsightCategory,
} from './fixtures-factory';

const API_BASE = 'http://localhost:3001/api';

// =============================================================================
// AUTH MOCK — Simulates authenticated Sanctuaire session
// =============================================================================

export interface MockAuthOptions {
    user?: Partial<TestUser>;
    subscribed?: boolean;
    hasOrders?: boolean;
    profileCompleted?: boolean;
}

/**
 * Injects auth token + mocks all initial data-loading API calls.
 * Call BEFORE navigating to /sanctuaire pages.
 */
export async function mockSanctuaireAuth(page: Page, options: MockAuthOptions = {}) {
    const { subscribed = true, hasOrders = true, profileCompleted = true } = options;

    const user = createTestUser(options.user);
    const profile = createTestProfile(user.id, { profileCompleted });
    const order = hasOrders ? createTestOrder({ userId: user.id, email: user.email }) : null;
    const entitlements = createTestEntitlements(subscribed);

    // Inject token before navigation
    await page.addInitScript(() => {
        localStorage.setItem('sanctuaire_token', 'mock-jwt-token-valid');
    });

    // Mock: POST /auth/sanctuaire-v2 (login)
    await page.route(`${API_BASE}/auth/sanctuaire-v2`, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                token: 'mock-jwt-token-valid',
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    level: entitlements.highestLevel,
                },
            }),
        });
    });

    // Mock: GET /users/profile
    await page.route(`${API_BASE}/users/profile`, async (route: Route) => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    profile,
                    stats: { totalOrders: hasOrders ? 1 : 0, completedOrders: hasOrders ? 1 : 0 },
                }),
            });
        } else {
            await route.continue();
        }
    });

    // Mock: GET /users/entitlements
    await page.route(`${API_BASE}/users/entitlements`, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(entitlements),
        });
    });

    // Mock: GET /users/orders/completed
    await page.route(`${API_BASE}/users/orders/completed`, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(order ? [order] : []),
        });
    });

    // Mock: GET /subscriptions/status
    const sub = subscribed ? createTestSubscription(user.id, 'ACTIVE') : null;
    await page.route(`${API_BASE}/subscriptions/status`, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
                sub
                    ? { hasSubscription: true, subscription: sub }
                    : { hasSubscription: false, subscription: null },
            ),
        });
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
        insights.forEach((i) => (i.audioUrl = `https://s3.example.com/audio/${i.category.toLowerCase()}.mp3`));
    }
    if (options.allViewed) {
        insights.forEach((i) => (i.viewedAt = new Date().toISOString()));
    }

    const INSIGHT_METADATA: Record<string, { label: string; description: string; icon: string; color: string }> = {
        SPIRITUEL: { label: 'Spirituel', description: 'Éveil, connexion au divin', icon: 'Sparkles', color: 'horizon' },
        RELATIONS: { label: 'Relations', description: 'Amour, famille, amitiés', icon: 'Heart', color: 'rose' },
        MISSION: { label: 'Mission', description: 'But de vie, vocation', icon: 'Compass', color: 'serenity' },
        CREATIVITE: { label: 'Créativité', description: 'Expression artistique', icon: 'Palette', color: 'orange' },
        EMOTIONS: { label: 'Émotions', description: 'État intérieur, guérison', icon: 'Cloud', color: 'violet' },
        TRAVAIL: { label: 'Travail', description: 'Carrière, projets pro', icon: 'Briefcase', color: 'emerald' },
        SANTE: { label: 'Santé', description: 'Bien-être, énergie vitale', icon: 'Activity', color: 'green' },
        FINANCE: { label: 'Finance', description: 'Prospérité, abondance', icon: 'Wallet', color: 'amber' },
    };

    const categories = insights.map((i) => ({
        category: i.category,
        metadata: INSIGHT_METADATA[i.category],
        insight: i,
        isNew: i.viewedAt === null,
    }));

    // Mock: GET /insights
    await page.route(`${API_BASE}/insights`, async (route: Route) => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ categories, metadata: INSIGHT_METADATA }),
            });
        } else {
            await route.continue();
        }
    });

    // Mock: PATCH /insights/:category/view
    await page.route(/\/api\/insights\/\w+\/view/, async (route: Route) => {
        if (route.request().method() === 'PATCH') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, viewedAt: new Date().toISOString() }),
            });
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

    // Mock: GET /client/spiritual-path
    await page.route(`${API_BASE}/client/spiritual-path`, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                exists: true,
                ...path,
            }),
        });
    });

    // Mock: POST /client/spiritual-path/steps/:stepId/complete
    await page.route(/\/api\/client\/spiritual-path\/steps\/[\w-]+\/complete/, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, step: { isCompleted: true, completedAt: new Date().toISOString() } }),
        });
    });

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

    // Mock: GET /client/chat/quota
    await page.route(`${API_BASE}/client/chat/quota`, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                hasAccess: true,
                isUnlimited: subscribed,
                quota: subscribed ? -1 : 3,
                used: messagesUsed,
                remaining: subscribed ? -1 : Math.max(0, 3 - messagesUsed),
            }),
        });
    });

    // Mock: POST /client/chat
    await page.route(`${API_BASE}/client/chat`, async (route: Route) => {
        if (route.request().method() === 'POST') {
            if (!subscribed && messagesUsed >= 3) {
                await route.fulfill({
                    status: 403,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'QUOTA_EXCEEDED', message: 'Quota de messages dépassé.' }),
                });
            } else {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Chère âme, votre question touche à l\'essence même de votre chemin spirituel.',
                        role: 'assistant',
                        sessionId: 'session-mock-1',
                    }),
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
        content: 'J\'étais sur un bateau naviguant vers une île mystérieuse.',
        emotion: 'joie',
        symbols: ['eau', 'île', 'voyage'],
    });

    // Mock: GET /dreams
    await page.route(`${API_BASE}/dreams`, async (route: Route) => {
        if (route.request().method() === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([dream1, dream2]),
            });
        } else if (route.request().method() === 'POST') {
            // POST /dreams — create new dream
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify(
                    createTestDream(userId, {
                        id: `dream-new-${Date.now()}`,
                        content: 'Nouveau rêve créé.',
                        interpretation: {
                            summary: 'Interprétation fraîche de votre rêve.',
                            symbols: ['lumière'],
                            guidance: 'Suivez votre intuition.',
                        },
                    }),
                ),
            });
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

    // Mock: GET /users/orders/completed (also used by draws page)
    // Already mocked via mockSanctuaireAuth — this adds reading-specific routes

    // Mock: GET /readings/:orderNumber/download
    await page.route(/\/api\/readings\/[\w-]+\/download/, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ url: 'https://s3.example.com/readings/test-reading.pdf' }),
        });
    });

    return [order1, order2];
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT MOCK
// =============================================================================

export async function mockSubscriptionManagementApi(page: Page, userId: string = 'user-1') {
    // Mock: POST /subscriptions/cancel
    await page.route(`${API_BASE}/subscriptions/cancel`, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ACTIVE', cancelAtPeriodEnd: true }),
        });
    });

    // Mock: POST /subscriptions/resume
    await page.route(`${API_BASE}/subscriptions/resume`, async (route: Route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'ACTIVE', cancelAtPeriodEnd: false }),
        });
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
    await mockSubscriptionManagementApi(page, auth.user.id);
    return auth;
}
