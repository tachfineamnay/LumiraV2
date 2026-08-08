import { EditorialArticleStatus } from '@prisma/client';
import { editorialAuditWeightTotal } from './editorial-content-audit.config';
import { EditorialContentAuditService } from './editorial-content-audit.service';

const input = {
  title: "Comprendre la peur de l'abandon",
  slug: 'comprendre-la-peur-de-labandon',
  contentHtml: '<h1>Comprendre la peur de l’abandon</h1><p>La peur de l’abandon est une réaction émotionnelle fréquente. Cette introduction offre une réponse claire et autonome au lecteur qui cherche des repères relationnels.</p><h2>Peur de l’abandon : repères essentiels</h2><p>Elle désigne un sentiment qui peut apparaître dans une relation et se définit par une inquiétude persistante face à la distance ou au silence.</p><ul><li>Nommer l’émotion.</li></ul><p>Cette pratique aide à créer un espace apaisé avant de réagir et à formuler une demande respectueuse envers soi-même et envers les autres.</p><h2>FAQ</h2><h3>Comment apaiser la peur de l’abandon ?</h3><p>Identifiez le besoin puis formulez une demande simple.</p>',
  plainText: "Comprendre la peur de l’abandon La peur de l’abandon est une réaction émotionnelle fréquente. Cette introduction offre une réponse claire et autonome au lecteur qui cherche des repères relationnels. Peur de l’abandon : repères essentiels Elle désigne un sentiment qui peut apparaître dans une relation et se définit par une inquiétude persistante face à la distance ou au silence. Nommer l’émotion. Cette pratique aide à créer un espace apaisé avant de réagir et à formuler une demande respectueuse envers soi-même et envers les autres. FAQ Comment apaiser la peur de l’abandon ? Identifiez le besoin puis formulez une demande simple.",
  status: EditorialArticleStatus.PUBLISHED,
  seoTitle: "Comprendre la peur de l’abandon avec douceur",
  seoDescription: "Un guide clair pour comprendre la peur de l’abandon, identifier ses manifestations relationnelles et adopter des repères concrets avec douceur.",
  focusKeyword: "peur de l’abandon",
  canonical: 'https://oraclelumira.com/blog/comprendre-la-peur-de-labandon',
  category: { id: 'cat-1', isActive: true },
  tags: [{ id: 'tag-1', isActive: true }],
  coverAsset: { id: 'asset-1', altText: "Illustration de la peur de l'abandon" },
  author: { id: 'expert-1' },
  publishedAt: new Date('2026-08-08T00:00:00.000Z'),
  updatedAt: new Date('2026-08-08T00:00:00.000Z'),
  outboundLinks: [],
};

describe('EditorialContentAuditService', () => {
  const service = new EditorialContentAuditService();

  it('keeps every configured dimension at a logical total of 100', () => {
    expect(editorialAuditWeightTotal('seo')).toBe(100);
    expect(editorialAuditWeightTotal('aeo')).toBe(100);
    expect(editorialAuditWeightTotal('geo')).toBe(100);
  });

  it('is deterministic and bounded for an optimized article', () => {
    const first = service.auditAll(input);
    const second = service.auditAll(input);
    expect(first).toEqual(second);
    expect(first.seo.score).toBe(100);
    expect(first.aeo.score).toBe(100);
    expect(first.geo.score).toBe(100);
    for (const result of Object.values(first)) expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('scores incomplete content lower and removes NA weights from the denominator', () => {
    const bad = service.auditAll({ ...input, title: 'Bref', contentHtml: '<p>Vide</p>', plainText: 'Vide', seoTitle: null, seoDescription: null, focusKeyword: null, canonical: null, coverAsset: null, author: null, category: null, tags: [], status: EditorialArticleStatus.DRAFT, publishedAt: null });
    expect(bad.seo.score).toBeLessThan(50);
    expect(bad.aeo.score).toBeLessThan(50);
    expect(bad.geo.score).toBeLessThan(75);
    expect(bad.seo.rules.some((rule) => rule.status === 'NA')).toBe(true);
  });

  it('keeps a medium article between the incomplete and optimized fixtures', () => {
    const medium = service.auditAll({
      ...input,
      contentHtml: '<h1>Comprendre la peur de l’abandon</h1><p>Une introduction claire mais encore courte pour présenter le sujet.</p><p>Un second paragraphe apporte un contexte utile.</p>',
      plainText: 'Comprendre la peur de l’abandon Une introduction claire mais encore courte pour présenter le sujet. Un second paragraphe apporte un contexte utile.',
      coverAsset: null,
      author: null,
      status: EditorialArticleStatus.DRAFT,
      publishedAt: null,
    });
    expect(medium.seo.score).toBeGreaterThan(20);
    expect(medium.seo.score).toBeLessThan(100);
    expect(medium.aeo.score).toBeGreaterThan(0);
    expect(medium.geo.score).toBeLessThan(100);
  });
});
