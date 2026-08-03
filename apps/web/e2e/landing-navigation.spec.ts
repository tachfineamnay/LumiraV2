import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/layout';

const SECTION_IDS = ['niveaux', 'comment-ca-marche', 'temoignages'] as const;

async function expectSectionAligned(page: Page, id: (typeof SECTION_IDS)[number]) {
  const section = page.locator(`#${id}`);
  const header = page.locator('[data-landing-header]');
  await expect(section).toBeVisible();

  await expect
    .poll(async () => {
      const sectionBox = await section.boundingBox();
      const headerBox = await header.boundingBox();
      const viewport = page.viewportSize();
      if (!sectionBox || !headerBox || !viewport) return false;

      return (
        sectionBox.y >= headerBox.height - 2 &&
        sectionBox.y <= Math.max(headerBox.height + 48, viewport.height * 0.45)
      );
    })
    .toBe(true);
}

test.describe('landing anchor navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  for (const item of [
    { name: "L'Offre", id: 'niveaux' },
    { name: 'Comment ça marche', id: 'comment-ca-marche' },
    { name: 'Témoignages', id: 'temoignages' },
  ] as const) {
    test(`desktop header reaches ${item.id}`, async ({ page }) => {
      await page.goto('/');
      const header = page.locator('[data-landing-header]');
      await header.getByRole('link', { name: item.name, exact: true }).click();

      await expect(page).toHaveURL(new RegExp(`#${item.id}$`));
      await expectSectionAligned(page, item.id);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('header and hero CTAs use the same offer anchor contract', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-landing-header]').getByRole('link', { name: 'Commencer' }).click();
    await expect(page).toHaveURL(/#niveaux$/);
    await expectSectionAligned(page, 'niveaux');

    await page.goto('/');
    await page.getByRole('link', { name: 'Découvrir ma lecture' }).click();
    await expect(page).toHaveURL(/#niveaux$/);
    await expectSectionAligned(page, 'niveaux');
  });

  test('footer anchor remains functional after all deferred sections rendered', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await footer.scrollIntoViewIfNeeded();
    await footer.getByRole('link', { name: 'Comment ça marche', exact: true }).click();

    await expect(page).toHaveURL(/#comment-ca-marche$/);
    await expectSectionAligned(page, 'comment-ca-marche');
  });

  for (const sourcePath of ['/faq', '/notre-approche']) {
    test(`internal route ${sourcePath} returns to the home offer anchor`, async ({ page }) => {
      await page.goto(sourcePath);
      await page
        .locator('[data-landing-header]')
        .getByRole('link', { name: "L'Offre", exact: true })
        .click();

      await expect(page).toHaveURL(/\/#niveaux$/);
      await expectSectionAligned(page, 'niveaux');
    });
  }

  for (const id of SECTION_IDS) {
    test(`direct hash ${id} is corrected below the fixed header`, async ({ page }) => {
      await page.goto(`/#${id}`);
      await expectSectionAligned(page, id);
    });
  }

  test('mobile menu closes, unlocks the body and reaches testimonials', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Navigation principale' });
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'Témoignages', exact: true }).click();

    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/#temoignages$/);
    await expectSectionAligned(page, 'temoignages');
    await expect
      .poll(() =>
        page.evaluate(() => ({
          overflow: document.body.style.overflow,
          position: document.body.style.position,
          top: document.body.style.top,
        })),
      )
      .toEqual({ overflow: '', position: '', top: '' });
    await expectNoHorizontalOverflow(page);
  });
});
