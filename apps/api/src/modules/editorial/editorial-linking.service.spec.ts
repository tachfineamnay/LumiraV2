import { BadRequestException } from '@nestjs/common';
import { EditorialArticleStatus, EditorialInternalLinkStatus } from '@prisma/client';
import { EditorialLinkingService, normalizeEditorialTerms } from './editorial-linking.service';

const content = (heading: string, paragraph: string) => ({
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: heading }] },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Repères relationnels' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text: paragraph }] },
  ],
});

const article = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Article ${id} sur les relations`,
  slug: `article-${id}`,
  status: EditorialArticleStatus.PUBLISHED,
  publishedAt: new Date('2026-08-01T00:00:00.000Z'),
  categoryId: 'cat-relations',
  focusKeyword: 'peur abandon',
  contentJson: content(
    `Article ${id}`,
    'Comprendre les relations, les émotions et la peur de l’abandon.',
  ),
  tags: [{ tag: { id: 'tag-relations', name: 'Relations', slug: 'relations' } }],
  ...overrides,
});

describe('EditorialLinkingService', () => {
  let articles: any[];
  let links: any[];
  let prisma: any;
  let service: EditorialLinkingService;

  beforeEach(() => {
    articles = [article('a'), article('b'), article('orphan')];
    links = [];
    prisma = {
      editorialArticle: {
        findMany: jest.fn(async () => articles),
        findUnique: jest.fn(
          async ({ where }: any) => articles.find((entry) => entry.id === where.id) ?? null,
        ),
      },
      editorialArticleLink: {
        findMany: jest.fn(async () => links),
        findUnique: jest.fn(
          async ({ where }: any) => links.find((entry) => entry.id === where.id) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => ({ id: `link-${links.length + 1}`, ...data })),
        update: jest.fn(async ({ where, data }: any) => ({
          ...links.find((entry) => entry.id === where.id),
          ...data,
        })),
        delete: jest.fn(async ({ where }: any) => ({ id: where.id })),
      },
    };
    service = new EditorialLinkingService(prisma);
  });

  it('normalizes French terms deterministically without accents or stopwords', () => {
    expect(normalizeEditorialTerms('Les ÉMOTIONS, dans la relation !')).toEqual([
      'emotions',
      'relation',
    ]);
  });

  it('returns the same deterministic related ranking and leaves the orphan visible', async () => {
    const first = await service.getArticleGraph('a');
    const second = await service.getArticleGraph('a');
    expect(first.relatedArticles).toEqual(second.relatedArticles);
    expect(first.health.orphans).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'orphan' })]),
    );
    expect(first.relatedArticles.every((entry: any) => entry.article.id !== 'a')).toBe(true);
  });

  it('detects broken targets, duplicate rows and self links defensively', async () => {
    articles.push(article('draft', { status: EditorialArticleStatus.DRAFT, publishedAt: null }));
    links = [
      {
        id: 'self',
        sourceArticleId: 'a',
        targetArticleId: 'a',
        status: EditorialInternalLinkStatus.ACTIVE,
        anchorText: 'Article a',
        relevanceScore: 1,
      },
      {
        id: 'broken',
        sourceArticleId: 'a',
        targetArticleId: 'draft',
        status: EditorialInternalLinkStatus.ACTIVE,
        anchorText: 'Article draft',
        relevanceScore: 1,
      },
      {
        id: 'duplicate-1',
        sourceArticleId: 'a',
        targetArticleId: 'b',
        status: EditorialInternalLinkStatus.ACTIVE,
        anchorText: 'Relations',
        relevanceScore: 1,
      },
      {
        id: 'duplicate-2',
        sourceArticleId: 'a',
        targetArticleId: 'b',
        status: EditorialInternalLinkStatus.ACTIVE,
        anchorText: 'Relations',
        relevanceScore: 1,
      },
    ];
    const health = await service.getClusterHealth();
    expect(health.selfLinks).toHaveLength(1);
    expect(health.brokenTargets).toEqual([expect.objectContaining({ id: 'broken' })]);
    expect(health.duplicates).toHaveLength(1);
  });

  it('creates bidirectional suggestions for a draft article while excluding archived articles', async () => {
    articles = [
      article('new', { status: EditorialArticleStatus.DRAFT, publishedAt: null }),
      article('existing'),
      article('archived', { status: EditorialArticleStatus.ARCHIVED }),
    ];
    const result = await service.generateSuggestions('new');
    expect(result.suggestions).toHaveLength(2);
    expect(prisma.editorialArticleLink.create).toHaveBeenCalledTimes(2);
    expect(
      prisma.editorialArticleLink.create.mock.calls.flatMap(([call]: any[]) => [
        call.data.sourceArticleId,
        call.data.targetArticleId,
      ]),
    ).not.toContain('archived');
  });

  it('refuses a self-link or archived link at acceptance time', async () => {
    links = [
      {
        id: 'self',
        sourceArticleId: 'a',
        targetArticleId: 'a',
        status: EditorialInternalLinkStatus.SUGGESTED,
        sourceArticle: { id: 'a', status: EditorialArticleStatus.PUBLISHED },
        targetArticle: { id: 'a', status: EditorialArticleStatus.PUBLISHED },
      },
    ];
    await expect(service.acceptSuggestion('self')).rejects.toBeInstanceOf(BadRequestException);
    links = [
      {
        id: 'archive',
        sourceArticleId: 'a',
        targetArticleId: 'archive',
        status: EditorialInternalLinkStatus.SUGGESTED,
        sourceArticle: { id: 'a', status: EditorialArticleStatus.PUBLISHED },
        targetArticle: { id: 'archive', status: EditorialArticleStatus.ARCHIVED },
      },
    ];
    await expect(service.acceptSuggestion('archive')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.editorialArticleLink.update).not.toHaveBeenCalled();
  });
});
