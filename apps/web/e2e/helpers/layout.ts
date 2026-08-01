import { expect, type Page } from '@playwright/test';

type OverflowDiagnostics = {
  viewport: number;
  documentWidth: number;
  bodyWidth: number;
  offenders: Array<{
    tag: string;
    testId: string | null;
    className: string;
    left: number;
    right: number;
  }>;
};

/**
 * Detects real document overflow and includes the visible culprit elements in
 * assertion output. It deliberately checks the document and body independently:
 * global overflow clipping must not hide a component width regression.
 */
export async function expectNoHorizontalOverflow(page: Page) {
  const layout = await page.evaluate<OverflowDiagnostics>(() => {
    const viewport = window.innerWidth;
    const offenders = Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.left < -2 || rect.right > viewport + 2);
      })
      .slice(0, 12)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          testId: element.dataset.testid ?? null,
          className: element.className.toString().slice(0, 160),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        };
      });

    return {
      viewport,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      offenders,
    };
  });

  const diagnostics = JSON.stringify(layout.offenders);
  expect(layout.documentWidth, `Éléments hors viewport: ${diagnostics}`).toBeLessThanOrEqual(
    layout.viewport + 2,
  );
  expect(layout.bodyWidth, `Éléments hors viewport: ${diagnostics}`).toBeLessThanOrEqual(
    layout.viewport + 2,
  );
}
