import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EditorialService } from './editorial.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EditorialArticleStatus, EditorialPublicationEventType } from '@prisma/client';

describe('EditorialService', () => {
  let service: EditorialService;
  let prisma: Record<string, any>;

  const mockCategory = {
    id: 'cat-1',
    name: 'Relations & amour',
    slug: 'relations-amour',
    description: 'Relations',
    seoTitle: 'SEO Title',
    seoDescription: 'SEO Desc',
    sortOrder: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTag = {
    id: 'tag-1',
    name: "Peur de l'abandon",
    slug: 'peur-de-labandon',
    family: 'Émotions & blocages',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    aliases: [{ id: 'alias-1', alias: 'peur abandon', tagId: 'tag-1', createdAt: new Date() }],
  };

  const mockDraftArticle = {
    id: 'art-draft',
    title: "Comprendre la peur de l'abandon",
    slug: 'comprendre-la-peur-de-labandon',
    excerpt: "Un aperçu de la peur d'abandon",
    contentJson: { blocks: [] },
    contentHtml: '<p>Contenu</p>',
    plainText: 'Contenu',
    status: EditorialArticleStatus.DRAFT,
    categoryId: 'cat-1',
    publishedAt: null,
    scheduledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPublishedArticle = {
    id: 'art-published',
    title: 'Vivre pleinement son intuition',
    slug: 'vivre-pleinement-son-intuition',
    excerpt: 'Intuition et guidance',
    contentJson: { blocks: [] },
    contentHtml: '<p>Guide intuition</p>',
    plainText: 'Guide intuition',
    status: EditorialArticleStatus.PUBLISHED,
    categoryId: 'cat-1',
    publishedAt: new Date(Date.now() - 3600000), // 1h ago
    scheduledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockScheduledArticle = {
    id: 'art-scheduled',
    title: 'Future Publication',
    slug: 'future-publication',
    excerpt: 'Contenu futur',
    contentJson: { blocks: [] },
    contentHtml: '<p>Futur</p>',
    plainText: 'Futur',
    status: EditorialArticleStatus.SCHEDULED,
    categoryId: 'cat-1',
    publishedAt: null,
    scheduledAt: new Date(Date.now() + 86400000), // tomorrow
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockArchivedArticle = {
    id: 'art-archived',
    title: 'Ancien Article',
    slug: 'ancien-article',
    excerpt: 'Archive',
    contentJson: { blocks: [] },
    contentHtml: '<p>Archive</p>',
    plainText: 'Archive',
    status: EditorialArticleStatus.ARCHIVED,
    categoryId: 'cat-1',
    publishedAt: null,
    scheduledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      editorialCategory: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      editorialTag: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      editorialTagAlias: {
        findUnique: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      editorialArticle: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      editorialArticleTag: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      editorialPublicationEvent: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EditorialService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<EditorialService>(EditorialService);
  });

  describe('createArticle', () => {
    it('creates an article with generated slug and tags', async () => {
      prisma.editorialCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.editorialArticle.findUnique.mockResolvedValue(null);
      prisma.editorialArticle.create.mockResolvedValue(mockDraftArticle);

      const result = await service.createArticle(
        {
          title: "Comprendre la peur de l'abandon",
          contentJson: {},
          contentHtml: '<p>Contenu</p>',
          plainText: 'Contenu',
          categoryId: 'cat-1',
          tagIds: ['tag-1'],
        },
        'expert-admin-1',
      );

      expect(prisma.editorialCategory.findUnique).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
      expect(prisma.editorialArticle.findUnique).toHaveBeenCalledWith({
        where: { slug: 'comprendre-la-peur-de-labandon' },
      });
      expect(prisma.editorialArticle.create).toHaveBeenCalled();
      expect(result).toEqual(mockDraftArticle);
    });

    it('throws ConflictException on slug duplicate', async () => {
      prisma.editorialCategory.findUnique.mockResolvedValue(mockCategory);
      prisma.editorialArticle.findUnique.mockResolvedValue(mockDraftArticle);

      await expect(
        service.createArticle(
          {
            title: "Comprendre la peur de l'abandon",
            contentJson: {},
            contentHtml: '<p>Contenu</p>',
            plainText: 'Contenu',
            categoryId: 'cat-1',
          },
          'expert-admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if category does not exist', async () => {
      prisma.editorialCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.createArticle(
          {
            title: 'Titre',
            contentJson: {},
            contentHtml: '<p>A</p>',
            plainText: 'A',
            categoryId: 'cat-unknown',
          },
          'expert-admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateArticle & Slug Immutability Rule', () => {
    it('blocks slug modification on published article', async () => {
      prisma.editorialArticle.findUnique.mockResolvedValue(mockPublishedArticle);

      await expect(
        service.updateArticle('art-published', {
          title: 'Nouveau titre avec slug modifie',
          slug: 'nouveau-slug-interdit',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows content update on published article if slug is unchanged', async () => {
      prisma.editorialArticle.findUnique.mockResolvedValue(mockPublishedArticle);
      prisma.editorialArticle.update.mockResolvedValue({
        ...mockPublishedArticle,
        excerpt: 'Nouvel extrait',
      });

      const result = await service.updateArticle('art-published', {
        excerpt: 'Nouvel extrait',
      });

      expect(result.excerpt).toBe('Nouvel extrait');
    });

    it('allows slug modification on draft article if not duplicate', async () => {
      prisma.editorialArticle.findUnique
        .mockResolvedValueOnce(mockDraftArticle) // initial findUnique
        .mockResolvedValueOnce(null); // slug check findUnique

      prisma.editorialArticle.update.mockResolvedValue({
        ...mockDraftArticle,
        slug: 'mon-nouveau-brouillon-slug',
      });

      const result = await service.updateArticle('art-draft', {
        slug: 'mon-nouveau-brouillon-slug',
      });

      expect(result.slug).toBe('mon-nouveau-brouillon-slug');
    });
  });

  describe('Lifecycle Events (Publish, Schedule, Unschedule, Archive)', () => {
    it('publishes a draft article', async () => {
      prisma.editorialArticle.findUnique.mockResolvedValue(mockDraftArticle);
      prisma.editorialArticle.update.mockResolvedValue({
        ...mockDraftArticle,
        status: EditorialArticleStatus.PUBLISHED,
        publishedAt: new Date(),
      });

      const result = await service.publishArticle('art-draft');

      expect(result.status).toBe(EditorialArticleStatus.PUBLISHED);
      expect(prisma.editorialPublicationEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          articleId: 'art-draft',
          type: EditorialPublicationEventType.PUBLISHED,
        }),
      });
    });

    it('schedules an article for future date', async () => {
      prisma.editorialArticle.findUnique.mockResolvedValue(mockDraftArticle);
      const futureDate = new Date(Date.now() + 86400000);
      prisma.editorialArticle.update.mockResolvedValue({
        ...mockDraftArticle,
        status: EditorialArticleStatus.SCHEDULED,
        scheduledAt: futureDate,
      });

      const result = await service.scheduleArticle('art-draft', futureDate);

      expect(result.status).toBe(EditorialArticleStatus.SCHEDULED);
      expect(prisma.editorialPublicationEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          articleId: 'art-draft',
          type: EditorialPublicationEventType.SCHEDULED,
        }),
      });
    });

    it('rejects scheduling in the past', async () => {
      prisma.editorialArticle.findUnique.mockResolvedValue(mockDraftArticle);
      const pastDate = new Date(Date.now() - 86400000);

      await expect(service.scheduleArticle('art-draft', pastDate)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unschedules a scheduled article', async () => {
      prisma.editorialArticle.findUnique.mockResolvedValue(mockScheduledArticle);
      prisma.editorialArticle.update.mockResolvedValue({
        ...mockScheduledArticle,
        status: EditorialArticleStatus.DRAFT,
        scheduledAt: null,
      });

      const result = await service.unscheduleArticle('art-scheduled');

      expect(result.status).toBe(EditorialArticleStatus.DRAFT);
      expect(prisma.editorialPublicationEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          articleId: 'art-scheduled',
          type: EditorialPublicationEventType.UNSCHEDULED,
        }),
      });
    });

    it('archives an article', async () => {
      prisma.editorialArticle.findUnique.mockResolvedValue(mockPublishedArticle);
      prisma.editorialArticle.update.mockResolvedValue({
        ...mockPublishedArticle,
        status: EditorialArticleStatus.ARCHIVED,
      });

      const result = await service.archiveArticle('art-published');

      expect(result.status).toBe(EditorialArticleStatus.ARCHIVED);
      expect(prisma.editorialPublicationEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          articleId: 'art-published',
          type: EditorialPublicationEventType.ARCHIVED,
        }),
      });
    });
  });

  describe('Public Security Rules (Draft/Scheduled/Archived invisible in Public API)', () => {
    it('returns published articles only in findPublicArticles', async () => {
      prisma.editorialArticle.count.mockResolvedValue(1);
      prisma.editorialArticle.findMany.mockResolvedValue([
        {
          ...mockPublishedArticle,
          category: mockCategory,
          tags: [{ tag: mockTag }],
          coverAsset: null,
        },
      ]);

      const result = await service.findPublicArticles({});

      expect(prisma.editorialArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: EditorialArticleStatus.PUBLISHED,
            publishedAt: expect.objectContaining({ lte: expect.any(Date) }),
          }),
        }),
      );
      expect(result.data.length).toBe(1);
      expect(result.data[0].slug).toBe('vivre-pleinement-son-intuition');
    });

    it('throws NotFoundException for draft article in findPublicArticleBySlug', async () => {
      prisma.editorialArticle.findFirst.mockResolvedValue(null);

      await expect(
        service.findPublicArticleBySlug('comprendre-la-peur-de-labandon'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for scheduled article in findPublicArticleBySlug', async () => {
      prisma.editorialArticle.findFirst.mockResolvedValue(null);

      await expect(service.findPublicArticleBySlug('future-publication')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for archived article in findPublicArticleBySlug', async () => {
      prisma.editorialArticle.findFirst.mockResolvedValue(null);

      await expect(service.findPublicArticleBySlug('ancien-article')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Categories & Tags & Tag Alias Resolution', () => {
    it('creates category with normalized slug', async () => {
      prisma.editorialCategory.findUnique.mockResolvedValue(null);
      prisma.editorialCategory.create.mockResolvedValue(mockCategory);

      const result = await service.createCategory({
        name: 'Relations & amour',
        description: 'Relations',
      });

      expect(prisma.editorialCategory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Relations & amour',
          slug: 'relations-amour',
        }),
      });
      expect(result).toEqual(mockCategory);
    });

    it('resolves alias match to tag', async () => {
      prisma.editorialTagAlias.findUnique.mockResolvedValue({
        id: 'alias-1',
        alias: 'peur abandon',
        tagId: 'tag-1',
        tag: mockTag,
      });

      const result = await service.resolveTagAlias('peur abandon');

      expect(result.matchedBy).toBe('ALIAS');
      expect(result.tag.name).toBe("Peur de l'abandon");
    });

    it('resolves direct tag name/slug if alias not matched', async () => {
      prisma.editorialTagAlias.findUnique.mockResolvedValue(null);
      prisma.editorialTag.findFirst.mockResolvedValue(mockTag);

      const result = await service.resolveTagAlias("Peur de l'abandon");

      expect(result.matchedBy).toBe('DIRECT_TAG');
      expect(result.tag.slug).toBe('peur-de-labandon');
    });

    it('throws NotFoundException if alias and tag both unresolvable', async () => {
      prisma.editorialTagAlias.findUnique.mockResolvedValue(null);
      prisma.editorialTag.findFirst.mockResolvedValue(null);

      await expect(service.resolveTagAlias('inconnu')).rejects.toThrow(NotFoundException);
    });
  });
});
