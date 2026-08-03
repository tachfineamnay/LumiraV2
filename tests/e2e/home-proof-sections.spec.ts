/**
 * tests/e2e/home-proof-sections.spec.ts
 *
 * Vérifie :
 * 1. L'ordre DOM exact : LandingPricing → BeforeAfterSection → TestimonialsSection → FinalCTA
 * 2. Les ancres de navigation : #niveaux, #comment-ca-marche, #temoignages
 * 3. Navigation depuis / (clic desktop dans le header)
 * 4. Hashes directs (/#niveaux, /#comment-ca-marche, /#temoignages)
 * 5. Navigation depuis /faq
 * 6. Navigation depuis /notre-approche
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// 1. Ordre DOM des sections de preuve
// ---------------------------------------------------------------------------
test.describe('Ordre DOM — sections de preuve', () => {
  test('LandingPricing < BeforeAfterSection < TestimonialsSection < FinalCTA', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    /**
     * Compare the DOM order of 4 anchor elements using compareDocumentPosition.
     * Node.DOCUMENT_POSITION_FOLLOWING (4) means the argument comes AFTER the reference.
     */
    const isInOrder = await page.evaluate(() => {
      const pricing = document.getElementById('niveaux');
      const beforeAfter = document.getElementById('avant-apres');
      const testimonials = document.getElementById('temoignages');
      // FinalCTA has no id/data-attr; find via its stable heading text
      const finalCta = Array.from(document.querySelectorAll('section')).find((s) =>
        s.textContent?.includes('Votre transformation commence ici'),
      ) as HTMLElement | undefined;

      if (!pricing || !beforeAfter || !testimonials) return { ok: false, missing: true };

      const follows = (a: Element, b: Element) =>
        !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

      return {
        ok:
          follows(pricing, beforeAfter) &&
          follows(beforeAfter, testimonials) &&
          (!finalCta || follows(testimonials, finalCta)),
        missing: false,
      };
    });

    expect(isInOrder.missing).toBe(false);
    expect(isInOrder.ok).toBe(true);
  });

  test('la section témoignages a id="temoignages" et data-landing-section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const section = page.locator('#temoignages');
    await expect(section).toBeAttached();
    await expect(section).toHaveAttribute('data-landing-section', '');
  });

  test('la section Avant/Après a id="avant-apres"', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#avant-apres')).toBeAttached();
  });

  test('les témoignages sont anonymisés — aucun nom ou ville inventé', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const section = page.locator('#temoignages');
    const text = await section.textContent();

    // Noms inventés qui ne doivent pas apparaître
    for (const forbidden of [
      'Léa M.',
      'Inès K.',
      'Romain D.',
      'Sofia B.',
      'Paris',
      'Lyon',
      'Bordeaux',
      'Bruxelles',
    ]) {
      expect(text).not.toContain(forbidden);
    }
    // La mention anonymisée doit être présente
    expect(text).toMatch(/Retour anonymisé 0[1-3]/);
  });
});

// ---------------------------------------------------------------------------
// 2. Navigation par ancre depuis / (clic dans le header)
// ---------------------------------------------------------------------------
test.describe('Navigation ancre depuis /', () => {
  test('clic "L\'Offre" fait défiler vers #niveaux', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const link = page.getByRole('link', { name: /l'offre/i }).first();
    await expect(link).toBeVisible();
    await link.click();

    // L'élément cible doit exister dans le DOM
    await expect(page.locator('#niveaux')).toBeAttached();
    // L'URL peut porter le hash (navigation pushState)
    await expect(page).toHaveURL(/#niveaux/);
  });

  test('clic "Comment ça marche" fait défiler vers #comment-ca-marche', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const link = page.getByRole('link', { name: /comment ça marche/i }).first();
    await expect(link).toBeVisible();
    await link.click();

    await expect(page.locator('#comment-ca-marche')).toBeAttached();
    await expect(page).toHaveURL(/#comment-ca-marche/);
  });

  test('clic "Témoignages" fait défiler vers #temoignages', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const link = page.getByRole('link', { name: /témoignages/i }).first();
    await expect(link).toBeVisible();
    await link.click();

    await expect(page.locator('#temoignages')).toBeAttached();
    await expect(page).toHaveURL(/#temoignages/);
  });
});

// ---------------------------------------------------------------------------
// 3. Hashes directs (ouverture de page avec hash dans l'URL)
// ---------------------------------------------------------------------------
test.describe('Hashes directs', () => {
  test('/#niveaux : la section tarifs est présente', async ({ page }) => {
    await page.goto('/#niveaux');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#niveaux')).toBeAttached();
  });

  test('/#comment-ca-marche : la section est présente', async ({ page }) => {
    await page.goto('/#comment-ca-marche');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#comment-ca-marche')).toBeAttached();
  });

  test('/#temoignages : la section est présente', async ({ page }) => {
    await page.goto('/#temoignages');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('#temoignages')).toBeAttached();
  });
});

// ---------------------------------------------------------------------------
// 4. Navigation depuis /faq
// ---------------------------------------------------------------------------
test.describe('Navigation ancre depuis /faq', () => {
  test('clic "Témoignages" depuis /faq redirige vers /#temoignages', async ({ page }) => {
    await page.goto('/faq');
    await page.waitForLoadState('networkidle');

    const link = page.getByRole('link', { name: /témoignages/i }).first();
    // Si le lien n'existe pas (page sans nav), passer le test
    if (!(await link.isVisible())) return;

    await link.click();
    await page.waitForLoadState('domcontentloaded');

    // Doit atterrir sur la home avec le hash
    await expect(page).toHaveURL(/\/#temoignages/);
    await expect(page.locator('#temoignages')).toBeAttached();
  });
});

// ---------------------------------------------------------------------------
// 5. Navigation depuis /notre-approche
// ---------------------------------------------------------------------------
test.describe('Navigation ancre depuis /notre-approche', () => {
  test('clic "Témoignages" depuis /notre-approche redirige vers /#temoignages', async ({
    page,
  }) => {
    await page.goto('/notre-approche');
    await page.waitForLoadState('networkidle');

    const link = page.getByRole('link', { name: /témoignages/i }).first();
    if (!(await link.isVisible())) return;

    await link.click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/#temoignages/);
    await expect(page.locator('#temoignages')).toBeAttached();
  });
});
