/** E2E — Desk expert private photo display (blob auth, no s3:// src). */
import { test, expect } from '@playwright/test';

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
  'base64',
);

const EXPERT_USER = {
  id: 'expert-1',
  email: 'expert@example.test',
  name: 'Expert Test',
  role: 'EXPERT',
  isActive: true,
};

function buildClientFull(overrides: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  facePhotoUrl?: string | null;
  palmPhotoUrl?: string | null;
}) {
  const { id, firstName, lastName, email, facePhotoUrl = null, palmPhotoUrl = null } = overrides;

  return {
    id,
    refId: `REF-${id}`,
    firstName,
    lastName,
    email,
    phone: null,
    status: 'ACTIVE',
    crmNotes: '',
    crmTags: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    profile: {
      id: `profile-${id}`,
      facePhotoUrl,
      palmPhotoUrl,
      isComplete: true,
      profileCompleted: true,
    },
    orders: [],
    dreams: [],
    chatSessions: [],
    insights: [],
    stats: {
      totalOrders: 1,
      completedOrders: 1,
      totalSpent: 97,
      totalSpentFormatted: '97 €',
      favoriteLevel: null,
      highestLevel: null,
      highestLevelNumber: 1,
      lastOrderAt: null,
      isVip: false,
      memberSince: '2025-01-01T00:00:00.000Z',
      engagementScore: 50,
      stepsCompleted: 0,
      stepsTotal: 0,
      insightsViewed: 0,
      insightsTotal: 0,
      chatMessagesTotal: 0,
      dreamsCount: 0,
      daysSinceLastActivity: 2,
      lastActivityType: 'order',
      audioCoverage: 0,
      profileCompleteness: facePhotoUrl || palmPhotoUrl ? 80 : 40,
      archetype: null,
      subscriptionStatus: 'none',
      subscriptionDaysLeft: null,
      upsellHistory: [],
    },
  };
}

function buildControlCenter(
  clientId: string,
  readiness: {
    facePhoto: boolean;
    palmPhoto: boolean;
    profileCompleted: boolean;
  },
) {
  return {
    client: {
      id: clientId,
      refId: `REF-${clientId}`,
      firstName: 'Client',
      lastName: 'Test',
      email: 'client@example.test',
      access: 'LIFETIME',
    },
    readiness: {
      ...readiness,
      birthData: true,
      activeConsent: true,
      onboardingStatus: 'COMPLETED',
    },
    summary: {
      totalReadings: 0,
      deliveredReadings: 0,
      openReadings: 0,
      incidents: 0,
      conversations: 0,
      guidanceRequests: 0,
      openGuidanceRequests: 0,
      unreadGuidanceForExpert: 0,
      unreadNotifications: 0,
    },
    readings: [],
    conversations: [],
    timeline: [],
  };
}

test.describe('Desk — photos privées client', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((expert) => {
      localStorage.setItem('expert_token', 'mock-expert-token');
      localStorage.setItem('expert_user', JSON.stringify(expert));
    }, EXPERT_USER);

    await page.route('**/api/expert/verify', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ valid: true, expert: EXPERT_USER }),
      });
    });
  });

  test('renders Client 360 biometric photos from authenticated blob routes', async ({ page }) => {
    await page.route('**/api/expert/clients/client-1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/photos/face')) {
        await route.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG });
        return;
      }
      if (url.includes('/photos/palm')) {
        await route.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG });
        return;
      }
      if (url.includes('/full')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(
            buildClientFull({
              id: 'client-1',
              firstName: 'Marie',
              lastName: 'Dubois',
              email: 'marie@example.test',
              facePhotoUrl: 's3://onboarding/client-1/face.jpg',
              palmPhotoUrl: 's3://onboarding/client-1/palm.jpg',
            }),
          ),
        });
        return;
      }
      if (url.includes('/control-center')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(
            buildControlCenter('client-1', {
              profileCompleted: true,
              facePhoto: true,
              palmPhoto: true,
            }),
          ),
        });
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto('/admin/clients/client-1');
    await expect(page.getByText('Dossier client')).toBeVisible({ timeout: 20_000 });

    // Profil is the default tab; ensure gallery is visible.
    await expect(page.getByText('Galerie Biométrique')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Visage' }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('img', { name: /paume/i }).first()).toBeVisible();
    await expect(page.locator('img[src^="s3://"]')).toHaveCount(0);
    await expect(page.locator('img[src^="blob:"]')).not.toHaveCount(0);

    // Lightbox from biometric gallery
    await page.getByRole('button', { name: 'Visage' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('shows empty state when expert photo route returns 404', async ({ page }) => {
    await page.route('**/api/expert/clients/client-2/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/photos/face')) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        return;
      }
      if (url.includes('/full')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(
            buildClientFull({
              id: 'client-2',
              firstName: 'Paul',
              lastName: 'Martin',
              email: 'paul@example.test',
              facePhotoUrl: 's3://onboarding/client-2/face.jpg',
              palmPhotoUrl: null,
            }),
          ),
        });
        return;
      }
      if (url.includes('/control-center')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(
            buildControlCenter('client-2', {
              profileCompleted: true,
              facePhoto: false,
              palmPhoto: false,
            }),
          ),
        });
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto('/admin/clients/client-2');
    await expect(page.getByText('Dossier client')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Aucune photo').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('img[src^="s3://"]')).toHaveCount(0);
  });

  test('Studio private photos switch client without stale blob and avoid s3:// src', async ({
    page,
  }) => {
    const orderPayload = (
      orderId: string,
      clientId: string,
      faceUrl: string | null,
      palmUrl: string | null,
    ) => ({
      id: orderId,
      orderNumber: `ORD-${clientId}`,
      userId: clientId,
      status: 'PAID',
      level: 1,
      amount: 97,
      revisionCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      user: {
        id: clientId,
        firstName: clientId === 'client-a' ? 'Alice' : 'Bruno',
        lastName: 'Test',
        email: `${clientId}@example.test`,
        profile: {
          id: `profile-${clientId}`,
          facePhotoUrl: faceUrl,
          palmPhotoUrl: palmUrl,
        },
      },
      files: [
        // Historical HTTP OrderFile that would duplicate profile face — must be filtered
        {
          id: `file-face-dup-${clientId}`,
          type: 'FACE_PHOTO',
          url: 'https://cdn.example.test/legacy-face.jpg',
          filename: 'legacy-face.jpg',
        },
      ],
    });

    await page.route('**/api/expert/orders/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/versions')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ versions: [] }),
        });
        return;
      }
      if (url.includes('/control-center')) {
        const isOrderB = url.includes('/orders/order-b');
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            order: {
              id: isOrderB ? 'order-b' : 'order-a',
              orderNumber: isOrderB ? 'ORD-client-b' : 'ORD-client-a',
              status: 'PAID',
              user: {
                firstName: isOrderB ? 'Bruno' : 'Alice',
                lastName: 'Test',
              },
            },
            workflowState: 'READY_FOR_PRODUCTION',
            checklist: {
              paymentConfirmed: true,
              profileValidated: true,
              birthData: true,
              facePhoto: true,
              palmPhoto: !isOrderB,
              consent: true,
            },
            production: null,
            productionHistory: [],
            assets: {
              pdf: { status: 'MISSING' },
              audio: { status: 'MISSING' },
              email: { status: 'PENDING' },
            },
            latestVersion: null,
          }),
        });
        return;
      }
      if (url.match(/\/orders\/order-a(?:\?|$)/) || url.endsWith('/orders/order-a')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(
            orderPayload(
              'order-a',
              'client-a',
              's3://onboarding/client-a/face.jpg',
              's3://onboarding/client-a/palm.jpg',
            ),
          ),
        });
        return;
      }
      if (url.match(/\/orders\/order-b(?:\?|$)/) || url.endsWith('/orders/order-b')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(
            orderPayload('order-b', 'client-b', 's3://onboarding/client-b/face.jpg', null),
          ),
        });
        return;
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({}) });
    });

    await page.route('**/api/expert/clients/client-a/photos/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG });
    });
    await page.route('**/api/expert/clients/client-b/photos/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG });
    });

    await page.goto('/admin/studio/order-a');
    await expect(page.getByRole('heading', { name: /Alice Test/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('img[src^="s3://"]')).toHaveCount(0);
    await expect(page.locator('img[src^="blob:"]').first()).toBeVisible({ timeout: 20_000 });
    const firstBlobSrc = await page.locator('img[src^="blob:"]').first().getAttribute('src');

    // No duplicate legacy FACE_PHOTO http img when profile face exists
    await expect(page.locator('img[src="https://cdn.example.test/legacy-face.jpg"]')).toHaveCount(
      0,
    );

    // Switch to another order/client
    await page.goto('/admin/studio/order-b');
    await expect(page.getByRole('heading', { name: /Bruno Test/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('img[src^="s3://"]')).toHaveCount(0);
    await expect(page.locator('img[src^="blob:"]').first()).toBeVisible({ timeout: 20_000 });
    const secondBlobSrc = await page.locator('img[src^="blob:"]').first().getAttribute('src');
    expect(secondBlobSrc).toBeTruthy();
    // Object URL must be recreated for the new client (not the previous blob URL)
    expect(secondBlobSrc).not.toBe(firstBlobSrc);
  });
});
