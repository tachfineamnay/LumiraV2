import { EditorialArticleStatus } from '@prisma/client';
import { editorialAuditWeightTotal, EDITORIAL_AUDIT_RULE_VERSION } from './editorial-content-audit.config';
import { EditorialContentAuditService } from './editorial-content-audit.service';

const optimizedContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: "Comprendre la peur de l'abandon" }] },
    { type: 'paragraph', content: [{ type: 'text', text: "La peur de l'abandon est une réaction émotionnelle fréquente. Selon 42 % des personnes interrogées, elle peut s'exprimer dans les relations." }, { type: 'text', text: ' Étude relationnelle', marks: [{ type: 'link', attrs: { href: 'https://example.org/study' } }] }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: "Peur de l'abandon : repères essentiels" }] },
    { type: 'paragraph', content: [{ type: 'text', text: "Elle désigne un sentiment d'insécurité relationnelle qui peut apparaître lors d'une séparation, d'un silence ou d'un changement de rythme." }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: "Nommer l'émotion sans la juger." }] }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: "Prendre quelques minutes pour respirer, écrire et demander du soutien permet de créer un espace avant de réagir et de formuler une demande respectueuse." }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'FAQ' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: "Comment apaiser la peur de l'abandon ?" }] },
    { type: 'paragraph', content: [{ type: 'text', text: "Commencez par identifier le besoin qui se manifeste, puis formulez une demande simple et respectueuse à la personne concernée." }] },
  ],
};

const input = {
  title: "Comprendre la peur de l'abandon",
  slug: 'comprendre-la-peur-de-labandon',
  excerpt: 'Un guide clair.',
  contentJson: optimizedContent,
  status: EditorialArticleStatus.PUBLISHED,
  seoTitle: "Comprendre la peur de l'abandon avec douceur",
  seoDescription: "Un guide clair pour comprendre la peur de l'abandon, identifier ses manifestations relationnelles et adopter des repères concrets avec douceur.",
  focusKeyword: "peur de l'abandon",
  canonical: 'https://oraclelumira.com/blog/comprendre-la-peur-de-labandon',
  category: { id: 'cat-1', isActive: true },
  tags: [{ id: 'tag-1', isActive: true }],
  coverAsset: { id: 'asset-1', altText: "Illustration de la peur de l'abandon" },
  author: { id: 'expert-1' },
  publishedAt: new Date('2026-08-08T00:00:00.000Z'),
  searchModifiedAt: new Date('2026-08-08T00:00:00.000Z'),
  outboundLinks: [],
};

describe('EditorialContentAuditService', () => {
  const service = new EditorialContentAuditService();

  it('keeps every configured dimension at a logical total of 100', () => {
    expect(editorialAuditWeightTotal('seo')).toBe(100);
    expect(editorialAuditWeightTotal('aeo')).toBe(100);
    expect(editorialAuditWeightTotal('geo')).toBe(100);
  });

  it('returns a deterministic, versioned and covered audit bundle', () => {
    const first = service.auditAll(input);
    const second = service.auditAll(input);
    expect(first).toEqual(second);
    for (const result of [first.seo, first.aeo, first.geo]) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.ruleVersion).toBe(EDITORIAL_AUDIT_RULE_VERSION);
      expect(result.inputHash).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(first.seo.coverage).toBeLessThan(100);
    expect(first.geo.coverage).toBeLessThan(100);
    expect(first.publicationGate).toEqual({ status: 'READY', reasons: [] });
  });

  it('treats warnings as partial credit and runtime checks as deferred', () => {
    const result = service.auditSeo({ ...input, canonical: null });
    const canonical = result.rules.find((rule) => rule.id === 'canonical');
    const renderedCanonical = result.rules.find((rule) => rule.id === 'rendered-canonical');
    expect(canonical?.status).toBe('WARNING');
    expect(renderedCanonical?.status).toBe('DEFERRED');
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.coverage).toBeLessThan(100);
  });

  it('uses soft title, description and content-length signals rather than false hard failures', () => {
    const result = service.auditSeo({ ...input, seoTitle: 'Court', seoDescription: 'Trop brève.', contentJson: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Sujet valable' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Un texte court.' }] }] } });
    expect(result.rules.find((rule) => rule.id === 'seo-title-length')?.status).toBe('WARNING');
    expect(result.rules.find((rule) => rule.id === 'seo-description-length')?.status).toBe('WARNING');
    expect(result.rules.find((rule) => rule.id === 'content-present')?.status).toBe('WARNING');
  });

  it('changes the hash only when a relevant audit input changes', () => {
    const baseline = service.inputHash(input);
    expect(service.inputHash({ ...input, title: 'Autre sujet éditorial' })).not.toBe(baseline);
    const withOutOfAuditField = { ...input, updatedAt: new Date('2030-01-01T00:00:00.000Z') };
    expect(service.inputHash(withOutOfAuditField)).toBe(baseline);
  });

  it('returns NA for optional FAQ and focus-keyword rules', () => {
    const result = service.auditAll({ ...input, focusKeyword: null, contentJson: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Sujet relationnel' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Une introduction suffisamment explicite pour être analysée.' }] }] } });
    expect(result.seo.rules.find((rule) => rule.id === 'focus-keyword-present')?.status).toBe('NA');
    expect(result.aeo.rules.find((rule) => rule.id === 'faq-detected')?.status).toBe('NA');
  });

  it('exposes PASS, WARNING, FAIL, NA and DEFERRED without network checks', () => {
    const bundle = service.auditAll({ ...input, seoTitle: null, focusKeyword: null, contentJson: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bref' }] }] } });
    const statuses = new Set([...bundle.seo.rules, ...bundle.aeo.rules, ...bundle.geo.rules].map((rule) => rule.status));
    for (const status of ['PASS', 'WARNING', 'FAIL', 'NA', 'DEFERRED']) {
      expect(statuses).toContain(status);
    }
  });

  it('passes evidence proximity only when an external source is near an observable claim', () => {
    const result = service.auditGeo(input);
    expect(result.rules.find((rule) => rule.id === 'evidence-proximity')?.status).toBe('PASS');
    const separated = service.auditGeo({ ...input, contentJson: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Sujet relationnel' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Un contexte sans chiffre ni citation.' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Source externe', marks: [{ type: 'link', attrs: { href: 'https://example.org/source' } }] }] }] } });
    expect(separated.rules.find((rule) => rule.id === 'evidence-proximity')?.status).toBe('WARNING');
  });

  it('blocks only controlled publication invariants and leaves recommendations as warnings', () => {
    expect(service.auditAll({ ...input, seoTitle: null }).publicationGate.status).toBe('WARNING');
    const blocked = service.auditAll({ ...input, slug: 'slug invalide', category: null, contentJson: { type: 'doc', content: [] } });
    expect(blocked.publicationGate.status).toBe('BLOCKED');
    expect(blocked.publicationGate.reasons).toEqual(expect.arrayContaining(['Le contenu éditorial est vide ou invalide.', 'Le slug est invalide.', 'Une catégorie active est requise.']));
  });
});
