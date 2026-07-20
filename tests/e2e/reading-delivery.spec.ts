import { expect, test } from '@playwright/test';
import { mockSanctuaireAuth } from '../helpers/api-mock';

const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
);

test.describe('Sanctuaire — livraison de lecture validée', () => {
  test('makes the sealed reading, authenticated PDF and audio available to its client', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      class MockAudio extends EventTarget {
        public currentTime = 0;
        public duration = 120;
        public ended = false;
        public paused = true;
        public preload = '';
        public volume = 1;
        public playbackRate = 1;

        constructor(public src: string) {
          super();
          const sources = (window as unknown as { __lumiraAudioSources?: string[] })
            .__lumiraAudioSources;
          (window as unknown as { __lumiraAudioSources: string[] }).__lumiraAudioSources = [
            ...(sources || []),
            src,
          ];
        }

        play() {
          this.paused = false;
          return Promise.resolve();
        }

        pause() {
          this.paused = true;
        }
      }

      Object.defineProperty(window, 'Audio', { configurable: true, value: MockAudio });
    });
    await mockSanctuaireAuth(page, { profileCompleted: true, orderStatus: 'COMPLETED' });

    await page.route('**/api/bff/client/readings', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          readings: [
            {
              id: 'order-1',
              orderNumber: 'LUM-SEALED-001',
              title: "Lecture d'Âme — version validée",
              status: 'COMPLETED',
              deliveredAt: '2026-07-20T12:00:00.000Z',
              assets: {
                pdf: '/api/readings/LUM-SEALED-001/download',
                audio: '/api/readings/audio/LUM-SEALED-001/v1-immutable.mp3',
              },
            },
          ],
          pending: [],
        }),
      });
    });
    await page.route('**/api/bff/readings/LUM-SEALED-001/file', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF_BYTES });
    });

    await page.goto('/sanctuaire');
    await expect(page.getByRole('heading', { name: 'Votre lecture est prête' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Lire', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lire l’audio' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Télécharger le PDF' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('s3://');
    await expect(page.locator('body')).not.toContainText('X-Amz-Signature');

    await page.getByRole('button', { name: 'Lire l’audio' }).click();
    const audioSources = await page.evaluate(
      () => (window as unknown as { __lumiraAudioSources?: string[] }).__lumiraAudioSources || [],
    );
    expect(audioSources).toContain('/api/bff/readings/audio/LUM-SEALED-001/v1-immutable.mp3');
    expect(audioSources.join(' ')).not.toContain('s3://');

    const pdfRequest = page.waitForRequest('**/api/bff/readings/LUM-SEALED-001/file');
    await page.getByRole('button', { name: 'Lire', exact: true }).click();
    await pdfRequest;
    await expect(
      page.getByRole('dialog', { name: "Lecture d'Âme — version validée" }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Fermer' }).click();
  });
});
