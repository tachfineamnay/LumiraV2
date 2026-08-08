import { Injectable } from '@nestjs/common';
import { EditorialArticleStatus } from '@prisma/client';
import {
  EDITORIAL_AUDIT_CONFIG,
  EditorialAuditDimension,
  editorialAuditWeightTotal,
} from './editorial-content-audit.config';

export type EditorialAuditStatus = 'PASS' | 'WARNING' | 'FAIL' | 'NA';

export type EditorialAuditRule = {
  id: string;
  group: string;
  label: string;
  weight: number;
  status: EditorialAuditStatus;
  measuredValue?: string | number | boolean;
  message: string;
  recommendation: string;
};

export type EditorialAuditResult = {
  score: number;
  rules: EditorialAuditRule[];
};

export type EditorialContentAuditInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  contentHtml: string;
  plainText: string;
  status: EditorialArticleStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  focusKeyword?: string | null;
  canonical?: string | null;
  category?: { id: string; isActive?: boolean } | null;
  tags?: Array<{ id: string; isActive?: boolean }>;
  coverAsset?: { id: string; altText?: string | null } | null;
  author?: { id: string } | null;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  outboundLinks?: Array<{ anchorText?: string | null; targetArticle?: { slug: string } | null }>;
};

type ContentFacts = {
  headings: Array<{ level: number; text: string }>;
  paragraphs: string[];
  links: Array<{ href: string; text: string }>;
  hasList: boolean;
  wordCount: number;
  hasFaq: boolean;
  faqAnswers: string[];
};

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const includesPhrase = (value: string, phrase: string) => normalize(value).includes(normalize(phrase));

function contentFacts(html: string, plainText: string): ContentFacts {
  const headings = [...html.matchAll(/<h([1-6])>([\s\S]*?)<\/h\1>/gi)].map((match) => ({
    level: Number(match[1]),
    text: stripHtml(match[2]),
  }));
  const paragraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  const links = [...html.matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => ({
    href: match[1],
    text: stripHtml(match[2]),
  }));
  const faqIndex = headings.findIndex((heading) => /\bfaq\b|questions? frequentes?/i.test(heading.text));
  const faqAnswers = faqIndex === -1
    ? []
    : headings.slice(faqIndex + 1).filter((heading) => /\?$/.test(heading.text)).map((heading) => heading.text);

  return {
    headings,
    paragraphs,
    links,
    hasList: /<(ul|ol)>/i.test(html),
    wordCount: plainText.split(/\s+/).filter(Boolean).length,
    hasFaq: faqIndex !== -1,
    faqAnswers,
  };
}

@Injectable()
export class EditorialContentAuditService {
  auditAll(input: EditorialContentAuditInput) {
    return {
      seo: this.auditSeo(input),
      aeo: this.auditAeo(input),
      geo: this.auditGeo(input),
    };
  }

  auditSeo(input: EditorialContentAuditInput): EditorialAuditResult {
    const facts = contentFacts(input.contentHtml, input.plainText);
    const keyword = input.focusKeyword?.trim();
    const seoTitle = input.seoTitle?.trim();
    const description = input.seoDescription?.trim();
    const internalLinks = facts.links.filter((link) => link.href.startsWith('/')).length + (input.outboundLinks?.length ?? 0);
    const headingLevels = facts.headings.map((heading) => heading.level);
    const rules = [
      this.rule('seo', 'seo-title', 'Metadata', seoTitle ? 'PASS' : 'FAIL', Boolean(seoTitle), 'Titre SEO renseigné.', 'Renseignez un titre SEO explicite.'),
      this.rule('seo', 'seo-title-length', 'Metadata', seoTitle ? this.range(seoTitle.length, 30, 60) : 'NA', seoTitle?.length, 'Longueur du titre SEO.', 'Visez 30 à 60 caractères.'),
      this.rule('seo', 'seo-description', 'Metadata', description ? 'PASS' : 'FAIL', Boolean(description), 'Meta description renseignée.', 'Renseignez une meta description.'),
      this.rule('seo', 'seo-description-length', 'Metadata', description ? this.range(description.length, 120, 160) : 'NA', description?.length, 'Longueur de la meta description.', 'Visez 120 à 160 caractères.'),
      this.rule('seo', 'slug', 'Metadata', /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) ? 'PASS' : 'FAIL', input.slug, 'Slug lisible et stable.', 'Utilisez un slug minuscule avec des tirets.'),
      this.rule('seo', 'canonical', 'Metadata', input.canonical ? 'PASS' : 'WARNING', Boolean(input.canonical), 'Canonical explicite.', 'Ajoutez une canonical avant publication si nécessaire.'),
      this.rule('seo', 'content-present', 'Structure', facts.wordCount >= 80 ? 'PASS' : facts.wordCount > 0 ? 'WARNING' : 'FAIL', facts.wordCount, 'Contenu non vide avec longueur minimale.', 'Ajoutez un contenu substantiel.'),
      this.rule('seo', 'h1', 'Structure', facts.headings.filter((heading) => heading.level === 1).length === 1 ? 'PASS' : 'FAIL', facts.headings.filter((heading) => heading.level === 1).length, 'Un H1 unique.', 'Ajoutez un H1 unique.'),
      this.rule('seo', 'heading-structure', 'Structure', this.validHeadingHierarchy(headingLevels) ? 'PASS' : 'WARNING', headingLevels.join(','), 'Hiérarchie de titres cohérente.', 'Évitez de sauter des niveaux de titre.'),
      this.rule('seo', 'section-headings', 'Structure', facts.headings.some((heading) => heading.level === 2 || heading.level === 3) ? 'PASS' : 'WARNING', facts.headings.length, 'Sections H2/H3 présentes.', 'Découpez le contenu avec des H2 ou H3.'),
      this.rule('seo', 'paragraphs', 'Structure', facts.paragraphs.length >= 3 ? 'PASS' : facts.paragraphs.length ? 'WARNING' : 'FAIL', facts.paragraphs.length, 'Paragraphes lisibles.', 'Ajoutez des paragraphes structurés.'),
      this.rule('seo', 'focus-keyword-present', 'Focus', keyword ? 'PASS' : 'FAIL', Boolean(keyword), 'Mot-clé principal renseigné.', 'Renseignez un mot-clé principal naturel.'),
      this.rule('seo', 'focus-keyword-title', 'Focus', keyword ? (includesPhrase(input.title, keyword) || includesPhrase(seoTitle ?? '', keyword) ? 'PASS' : 'WARNING') : 'NA', keyword ?? undefined, 'Mot-clé dans le titre.', 'Intégrez le mot-clé naturellement dans le titre.'),
      this.rule('seo', 'focus-keyword-introduction', 'Focus', keyword ? (includesPhrase(facts.paragraphs[0] ?? '', keyword) ? 'PASS' : 'WARNING') : 'NA', keyword ?? undefined, 'Mot-clé dans l’introduction.', 'Intégrez le mot-clé naturellement dans l’introduction.'),
      this.rule('seo', 'focus-keyword-headings', 'Focus', keyword ? (facts.headings.some((heading) => includesPhrase(heading.text, keyword)) ? 'PASS' : 'WARNING') : 'NA', keyword ?? undefined, 'Mot-clé dans un heading.', 'Ajoutez le mot-clé dans un intertitre lorsque naturel.'),
      this.rule('seo', 'cover', 'Images', input.coverAsset ? 'PASS' : 'FAIL', Boolean(input.coverAsset), 'Image de couverture présente.', 'Ajoutez une image de couverture.'),
      this.rule('seo', 'cover-alt', 'Images', input.coverAsset ? (input.coverAsset.altText?.trim() ? 'PASS' : 'FAIL') : 'NA', input.coverAsset?.altText?.length, 'Texte alternatif de couverture.', 'Ajoutez un ALT descriptif.'),
      this.rule('seo', 'internal-links', 'Maillage', internalLinks ? 'PASS' : 'NA', internalLinks, 'Liens internes observables.', 'Ajoutez un lien interne pertinent si le sujet s’y prête.'),
      this.rule('seo', 'descriptive-anchors', 'Maillage', internalLinks ? (facts.links.filter((link) => link.href.startsWith('/')).every((link) => link.text.length >= 4) ? 'PASS' : 'WARNING') : 'NA', internalLinks, 'Ancres internes descriptives.', 'Préférez des ancres explicites.'),
      this.rule('seo', 'category', 'Taxonomie', input.category?.isActive !== false ? (input.category ? 'PASS' : 'FAIL') : 'FAIL', Boolean(input.category), 'Catégorie active assignée.', 'Assignez une catégorie active.'),
      this.rule('seo', 'tags', 'Taxonomie', (input.tags?.length ?? 0) > 0 && input.tags?.every((tag) => tag.isActive !== false) ? 'PASS' : 'WARNING', input.tags?.length ?? 0, 'Tags actifs assignés.', 'Ajoutez des tags pertinents et actifs.'),
      this.rule('seo', 'indexability', 'Indexabilité', input.status === EditorialArticleStatus.PUBLISHED && Boolean(input.publishedAt) ? 'PASS' : 'NA', input.status, 'Éligibilité logique à l’indexation.', 'Ce contrôle s’applique une fois l’article publié.'),
    ];
    return this.result(rules);
  }

  auditAeo(input: EditorialContentAuditInput): EditorialAuditResult {
    const facts = contentFacts(input.contentHtml, input.plainText);
    const intro = facts.paragraphs[0] ?? '';
    const questionHeadings = facts.headings.filter((heading) => /\?$/.test(heading.text));
    const descriptiveHeadings = facts.headings.filter(
      (heading) => heading.level >= 2 && !/^faq$/i.test(heading.text),
    );
    const rules = [
      this.rule('aeo', 'explicit-topic', 'Sujet', input.title.trim().length >= 12 ? 'PASS' : 'FAIL', input.title.length, 'Sujet principal explicite dans le titre.', 'Formulez un titre qui nomme clairement le sujet.'),
      this.rule('aeo', 'clear-introduction', 'Réponse', intro.length >= 40 ? 'PASS' : intro ? 'WARNING' : 'FAIL', intro.length, 'Introduction claire.', 'Ajoutez une introduction explicite.'),
      this.rule('aeo', 'concise-answer', 'Réponse', intro.length >= 80 && intro.length <= 420 ? 'PASS' : intro ? 'WARNING' : 'FAIL', intro.length, 'Réponse synthétique identifiable.', 'Ajoutez une réponse courte et autonome en introduction.'),
      this.rule('aeo', 'descriptive-headings', 'Structure', descriptiveHeadings.every((heading) => heading.text.length >= 8) && descriptiveHeadings.length ? 'PASS' : 'WARNING', descriptiveHeadings.length, 'Headings descriptifs.', 'Utilisez des intertitres explicites.'),
      this.rule('aeo', 'question-sections', 'Structure', questionHeadings.length ? 'PASS' : 'NA', questionHeadings.length, 'Sections formulées en questions.', 'Ajoutez des questions seulement si elles servent le lecteur.'),
      this.rule('aeo', 'segmentable-paragraphs', 'Structure', facts.paragraphs.length >= 3 && facts.paragraphs.every((paragraph) => paragraph.length <= 700) ? 'PASS' : facts.paragraphs.length ? 'WARNING' : 'FAIL', facts.paragraphs.length, 'Paragraphes segmentables.', 'Découpez le contenu en paragraphes autonomes.'),
      this.rule('aeo', 'lists', 'Structure', facts.hasList ? 'PASS' : 'NA', facts.hasList, 'Liste structurée détectée.', 'Ajoutez une liste uniquement lorsqu’elle clarifie le sujet.'),
      this.rule('aeo', 'definitions', 'Structure', /\b(est|désigne|correspond à|se définit)\b/i.test(input.plainText) ? 'PASS' : 'NA', false, 'Définition structurée détectée.', 'Ajoutez une définition seulement si elle est utile.'),
      this.rule('aeo', 'faq-detected', 'FAQ', facts.hasFaq ? 'PASS' : 'NA', facts.hasFaq, 'FAQ détectable.', 'Ajoutez une FAQ seulement pour des questions réelles.'),
      this.rule('aeo', 'faq-structured', 'FAQ', facts.hasFaq ? (facts.faqAnswers.length ? 'PASS' : 'WARNING') : 'NA', facts.faqAnswers.length, 'FAQ structurée avec questions.', 'Ajoutez des questions sous le titre FAQ.'),
      this.rule('aeo', 'faq-answer-length', 'FAQ', facts.hasFaq ? (facts.faqAnswers.every((answer) => answer.length >= 10 && answer.length <= 140) ? 'PASS' : 'WARNING') : 'NA', facts.faqAnswers.length, 'Questions FAQ de taille raisonnable.', 'Gardez les réponses FAQ concises et utiles.'),
    ];
    return this.result(rules);
  }

  auditGeo(input: EditorialContentAuditInput): EditorialAuditResult {
    const facts = contentFacts(input.contentHtml, input.plainText);
    const externalLinks = facts.links.filter((link) => /^https?:\/\//i.test(link.href) && !/oraclelumira\.com/i.test(link.href));
    const hasMetadata = Boolean(input.seoTitle?.trim() && input.seoDescription?.trim() && input.canonical?.trim());
    const rules = [
      this.rule('geo', 'identifiable-subject', 'Identité du sujet', input.title.trim().length >= 12 && facts.paragraphs[0]?.length >= 40 ? 'PASS' : 'WARNING', input.title.length, 'Sujet identifiable structurellement.', 'Clarifiez le titre et l’introduction.'),
      this.rule('geo', 'category', 'Taxonomie', input.category ? 'PASS' : 'FAIL', Boolean(input.category), 'Catégorie assignée.', 'Assignez une catégorie.'),
      this.rule('geo', 'tags', 'Taxonomie', (input.tags?.length ?? 0) > 0 ? 'PASS' : 'WARNING', input.tags?.length ?? 0, 'Tags assignés.', 'Ajoutez des tags pertinents.'),
      this.rule('geo', 'publisher', 'Attribution', 'PASS', 'Oracle Lumira', 'Identité éditoriale Oracle Lumira.', 'Aucune action requise.'),
      this.rule('geo', 'author', 'Attribution', input.author ? 'PASS' : 'NA', Boolean(input.author), 'Auteur expert attribué.', 'Attribuez un auteur lorsque disponible.'),
      this.rule('geo', 'published-date', 'Dates', input.status === EditorialArticleStatus.PUBLISHED ? (input.publishedAt ? 'PASS' : 'FAIL') : 'NA', Boolean(input.publishedAt), 'Date de publication disponible.', 'Publiez avec une date de publication.'),
      this.rule('geo', 'modified-date', 'Dates', input.updatedAt ? 'PASS' : 'NA', Boolean(input.updatedAt), 'Date de modification disponible.', 'Ce signal sera renseigné après persistance.'),
      this.rule('geo', 'external-sources', 'Sources', externalLinks.length ? 'PASS' : 'NA', externalLinks.length, 'Sources externes observables.', 'Citez des sources seulement lorsqu’elles sont pertinentes.'),
      this.rule('geo', 'attribution', 'Sources', externalLinks.length ? (externalLinks.every((link) => link.text.length >= 4) ? 'PASS' : 'WARNING') : 'NA', externalLinks.length, 'Attribution des sources par ancre.', 'Utilisez des ancres qui identifient la source.'),
      this.rule('geo', 'metadata', 'Métadonnées', hasMetadata ? 'PASS' : 'WARNING', hasMetadata, 'Métadonnées cohérentes.', 'Renseignez titre, description et canonical.'),
      this.rule('geo', 'structured-data-inputs', 'Données structurées', hasMetadata && Boolean(input.publishedAt) && Boolean(input.category) ? 'PASS' : 'NA', hasMetadata, 'Champs nécessaires aux données structurées.', 'Ce contrôle s’applique lorsque la page est publiable.'),
      this.rule('geo', 'internal-links', 'Maillage', (input.outboundLinks?.length ?? 0) > 0 || facts.links.some((link) => link.href.startsWith('/')) ? 'PASS' : 'NA', input.outboundLinks?.length ?? 0, 'Maillage interne observable.', 'Ajoutez un lien interne pertinent si nécessaire.'),
      this.rule('geo', 'category-cluster', 'Taxonomie', input.category && (input.tags?.length ?? 0) > 0 ? 'PASS' : 'WARNING', input.tags?.length ?? 0, 'Cluster catégorie et tags.', 'Associez catégorie et tags cohérents.'),
      this.rule('geo', 'faq', 'Structure', facts.hasFaq ? 'PASS' : 'NA', facts.hasFaq, 'FAQ observable.', 'Ajoutez une FAQ seulement si elle répond à des besoins réels.'),
      this.rule('geo', 'citable-structure', 'Structure', facts.paragraphs.some((paragraph) => paragraph.length >= 80 && paragraph.length <= 420) && facts.headings.length >= 2 ? 'PASS' : 'WARNING', facts.paragraphs.length, 'Structure citationnable par segments.', 'Ajoutez des sections et paragraphes autonomes.'),
    ];
    return this.result(rules);
  }

  private rule(
    dimension: EditorialAuditDimension,
    id: string,
    group: string,
    status: EditorialAuditStatus,
    measuredValue: EditorialAuditRule['measuredValue'],
    message: string,
    recommendation: string,
  ): EditorialAuditRule {
    const weight = EDITORIAL_AUDIT_CONFIG[dimension].rules[id as never] as number | undefined;
    if (weight === undefined) throw new Error(`Unknown editorial audit rule: ${dimension}.${id}`);
    return { id, group, label: id.replace(/-/g, ' '), weight, status, measuredValue, message, recommendation };
  }

  private result(rules: EditorialAuditRule[]): EditorialAuditResult {
    const applicableWeight = rules.filter((rule) => rule.status !== 'NA').reduce((sum, rule) => sum + rule.weight, 0);
    const earnedWeight = rules.filter((rule) => rule.status === 'PASS').reduce((sum, rule) => sum + rule.weight, 0);
    return { score: applicableWeight ? Math.round((earnedWeight / applicableWeight) * 100) : 100, rules };
  }

  private range(value: number, min: number, max: number): EditorialAuditStatus {
    if (value >= min && value <= max) return 'PASS';
    return value > 0 ? 'WARNING' : 'FAIL';
  }

  private validHeadingHierarchy(levels: number[]) {
    return levels.every((level, index) => index === 0 || level <= levels[index - 1] + 1);
  }
}

export { editorialAuditWeightTotal };
