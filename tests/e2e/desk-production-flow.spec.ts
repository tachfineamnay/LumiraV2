import { expect, test } from '@playwright/test';

const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
  'base64',
);

const EXPERT = {
  id: 'expert-1',
  email: 'expert@example.test',
  name: 'Expert Test',
  role: 'EXPERT',
  isActive: true,
};

type Phase = 'READY' | 'QUEUED' | 'RUNNING' | 'AWAITING_REVIEW' | 'DELIVERED';

test.describe('Desk — production depuis le dossier scellé', () => {
  test('keeps a queued job active across navigation, then seals and delivers the expert-reviewed version', async ({
    page,
  }) => {
    let phase: Phase = 'READY';
    let audioStarted = false;
    let finalizedContent = '';

    const statusForPhase = () => {
      if (phase === 'READY') return 'PAID';
      if (phase === 'QUEUED' || phase === 'RUNNING') return 'PROCESSING';
      if (phase === 'AWAITING_REVIEW') return 'AWAITING_VALIDATION';
      return 'COMPLETED';
    };

    const order = () => ({
      id: 'order-1',
      orderNumber: 'LUM-SEALED-001',
      userId: 'client-1',
      status: statusForPhase(),
      level: 2,
      amount: 97,
      revisionCount: 1,
      createdAt: '2026-07-20T10:00:00.000Z',
      updatedAt: '2026-07-20T10:00:00.000Z',
      deliveredAt: phase === 'DELIVERED' ? '2026-07-20T12:00:00.000Z' : null,
      generatedContent:
        phase === 'AWAITING_REVIEW' || phase === 'DELIVERED'
          ? {
              pdf_content: {
                introduction: 'Lecture générée à partir du dossier scellé.',
                archetype_reveal: 'La Gardienne',
                sections: [
                  { domain: 'Mission', title: 'Mission', content: 'Un contenu à réviser.' },
                ],
                conclusion: 'Une conclusion accompagnante.',
              },
              synthesis: { archetype: 'La Gardienne' },
              timeline: [],
            }
          : null,
      clientInputs: {
        readingIntake: {
          sealedAt: '2026-07-20T09:30:00.000Z',
          sealedBy: 'CLIENT',
          contentHash: 'a'.repeat(64),
          profile: {
            birthDate: '1990-06-15',
            birthTime: '09:45',
            birthPlace: 'Lyon, France',
            specificQuestion: 'Comment traverser ce changement ?',
            objective: 'Retrouver un cap serein',
            facePhotoUrl: 's3://onboarding/client-1/face.jpg',
            palmPhotoUrl: 's3://onboarding/client-1/palm.jpg',
            highs: 'Créativité',
            lows: 'Doute',
          },
        },
      },
      user: {
        id: 'client-1',
        firstName: 'Marie',
        lastName: 'Dubois',
        email: 'marie@example.test',
        profile: {
          id: 'profile-1',
          birthDate: '1980-01-01',
          birthPlace: 'Profil mutable — ne pas utiliser',
          specificQuestion: 'Profil mutable — ne pas utiliser',
          facePhotoUrl: 's3://onboarding/client-1/face.jpg',
          palmPhotoUrl: 's3://onboarding/client-1/palm.jpg',
        },
      },
      files: [],
    });

    const job = () =>
      phase === 'QUEUED' || phase === 'RUNNING'
        ? {
            id: 'job-reading-1',
            type: 'READING_GENERATION',
            status: phase,
            stage: phase === 'QUEUED' ? 'QUEUED' : 'GENERATING_READING',
            queuedAt: '2026-07-20T10:05:00.000Z',
            heartbeatAt: '2026-07-20T10:06:00.000Z',
            attempts: 1,
            maxAttempts: 3,
          }
        : null;

    const controlCenter = () => {
      const activeJob = job();
      return {
        order: {
          id: 'order-1',
          orderNumber: 'LUM-SEALED-001',
          status: statusForPhase(),
          user: { firstName: 'Marie', lastName: 'Dubois' },
        },
        workflowState:
          phase === 'READY'
            ? 'READY_FOR_PRODUCTION'
            : phase === 'QUEUED' || phase === 'RUNNING'
              ? 'IN_PRODUCTION'
              : phase === 'AWAITING_REVIEW'
                ? 'AWAITING_REVIEW'
                : audioStarted
                  ? 'DELIVERED'
                  : 'READY_FOR_DELIVERY',
        checklist: {
          paymentConfirmed: true,
          profileValidated: true,
          birthData: true,
          facePhoto: true,
          palmPhoto: true,
          consent: true,
        },
        production: activeJob,
        productionHistory: activeJob ? [activeJob] : [],
        assets: {
          pdf:
            phase === 'DELIVERED'
              ? {
                  status: 'READY',
                  storageKey: 'readings/LUM-SEALED-001/v1-aaaaaaaa.pdf',
                  contentHash: 'a'.repeat(64),
                  readingVersionId: 'version-1',
                }
              : { status: 'MISSING' },
          audio: audioStarted ? { status: 'READY', fileId: 'audio-1' } : { status: 'MISSING' },
          email: phase === 'DELIVERED' ? { status: 'SENT', attempts: 1 } : { status: 'PENDING' },
        },
        latestVersion:
          phase === 'AWAITING_REVIEW' || phase === 'DELIVERED'
            ? { id: 'version-1', version: 1, status: 'SEALED', contentHash: 'a'.repeat(64) }
            : null,
      };
    };

    await page.addInitScript((expert) => {
      localStorage.setItem('expert_token', 'mock-expert-token');
      localStorage.setItem('expert_user', JSON.stringify(expert));
    }, EXPERT);
    await page.route('**/api/expert/verify', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ valid: true, expert: EXPERT }),
      });
    });
    await page.route('**/api/expert/clients/client-1/photos/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/jpeg', body: TINY_JPEG });
    });
    await page.route('**/api/expert/production/summary', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          queued: phase === 'QUEUED' ? 1 : 0,
          running: phase === 'RUNNING' ? 1 : 0,
          failed: 0,
          awaitingReview: phase === 'AWAITING_REVIEW' ? 1 : 0,
          audioMissing: phase === 'DELIVERED' && !audioStarted ? 1 : 0,
        }),
      });
    });
    await page.route('**/api/expert/production/jobs**', async (route) => {
      const activeJob = job();
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: activeJob
            ? [
                {
                  ...activeJob,
                  orderId: 'order-1',
                  orderNumber: 'LUM-SEALED-001',
                  user: { firstName: 'Marie', lastName: 'Dubois', email: 'marie@example.test' },
                },
              ]
            : [],
        }),
      });
    });
    await page.route('**/api/expert/orders/order-1**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;

      if (pathname.endsWith('/control-center')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(controlCenter()),
        });
        return;
      }
      if (pathname.endsWith('/versions')) {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            versions:
              phase === 'DELIVERED'
                ? [
                    {
                      content: finalizedContent,
                      timestamp: '2026-07-20T12:00:00.000Z',
                      action: 'SEALED',
                    },
                  ]
                : [],
          }),
        });
        return;
      }
      if (pathname.endsWith('/jobs/reading') && request.method() === 'POST') {
        phase = 'QUEUED';
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'job-reading-1', status: 'QUEUED' }),
        });
        return;
      }
      if (pathname.endsWith('/jobs/audio') && request.method() === 'POST') {
        audioStarted = true;
        await route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'job-audio-1', status: 'QUEUED' }),
        });
        return;
      }
      if (pathname.endsWith('/finalize') && request.method() === 'POST') {
        finalizedContent = (request.postDataJSON() as { finalContent: string }).finalContent;
        phase = 'DELIVERED';
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(order()) });
        return;
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(order()) });
    });

    await page.goto('/admin/studio/order-1');
    await expect(page.getByRole('heading', { name: 'Marie Dubois' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('SEALED_INTAKE')).toBeVisible();
    await expect(page.getByText('Lyon, France')).toBeVisible();
    await expect(page.getByText('Profil mutable — ne pas utiliser')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Visage' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Paume' })).toBeVisible();
    await expect(page.locator('img[src^="s3://"]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Lancer la production' }).click();
    await expect(page.getByText('Production serveur en cours')).toBeVisible();
    await expect(page.getByText('En attente du moteur')).toBeVisible();

    // The worker state is durable: navigating away does not cancel the queued job.
    await page.goto('/admin/production');
    await expect(page.getByRole('heading', { name: 'Centre de production' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('LUM-SEALED-001')).toBeVisible();
    await expect(page.getByText('En attente du moteur')).toBeVisible();

    phase = 'RUNNING';
    await page.goto('/admin/studio/order-1');
    await expect(page.getByText('Génération de la lecture')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/L.Oracle crée la lecture/)).toBeVisible();

    phase = 'AWAITING_REVIEW';
    await page.reload();
    await expect(page.getByText('Lecture prête à réviser')).toBeVisible({ timeout: 20_000 });
    const editor = page.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible();
    await editor.fill('Version révisée et validée par l’expert.');
    await page.getByRole('button', { name: /sceller et envoyer/i }).click();
    await expect(page.getByRole('heading', { name: /Confirmer l.envoi/ })).toBeVisible();
    await page.getByRole('button', { name: 'Confirmer et envoyer' }).click();
    await expect(page).toHaveURL(/\/admin\/board/, { timeout: 20_000 });
    expect(finalizedContent).toContain('Version révisée et validée par l’expert.');

    await page.goto('/admin/studio/order-1');
    await expect(page.getByText('PDF prêt · audio à produire')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Générer l’audio' }).click();
    await expect(page.getByText('Lecture et assets disponibles')).toBeVisible();
    await page.getByRole('button', { name: 'Afficher le contrôle détaillé' }).click();
    await expect(page.getByText('E-mail')).toBeVisible();
    await expect(page.getByText('Envoyé')).toBeVisible();
  });

  test('redirects an unauthenticated user away from the expert Desk', async ({ page }) => {
    await page.goto('/admin/studio/order-1');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 20_000 });
  });
});
