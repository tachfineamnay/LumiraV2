import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EditorialArticleStatus, EditorialInternalLinkStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { analyzeEditorialContent } from './editorial-content-analyzer';
import { EDITORIAL_LINKING_CONFIG, FRENCH_EDITORIAL_STOPWORDS } from './editorial-linking.config';

type LinkingArticle = {
  id: string;
  title: string;
  slug: string;
  status: EditorialArticleStatus;
  publishedAt: Date | null;
  categoryId: string;
  focusKeyword: string | null;
  contentJson: Prisma.JsonValue;
  tags: Array<{ tag: { id: string; name: string; slug: string } }>;
};

type LinkingRecord = {
  id: string;
  sourceArticleId: string;
  targetArticleId: string;
  anchorText: string | null;
  status: EditorialInternalLinkStatus;
  relevanceScore: number | null;
};

type SimilarityBreakdown = Record<keyof typeof EDITORIAL_LINKING_CONFIG.weights, number>;

export function normalizeEditorialTerms(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 3 && !FRENCH_EDITORIAL_STOPWORDS.has(term));
}

function overlap(left: Iterable<string>, right: Iterable<string>) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (!leftSet.size || !rightSet.size) return 0;
  const intersection = [...leftSet].filter((term) => rightSet.has(term)).length;
  return intersection / new Set([...leftSet, ...rightSet]).size;
}

function significantTerms(article: LinkingArticle) {
  const facts = analyzeEditorialContent(article.contentJson);
  const counts = new Map<string, number>();
  for (const term of normalizeEditorialTerms(
    [
      article.title,
      article.focusKeyword ?? '',
      ...facts.headings.map((heading) => heading.text),
      ...facts.paragraphs.map((paragraph) => paragraph.text),
    ].join(' '),
  )) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(
      ([leftTerm, leftCount], [rightTerm, rightCount]) =>
        rightCount - leftCount || leftTerm.localeCompare(rightTerm, 'fr'),
    )
    .slice(0, 24)
    .map(([term]) => term);
}

function isPubliclyLinkable(article: LinkingArticle, now: Date) {
  return (
    article.status === EditorialArticleStatus.PUBLISHED &&
    Boolean(article.publishedAt && article.publishedAt <= now)
  );
}

@Injectable()
export class EditorialLinkingService {
  constructor(private readonly prisma: PrismaService) {}

  async getArticleGraph(articleId: string) {
    const [articles, links] = await Promise.all([this.findGraphArticles(), this.findLinks()]);
    const article = articles.find((candidate) => candidate.id === articleId);
    if (!article) throw new NotFoundException(`Article introuvable ou archivé (${articleId})`);

    return {
      article: this.articleSummary(article),
      inbound: this.linksFor(article.id, links, articles, 'inbound'),
      outbound: this.linksFor(article.id, links, articles, 'outbound'),
      relatedArticles: this.rank(article, articles, links)
        .filter((candidate) => candidate.score >= EDITORIAL_LINKING_CONFIG.minimumSuggestionScore)
        .slice(0, EDITORIAL_LINKING_CONFIG.maxSuggestionsPerDirection),
      health: this.health(articles, links),
      ruleVersion: EDITORIAL_LINKING_CONFIG.ruleVersion,
    };
  }

  async listSuggestions(articleId: string) {
    const article = await this.prisma.editorialArticle.findUnique({
      where: { id: articleId },
      select: { id: true },
    });
    if (!article) throw new NotFoundException(`Article introuvable (${articleId})`);
    return this.prisma.editorialArticleLink.findMany({
      where: {
        status: EditorialInternalLinkStatus.SUGGESTED,
        OR: [{ sourceArticleId: articleId }, { targetArticleId: articleId }],
      },
      orderBy: [{ relevanceScore: 'desc' }, { createdAt: 'asc' }],
      include: {
        sourceArticle: { select: { id: true, title: true, slug: true, status: true } },
        targetArticle: { select: { id: true, title: true, slug: true, status: true } },
      },
    });
  }

  /** Generates records only after an explicit admin request; it never edits Tiptap content. */
  async generateSuggestions(articleId: string) {
    const [articles, links] = await Promise.all([this.findGraphArticles(), this.findLinks()]);
    const article = articles.find((candidate) => candidate.id === articleId);
    if (!article) throw new NotFoundException(`Article introuvable ou archivé (${articleId})`);

    const suggestions = this.rank(article, articles, links)
      .filter((candidate) => candidate.score >= EDITORIAL_LINKING_CONFIG.minimumSuggestionScore)
      .slice(0, EDITORIAL_LINKING_CONFIG.maxSuggestionsPerDirection);

    const persisted = [];
    for (const suggestion of suggestions) {
      const target = articles.find((candidate) => candidate.id === suggestion.article.id);
      if (!target) continue;
      for (const [source, destination] of [
        [article, target],
        [target, article],
      ] as const) {
        if (source.id === destination.id) continue;
        const existing = links.find(
          (link) => link.sourceArticleId === source.id && link.targetArticleId === destination.id,
        );
        if (
          existing?.status === EditorialInternalLinkStatus.ACTIVE ||
          existing?.status === EditorialInternalLinkStatus.IGNORED
        )
          continue;
        const anchorText = this.suggestedAnchor(destination);
        if (existing) {
          persisted.push(
            await this.prisma.editorialArticleLink.update({
              where: { id: existing.id },
              data: { relevanceScore: suggestion.score, anchorText },
            }),
          );
        } else {
          persisted.push(
            await this.prisma.editorialArticleLink.create({
              data: {
                sourceArticleId: source.id,
                targetArticleId: destination.id,
                status: EditorialInternalLinkStatus.SUGGESTED,
                relevanceScore: suggestion.score,
                anchorText,
              },
            }),
          );
        }
      }
    }
    return { suggestions: persisted, ruleVersion: EDITORIAL_LINKING_CONFIG.ruleVersion };
  }

  async acceptSuggestion(linkId: string) {
    const link = await this.findLink(linkId);
    this.assertUsableLink(link);
    return this.prisma.editorialArticleLink.update({
      where: { id: linkId },
      data: { status: EditorialInternalLinkStatus.ACTIVE },
    });
  }

  async ignoreSuggestion(linkId: string) {
    await this.findLink(linkId);
    return this.prisma.editorialArticleLink.update({
      where: { id: linkId },
      data: { status: EditorialInternalLinkStatus.IGNORED },
    });
  }

  async removeLink(linkId: string) {
    await this.findLink(linkId);
    return this.prisma.editorialArticleLink.delete({ where: { id: linkId } });
  }

  async listOrphans() {
    const [articles, links] = await Promise.all([this.findGraphArticles(), this.findLinks()]);
    return this.health(articles, links).orphans;
  }

  async getClusterHealth() {
    const [articles, links] = await Promise.all([this.findGraphArticles(), this.findLinks()]);
    return this.health(articles, links);
  }

  private async findGraphArticles(): Promise<LinkingArticle[]> {
    const articles = await this.prisma.editorialArticle.findMany({
      where: { status: { not: EditorialArticleStatus.ARCHIVED } },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
        categoryId: true,
        focusKeyword: true,
        contentJson: true,
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
      },
    });
    return articles.filter((article) => article.status !== EditorialArticleStatus.ARCHIVED);
  }

  private async findLinks(): Promise<LinkingRecord[]> {
    return this.prisma.editorialArticleLink.findMany({
      select: {
        id: true,
        sourceArticleId: true,
        targetArticleId: true,
        anchorText: true,
        status: true,
        relevanceScore: true,
      },
    });
  }

  private async findLink(linkId: string) {
    const link = await this.prisma.editorialArticleLink.findUnique({
      where: { id: linkId },
      include: {
        sourceArticle: { select: { id: true, status: true } },
        targetArticle: { select: { id: true, status: true } },
      },
    });
    if (!link) throw new NotFoundException(`Lien éditorial introuvable (${linkId})`);
    return link;
  }

  private assertUsableLink(link: Awaited<ReturnType<EditorialLinkingService['findLink']>>) {
    if (link.sourceArticleId === link.targetArticleId) {
      throw new BadRequestException('Un article ne peut pas être lié à lui-même.');
    }
    if (
      link.sourceArticle.status === EditorialArticleStatus.ARCHIVED ||
      link.targetArticle.status === EditorialArticleStatus.ARCHIVED
    ) {
      throw new BadRequestException(
        'Un lien vers ou depuis un article archivé ne peut pas être activé.',
      );
    }
  }

  private rank(source: LinkingArticle, articles: LinkingArticle[], links: LinkingRecord[]) {
    return articles
      .filter((target) => target.id !== source.id)
      .map((target) => {
        const breakdown = this.similarity(source, target, links);
        const score = Object.entries(EDITORIAL_LINKING_CONFIG.weights).reduce(
          (total, [key, weight]) => total + breakdown[key as keyof SimilarityBreakdown] * weight,
          0,
        );
        const directLink = links.find(
          (link) =>
            (link.sourceArticleId === source.id && link.targetArticleId === target.id) ||
            (link.sourceArticleId === target.id && link.targetArticleId === source.id),
        );
        return {
          article: this.articleSummary(target),
          score: Number(score.toFixed(4)),
          factors: breakdown,
          existingLinkStatus: directLink?.status ?? null,
        };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.article.title.localeCompare(right.article.title, 'fr') ||
          left.article.id.localeCompare(right.article.id),
      );
  }

  private similarity(
    source: LinkingArticle,
    target: LinkingArticle,
    links: LinkingRecord[],
  ): SimilarityBreakdown {
    const sourceFacts = analyzeEditorialContent(source.contentJson);
    const targetFacts = analyzeEditorialContent(target.contentJson);
    const sourceNeighbors = this.neighbors(source.id, links);
    const targetNeighbors = this.neighbors(target.id, links);
    const direct = sourceNeighbors.has(target.id) || targetNeighbors.has(source.id);
    return {
      category: source.categoryId === target.categoryId ? 1 : 0,
      tags: overlap(
        source.tags.map(({ tag }) => tag.id),
        target.tags.map(({ tag }) => tag.id),
      ),
      focusKeyword: overlap(
        normalizeEditorialTerms(source.focusKeyword ?? ''),
        normalizeEditorialTerms(target.focusKeyword ?? ''),
      ),
      title: overlap(normalizeEditorialTerms(source.title), normalizeEditorialTerms(target.title)),
      headings: overlap(
        normalizeEditorialTerms(
          sourceFacts.headings
            .filter((heading) => heading.level === 2 || heading.level === 3)
            .map((heading) => heading.text)
            .join(' '),
        ),
        normalizeEditorialTerms(
          targetFacts.headings
            .filter((heading) => heading.level === 2 || heading.level === 3)
            .map((heading) => heading.text)
            .join(' '),
        ),
      ),
      terms: overlap(significantTerms(source), significantTerms(target)),
      graph: direct ? 1 : overlap(sourceNeighbors, targetNeighbors),
    };
  }

  private neighbors(articleId: string, links: LinkingRecord[]) {
    return new Set(
      links
        .filter((link) => link.status === EditorialInternalLinkStatus.ACTIVE)
        .flatMap((link) =>
          link.sourceArticleId === articleId
            ? [link.targetArticleId]
            : link.targetArticleId === articleId
              ? [link.sourceArticleId]
              : [],
        ),
    );
  }

  private linksFor(
    articleId: string,
    links: LinkingRecord[],
    articles: LinkingArticle[],
    direction: 'inbound' | 'outbound',
  ) {
    const byId = new Map(articles.map((article) => [article.id, article]));
    return links
      .filter((link) =>
        direction === 'inbound'
          ? link.targetArticleId === articleId
          : link.sourceArticleId === articleId,
      )
      .map((link) => ({
        ...link,
        article: this.articleSummary(
          byId.get(direction === 'inbound' ? link.sourceArticleId : link.targetArticleId),
        ),
      }))
      .sort(
        (left, right) =>
          (left.article?.title ?? '').localeCompare(right.article?.title ?? '', 'fr') ||
          left.id.localeCompare(right.id),
      );
  }

  private health(articles: LinkingArticle[], links: LinkingRecord[]) {
    const now = new Date();
    const publicArticles = articles.filter((article) => isPubliclyLinkable(article, now));
    const publicIds = new Set(publicArticles.map((article) => article.id));
    const activeLinks = links.filter((link) => link.status === EditorialInternalLinkStatus.ACTIVE);
    const validLinks = activeLinks.filter(
      (link) => publicIds.has(link.sourceArticleId) && publicIds.has(link.targetArticleId),
    );
    const linkedIds = new Set(
      validLinks.flatMap((link) => [link.sourceArticleId, link.targetArticleId]),
    );
    const byId = new Map(articles.map((article) => [article.id, article]));
    const duplicateGroups = new Map<string, LinkingRecord[]>();
    for (const link of links) {
      const key = `${link.sourceArticleId}:${link.targetArticleId}`;
      duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), link]);
    }
    const anchorCounts = new Map<string, number>();
    for (const link of validLinks) {
      const anchor = link.anchorText?.trim() || '(sans ancre)';
      anchorCounts.set(anchor, (anchorCounts.get(anchor) ?? 0) + 1);
    }

    return {
      articleCount: publicArticles.length,
      activeLinkCount: validLinks.length,
      orphans: publicArticles
        .filter((article) => !linkedIds.has(article.id))
        .map((article) => this.articleSummary(article)),
      brokenTargets: activeLinks
        .filter((link) => !publicIds.has(link.targetArticleId))
        .map((link) => ({
          ...link,
          targetArticle: this.articleSummary(byId.get(link.targetArticleId)),
        })),
      selfLinks: links.filter((link) => link.sourceArticleId === link.targetArticleId),
      duplicates: [...duplicateGroups.values()].filter((group) => group.length > 1),
      anchorDistribution: [...anchorCounts.entries()]
        .map(([anchor, count]) => ({
          anchor,
          count,
          generic: EDITORIAL_LINKING_CONFIG.genericAnchors.includes(anchor.toLowerCase() as never),
        }))
        .sort(
          (left, right) =>
            right.count - left.count || left.anchor.localeCompare(right.anchor, 'fr'),
        ),
      clusters: this.clusterHealth(publicArticles, validLinks),
    };
  }

  private clusterHealth(articles: LinkingArticle[], links: LinkingRecord[]) {
    const groups = new Map<string, LinkingArticle[]>();
    for (const article of articles)
      groups.set(article.categoryId, [...(groups.get(article.categoryId) ?? []), article]);
    return [...groups.entries()]
      .map(([categoryId, cluster]) => {
        const ids = new Set(cluster.map((article) => article.id));
        const clusterLinks = links.filter(
          (link) => ids.has(link.sourceArticleId) && ids.has(link.targetArticleId),
        );
        const components = this.componentCount(ids, clusterLinks);
        return {
          categoryId,
          articleCount: cluster.length,
          activeLinkCount: clusterLinks.length,
          componentCount: components,
          connectivity:
            cluster.length <= 1
              ? 100
              : Math.round(((cluster.length - components) / (cluster.length - 1)) * 100),
        };
      })
      .sort((left, right) => left.categoryId.localeCompare(right.categoryId));
  }

  private componentCount(ids: Set<string>, links: LinkingRecord[]) {
    const adjacency = new Map([...ids].map((id) => [id, new Set<string>()]));
    for (const link of links) {
      adjacency.get(link.sourceArticleId)?.add(link.targetArticleId);
      adjacency.get(link.targetArticleId)?.add(link.sourceArticleId);
    }
    const seen = new Set<string>();
    let components = 0;
    for (const id of ids) {
      if (seen.has(id)) continue;
      components += 1;
      const queue = [id];
      seen.add(id);
      while (queue.length) {
        const current = queue.shift()!;
        for (const next of adjacency.get(current) ?? []) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
    }
    return components;
  }

  private suggestedAnchor(target: LinkingArticle) {
    return `En savoir plus sur ${target.title}`;
  }

  private articleSummary(article: LinkingArticle | undefined) {
    return article
      ? { id: article.id, title: article.title, slug: article.slug, status: article.status }
      : null;
  }
}
