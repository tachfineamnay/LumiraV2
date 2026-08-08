export type EditorialAuditDimension = 'seo' | 'aeo' | 'geo';

export const EDITORIAL_AUDIT_RULE_VERSION = '2026.08.v1';

/**
 * Warning is intentionally worth half a pass: it identifies an editorial
 * improvement without treating a non-critical signal as a publication failure.
 */
export const EDITORIAL_AUDIT_STATUS_MULTIPLIER = {
  PASS: 1,
  WARNING: 0.5,
  FAIL: 0,
} as const;

export const EDITORIAL_AUDIT_CONFIG = {
  seo: {
    description: 'Signaux techniques et éditoriaux contrôlables avant rendu public.',
    rules: {
      'seo-title': 8,
      'seo-title-length': 6,
      'seo-description': 8,
      'seo-description-length': 5,
      slug: 3,
      canonical: 2,
      'rendered-canonical': 1,
      'content-present': 5,
      h1: 5,
      'heading-structure': 5,
      'section-headings': 5,
      paragraphs: 5,
      'focus-keyword-present': 2,
      'focus-keyword-title': 8,
      'focus-keyword-introduction': 8,
      cover: 5,
      'cover-alt': 3,
      'internal-links': 3,
      'descriptive-anchors': 2,
      category: 3,
      tags: 3,
      indexability: 3,
      'runtime-indexability': 2,
    },
  },
  aeo: {
    description: 'Proxies structurels de réponse claire, sans inférence sémantique par IA.',
    rules: {
      'explicit-topic': 12,
      'clear-introduction': 14,
      'concise-answer': 12,
      'descriptive-headings': 10,
      'question-sections': 8,
      'segmentable-paragraphs': 10,
      lists: 6,
      definitions: 6,
      'faq-detected': 8,
      'faq-structured': 8,
      'faq-answer-length': 6,
    },
  },
  geo: {
    description: 'Signaux de sujet, attribution et structure extractible contrôlables par Lumira.',
    rules: {
      'identifiable-subject': 8,
      category: 8,
      tags: 8,
      publisher: 8,
      author: 7,
      'published-date': 8,
      'search-modified-date': 5,
      'external-sources': 8,
      attribution: 6,
      'evidence-proximity': 6,
      metadata: 6,
      'structured-data-inputs': 3,
      'structured-data-rendered': 3,
      'internal-links': 5,
      'category-cluster': 4,
      faq: 4,
      'citable-structure': 3,
    },
  },
} as const;

export function editorialAuditWeightTotal(dimension: EditorialAuditDimension) {
  return Object.values(EDITORIAL_AUDIT_CONFIG[dimension].rules).reduce((sum, weight) => sum + weight, 0);
}
