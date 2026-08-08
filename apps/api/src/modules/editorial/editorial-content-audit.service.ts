import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { EditorialArticleStatus } from '@prisma/client';
import {
  EDITORIAL_AUDIT_CONFIG,
  EDITORIAL_AUDIT_RULE_VERSION,
  EDITORIAL_AUDIT_STATUS_MULTIPLIER,
  EditorialAuditDimension,
  editorialAuditWeightTotal,
} from './editorial-content-audit.config';
import { analyzeEditorialContent, EditorialContentFacts } from './editorial-content-analyzer';

export type EditorialAuditStatus = 'PASS' | 'WARNING' | 'FAIL' | 'NA' | 'DEFERRED';
export type EditorialPublicationGateStatus = 'READY' | 'WARNING' | 'BLOCKED';

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
  coverage: number;
  rules: EditorialAuditRule[];
  ruleVersion: string;
  inputHash: string;
};

export type EditorialPublicationGate = {
  status: EditorialPublicationGateStatus;
  reasons: string[];
};

export type EditorialContentAuditInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  contentJson: unknown;
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
  searchModifiedAt?: Date | null;
  outboundLinks?: Array<{ anchorText?: string | null; targetArticle?: { slug: string } | null }>;
};

export type EditorialAuditBundle = {
  seo: EditorialAuditResult;
  aeo: EditorialAuditResult;
  geo: EditorialAuditResult;
  publicationGate: EditorialPublicationGate;
};

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const includesPhrase = (value: string, phrase: string) => normalize(value).includes(normalize(phrase));

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

@Injectable()
export class EditorialContentAuditService {
  auditAll(input: EditorialContentAuditInput): EditorialAuditBundle {
    const facts = analyzeEditorialContent(input.contentJson);
    const inputHash = this.inputHash(input);
    return {
      seo: this.auditSeoWithFacts(input, facts, inputHash),
      aeo: this.auditAeoWithFacts(input, facts, inputHash),
      geo: this.auditGeoWithFacts(input, facts, inputHash),
      publicationGate: this.publicationGate(input, facts),
    };
  }

  auditSeo(input: EditorialContentAuditInput) {
    const facts = analyzeEditorialContent(input.contentJson);
    return this.auditSeoWithFacts(input, facts, this.inputHash(input));
  }

  auditAeo(input: EditorialContentAuditInput) {
    const facts = analyzeEditorialContent(input.contentJson);
    return this.auditAeoWithFacts(input, facts, this.inputHash(input));
  }

  auditGeo(input: EditorialContentAuditInput) {
    const facts = analyzeEditorialContent(input.contentJson);
    return this.auditGeoWithFacts(input, facts, this.inputHash(input));
  }

  inputHash(input: EditorialContentAuditInput) {
    const auditedInput = {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt ?? null,
      contentJson: input.contentJson,
      status: input.status,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      focusKeyword: input.focusKeyword ?? null,
      canonical: input.canonical ?? null,
      category: input.category ?? null,
      tags: input.tags ?? [],
      coverAsset: input.coverAsset ?? null,
      author: input.author ?? null,
      publishedAt: input.publishedAt?.toISOString() ?? null,
      searchModifiedAt: input.searchModifiedAt?.toISOString() ?? null,
      outboundLinks: input.outboundLinks ?? [],
    };
    return createHash('sha256').update(stableJson(auditedInput)).digest('hex');
  }

  private auditSeoWithFacts(input: EditorialContentAuditInput, facts: EditorialContentFacts, inputHash: string) {
    const keyword = input.focusKeyword?.trim();
    const seoTitle = input.seoTitle?.trim();
    const description = input.seoDescription?.trim();
    const internalLinks = facts.internalLinks.length + (input.outboundLinks?.length ?? 0);
    const headingLevels = facts.headings.map((heading) => heading.level);
    const rules = [
      this.rule('seo', 'seo-title', 'Metadata', seoTitle ? 'PASS' : 'FAIL', Boolean(seoTitle), 'Titre SEO renseigné.', 'Renseignez un titre SEO explicite.'),
      this.rule('seo', 'seo-title-length', 'Metadata', seoTitle ? this.softLength(seoTitle.length, 15, 80) : 'NA', seoTitle?.length, 'Signal de longueur du titre SEO.', 'Évitez seulement les titres extrêmement courts ou longs.'),
      this.rule('seo', 'seo-description', 'Metadata', description ? 'PASS' : 'FAIL', Boolean(description), 'Meta description renseignée.', 'Renseignez une meta description.'),
      this.rule('seo', 'seo-description-length', 'Metadata', description ? this.softLength(description.length, 50, 220) : 'NA', description?.length, 'Signal de longueur de meta description.', 'Évitez seulement les descriptions extrêmement courtes ou longues.'),
      this.rule('seo', 'slug', 'Metadata', /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) ? 'PASS' : 'FAIL', input.slug, 'Slug lisible et stable.', 'Utilisez un slug minuscule avec des tirets.'),
      this.rule('seo', 'canonical', 'Metadata', input.canonical ? 'PASS' : 'WARNING', Boolean(input.canonical), 'Canonical prévue.', 'Ajoutez une canonical avant publication lorsque nécessaire.'),
      this.rule('seo', 'rendered-canonical', 'Rendu public', 'DEFERRED', undefined, 'Canonical réellement rendue.', 'À vérifier après rendu public.'),
      this.rule('seo', 'content-present', 'Structure', facts.wordCount === 0 ? 'FAIL' : facts.wordCount < 30 ? 'WARNING' : 'PASS', facts.wordCount, 'Contenu non vide.', 'Développez le contenu lorsqu’il est manifestement trop pauvre.'),
      this.rule('seo', 'h1', 'Structure', facts.headings.filter((heading) => heading.level === 1).length === 1 ? 'PASS' : 'FAIL', facts.headings.filter((heading) => heading.level === 1).length, 'Un H1 unique.', 'Ajoutez un H1 unique.'),
      this.rule('seo', 'heading-structure', 'Structure', this.validHeadingHierarchy(headingLevels) ? 'PASS' : 'WARNING', headingLevels.join(','), 'Hiérarchie de titres cohérente.', 'Évitez de sauter des niveaux de titre.'),
      this.rule('seo', 'section-headings', 'Structure', facts.headings.some((heading) => heading.level === 2 || heading.level === 3) ? 'PASS' : 'WARNING', facts.headings.length, 'Sections H2/H3 présentes.', 'Découpez le contenu avec des H2 ou H3 si cela aide le lecteur.'),
      this.rule('seo', 'paragraphs', 'Structure', facts.paragraphs.length >= 3 ? 'PASS' : facts.paragraphs.length ? 'WARNING' : 'FAIL', facts.paragraphs.length, 'Paragraphes lisibles.', 'Ajoutez des paragraphes structurés.'),
      this.rule('seo', 'focus-keyword-present', 'Focus', keyword ? 'PASS' : 'NA', Boolean(keyword), 'Mot-clé éditorial renseigné.', 'Optionnel : renseignez un sujet principal si cela aide la rédaction.'),
      this.rule('seo', 'focus-keyword-title', 'Focus', keyword ? (includesPhrase(input.title, keyword) || includesPhrase(seoTitle ?? '', keyword) ? 'PASS' : 'WARNING') : 'NA', keyword ?? undefined, 'Sujet dans le titre.', 'Faites apparaître le sujet dans le titre sans forcer une expression exacte.'),
      this.rule('seo', 'focus-keyword-introduction', 'Focus', keyword ? (includesPhrase(facts.firstParagraph, keyword) ? 'PASS' : 'WARNING') : 'NA', keyword ?? undefined, 'Sujet dans l’introduction.', 'Présentez le sujet dans l’introduction sans répétition mécanique.'),
      this.rule('seo', 'cover', 'Images', input.coverAsset ? 'PASS' : 'WARNING', Boolean(input.coverAsset), 'Image de couverture présente.', 'Ajoutez une couverture si elle sert le contenu.'),
      this.rule('seo', 'cover-alt', 'Images', input.coverAsset ? (input.coverAsset.altText?.trim() ? 'PASS' : 'WARNING') : 'NA', input.coverAsset?.altText?.length, 'Texte alternatif de couverture.', 'Ajoutez un ALT descriptif lorsque la couverture est utilisée.'),
      this.rule('seo', 'internal-links', 'Maillage', internalLinks ? 'PASS' : 'NA', internalLinks, 'Liens internes observables.', 'Ajoutez un lien interne pertinent si le sujet s’y prête.'),
      this.rule('seo', 'descriptive-anchors', 'Maillage', internalLinks ? (facts.internalLinks.every((link) => link.text.length >= 4) ? 'PASS' : 'WARNING') : 'NA', internalLinks, 'Ancres internes descriptives.', 'Préférez des ancres explicites.'),
      this.rule('seo', 'category', 'Taxonomie', input.category?.isActive !== false ? (input.category ? 'PASS' : 'FAIL') : 'FAIL', Boolean(input.category), 'Catégorie active assignée.', 'Assignez une catégorie active.'),
      this.rule('seo', 'tags', 'Taxonomie', (input.tags?.length ?? 0) > 0 && input.tags?.every((tag) => tag.isActive !== false) ? 'PASS' : 'WARNING', input.tags?.length ?? 0, 'Tags actifs assignés.', 'Ajoutez des tags pertinents et actifs.'),
      this.rule('seo', 'indexability', 'Indexabilité', input.status === EditorialArticleStatus.PUBLISHED && Boolean(input.publishedAt) ? 'PASS' : 'NA', input.status, 'Éligibilité logique à l’indexation.', 'Ce contrôle s’applique une fois l’article publié.'),
      this.rule('seo', 'runtime-indexability', 'Rendu public', 'DEFERRED', undefined, 'Sitemap, robots et réponse HTTP réels.', 'À vérifier après publication réelle.'),
    ];
    return this.result(rules, inputHash);
  }

  private auditAeoWithFacts(input: EditorialContentAuditInput, facts: EditorialContentFacts, inputHash: string) {
    const intro = facts.firstParagraph;
    const descriptiveHeadings = facts.headings.filter((heading) => heading.level >= 2 && !/^faq$/i.test(heading.text));
    const rules = [
      this.rule('aeo', 'explicit-topic', 'Sujet', input.title.trim().length >= 12 ? 'PASS' : 'FAIL', input.title.length, 'Sujet principal explicite dans le titre.', 'Formulez un titre qui nomme clairement le sujet.'),
      this.rule('aeo', 'clear-introduction', 'Réponse', intro.length >= 40 ? 'PASS' : intro ? 'WARNING' : 'FAIL', intro.length, 'Introduction claire.', 'Ajoutez une introduction explicite.'),
      this.rule('aeo', 'concise-answer', 'Réponse', intro.length >= 80 && intro.length <= 420 ? 'PASS' : intro ? 'WARNING' : 'FAIL', intro.length, 'Réponse synthétique identifiable.', 'Ajoutez une réponse courte et autonome en introduction.'),
      this.rule('aeo', 'descriptive-headings', 'Structure', descriptiveHeadings.every((heading) => heading.text.length >= 8) && descriptiveHeadings.length ? 'PASS' : 'WARNING', descriptiveHeadings.length, 'Headings descriptifs.', 'Utilisez des intertitres explicites.'),
      this.rule('aeo', 'question-sections', 'Structure', facts.questionSections.length ? 'PASS' : 'NA', facts.questionSections.length, 'Sections formulées en questions.', 'Ajoutez des questions seulement si elles servent le lecteur.'),
      this.rule('aeo', 'segmentable-paragraphs', 'Structure', facts.paragraphs.length >= 3 && facts.paragraphs.every((paragraph) => paragraph.text.length <= 700) ? 'PASS' : facts.paragraphs.length ? 'WARNING' : 'FAIL', facts.paragraphs.length, 'Paragraphes segmentables.', 'Découpez le contenu en paragraphes autonomes.'),
      this.rule('aeo', 'lists', 'Structure', facts.lists.length ? 'PASS' : 'NA', facts.lists.length, 'Liste structurée détectée.', 'Ajoutez une liste uniquement lorsqu’elle clarifie le sujet.'),
      this.rule('aeo', 'definitions', 'Structure', /\b(est|désigne|correspond à|se définit)\b/i.test(facts.paragraphs.map((paragraph) => paragraph.text).join(' ')) ? 'PASS' : 'NA', facts.paragraphs.length, 'Définition structurée détectée.', 'Ajoutez une définition seulement si elle est utile.'),
      this.rule('aeo', 'faq-detected', 'FAQ', facts.faq.length ? 'PASS' : 'NA', facts.faq.length, 'FAQ détectable.', 'Ajoutez une FAQ seulement pour des questions réelles.'),
      this.rule('aeo', 'faq-structured', 'FAQ', facts.faq.length ? (facts.faq.every((entry) => entry.answer.length > 0) ? 'PASS' : 'WARNING') : 'NA', facts.faq.filter((entry) => entry.answer.length > 0).length, 'FAQ avec réponses associées.', 'Placez une réponse sous chaque question FAQ.'),
      this.rule('aeo', 'faq-answer-length', 'FAQ', facts.faq.length ? (facts.faq.every((entry) => entry.answer.length >= 20 && entry.answer.length <= 600) ? 'PASS' : 'WARNING') : 'NA', facts.faq.length, 'Réponses FAQ de taille raisonnable.', 'Gardez les réponses FAQ concises et utiles.'),
    ];
    return this.result(rules, inputHash);
  }

  private auditGeoWithFacts(input: EditorialContentAuditInput, facts: EditorialContentFacts, inputHash: string) {
    const hasMetadata = Boolean(input.seoTitle?.trim() && input.seoDescription?.trim() && input.canonical?.trim());
    const hasEvidenceNearSource = facts.paragraphs.some((paragraph) => {
      const hasEvidence = /\d|%|[“”"]/u.test(paragraph.text);
      return hasEvidence && facts.externalLinks.some((link) => Math.abs(link.blockIndex - paragraph.blockIndex) <= 1);
    });
    const rules = [
      this.rule('geo', 'identifiable-subject', 'Identité du sujet', input.title.trim().length >= 12 && facts.firstParagraph.length >= 40 ? 'PASS' : 'WARNING', input.title.length, 'Sujet identifiable structurellement.', 'Clarifiez le titre et l’introduction.'),
      this.rule('geo', 'category', 'Taxonomie', input.category ? 'PASS' : 'FAIL', Boolean(input.category), 'Catégorie assignée.', 'Assignez une catégorie.'),
      this.rule('geo', 'tags', 'Taxonomie', (input.tags?.length ?? 0) > 0 ? 'PASS' : 'WARNING', input.tags?.length ?? 0, 'Tags assignés.', 'Ajoutez des tags pertinents.'),
      this.rule('geo', 'publisher', 'Attribution', 'PASS', 'Oracle Lumira', 'Contrat éditeur Oracle Lumira.', 'Aucune action requise.'),
      this.rule('geo', 'author', 'Attribution', input.author ? 'PASS' : 'NA', Boolean(input.author), 'Auteur expert attribué.', 'Attribuez un auteur lorsque disponible.'),
      this.rule('geo', 'published-date', 'Dates', input.status === EditorialArticleStatus.PUBLISHED ? (input.publishedAt ? 'PASS' : 'FAIL') : 'NA', Boolean(input.publishedAt), 'Date de publication disponible.', 'Publiez avec une date de publication.'),
      this.rule('geo', 'search-modified-date', 'Dates', input.status === EditorialArticleStatus.PUBLISHED ? (input.searchModifiedAt ? 'PASS' : 'WARNING') : 'NA', Boolean(input.searchModifiedAt), 'Date de modification éditoriale honnête.', 'Enregistrez une modification publique significative.'),
      this.rule('geo', 'external-sources', 'Sources', facts.externalLinks.length ? 'PASS' : 'NA', facts.externalLinks.length, 'Sources externes observables.', 'Citez des sources seulement lorsqu’elles sont pertinentes.'),
      this.rule('geo', 'attribution', 'Sources', facts.externalLinks.length ? (facts.externalLinks.every((link) => link.text.length >= 4) ? 'PASS' : 'WARNING') : 'NA', facts.externalLinks.length, 'Attribution des sources par ancre.', 'Utilisez des ancres qui identifient la source.'),
      this.rule('geo', 'evidence-proximity', 'Sources', facts.externalLinks.length ? (hasEvidenceNearSource ? 'PASS' : 'WARNING') : 'NA', hasEvidenceNearSource, 'Source proche d’un élément probant.', 'Placez une source dans le même bloc ou contexte proche du chiffre ou de la citation.'),
      this.rule('geo', 'metadata', 'Métadonnées', hasMetadata ? 'PASS' : 'WARNING', hasMetadata, 'Métadonnées cohérentes.', 'Renseignez titre, description et canonical.'),
      this.rule('geo', 'structured-data-inputs', 'Données structurées', hasMetadata && Boolean(input.publishedAt) && Boolean(input.category) ? 'PASS' : 'NA', hasMetadata, 'Champs nécessaires aux données structurées.', 'Ce contrôle s’applique lorsque la page est publiable.'),
      this.rule('geo', 'structured-data-rendered', 'Rendu public', 'DEFERRED', undefined, 'JSON-LD réellement rendu.', 'À vérifier après publication réelle.'),
      this.rule('geo', 'internal-links', 'Maillage', (input.outboundLinks?.length ?? 0) > 0 || facts.internalLinks.length > 0 ? 'PASS' : 'NA', facts.internalLinks.length + (input.outboundLinks?.length ?? 0), 'Maillage interne observable.', 'Ajoutez un lien interne pertinent si nécessaire.'),
      this.rule('geo', 'category-cluster', 'Taxonomie', input.category && (input.tags?.length ?? 0) > 0 ? 'PASS' : 'WARNING', input.tags?.length ?? 0, 'Cluster catégorie et tags.', 'Associez catégorie et tags cohérents.'),
      this.rule('geo', 'faq', 'Structure', facts.faq.length ? 'PASS' : 'NA', facts.faq.length, 'FAQ observable.', 'Ajoutez une FAQ seulement si elle répond à des besoins réels.'),
      this.rule('geo', 'citable-structure', 'Structure', facts.paragraphs.some((paragraph) => paragraph.text.length >= 80 && paragraph.text.length <= 420) && facts.headings.length >= 2 ? 'PASS' : 'WARNING', facts.paragraphs.length, 'Structure extractible par segments.', 'Ajoutez des sections et paragraphes autonomes.'),
    ];
    return this.result(rules, inputHash);
  }

  private publicationGate(input: EditorialContentAuditInput, facts: EditorialContentFacts): EditorialPublicationGate {
    const blocked: string[] = [];
    const warnings: string[] = [];
    if (!input.title.trim()) blocked.push('Le titre est requis.');
    if (!facts.wordCount) blocked.push('Le contenu éditorial est vide ou invalide.');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) blocked.push('Le slug est invalide.');
    if (!input.category || input.category.isActive === false) blocked.push('Une catégorie active est requise.');
    if (input.status === EditorialArticleStatus.PUBLISHED && !input.publishedAt) blocked.push('Un article publié requiert publishedAt.');
    if (!input.seoTitle?.trim() || !input.seoDescription?.trim()) warnings.push('Les métadonnées SEO sont incomplètes.');
    if (input.coverAsset && !input.coverAsset.altText?.trim()) warnings.push('La couverture n’a pas de texte alternatif.');
    if (!(input.tags?.length ?? 0)) warnings.push('Aucun tag n’est associé.');
    return blocked.length ? { status: 'BLOCKED', reasons: blocked } : warnings.length ? { status: 'WARNING', reasons: warnings } : { status: 'READY', reasons: [] };
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

  private result(rules: EditorialAuditRule[], inputHash: string): EditorialAuditResult {
    const applicableWeight = rules.filter((rule) => rule.status !== 'NA').reduce((sum, rule) => sum + rule.weight, 0);
    const evaluatedRules = rules.filter((rule) => rule.status !== 'NA' && rule.status !== 'DEFERRED');
    const evaluatedWeight = evaluatedRules.reduce((sum, rule) => sum + rule.weight, 0);
    const earnedWeight = evaluatedRules.reduce(
      (sum, rule) => sum + rule.weight * (EDITORIAL_AUDIT_STATUS_MULTIPLIER[rule.status as keyof typeof EDITORIAL_AUDIT_STATUS_MULTIPLIER] ?? 0),
      0,
    );
    return {
      score: evaluatedWeight ? Math.round((earnedWeight / evaluatedWeight) * 100) : 100,
      coverage: applicableWeight ? Math.round((evaluatedWeight / applicableWeight) * 100) : 100,
      rules,
      ruleVersion: EDITORIAL_AUDIT_RULE_VERSION,
      inputHash,
    };
  }

  private softLength(value: number, min: number, max: number): 'PASS' | 'WARNING' {
    return value >= min && value <= max ? 'PASS' : 'WARNING';
  }

  private validHeadingHierarchy(levels: number[]) {
    return levels.every((level, index) => index === 0 || level <= levels[index - 1] + 1);
  }
}

export { editorialAuditWeightTotal };
