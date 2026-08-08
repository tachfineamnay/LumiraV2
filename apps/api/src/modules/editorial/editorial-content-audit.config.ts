export type EditorialAuditDimension = 'seo' | 'aeo' | 'geo';

export const EDITORIAL_AUDIT_CONFIG = {
  seo: {
    description: 'Qualité technique et éditoriale vérifiable pour la recherche web.',
    rules: {
      'seo-title': 8,
      'seo-title-length': 6,
      'seo-description': 8,
      'seo-description-length': 5,
      slug: 3,
      canonical: 3,
      'content-present': 5,
      h1: 5,
      'heading-structure': 5,
      'section-headings': 5,
      paragraphs: 5,
      'focus-keyword-present': 4,
      'focus-keyword-title': 5,
      'focus-keyword-introduction': 5,
      'focus-keyword-headings': 4,
      cover: 5,
      'cover-alt': 3,
      'internal-links': 3,
      'descriptive-anchors': 2,
      category: 3,
      tags: 3,
      indexability: 5,
    },
  },
  aeo: {
    description: 'Proxies structurels de réponse claire, sans interprétation par IA.',
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
    description: 'Signaux éditoriaux contrôlables pour une page identifiable et attribuable.',
    rules: {
      'identifiable-subject': 10,
      category: 8,
      tags: 8,
      publisher: 8,
      author: 7,
      'published-date': 8,
      'modified-date': 5,
      'external-sources': 8,
      attribution: 6,
      metadata: 8,
      'structured-data-inputs': 6,
      'internal-links': 5,
      'category-cluster': 5,
      faq: 4,
      'citable-structure': 4,
    },
  },
} as const;

export function editorialAuditWeightTotal(dimension: EditorialAuditDimension) {
  return Object.values(EDITORIAL_AUDIT_CONFIG[dimension].rules).reduce((sum, weight) => sum + weight, 0);
}
