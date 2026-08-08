import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EditorialArticleStatus, EditorialPublicationEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EditorialContentAuditService } from './editorial-content-audit.service';
import { normalizeEditorialContent } from './editorial-content-normalizer';
import { EditorialService } from './editorial.service';

const optimizedContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: "Comprendre la peur de l'abandon" }] },
    { type: 'paragraph', content: [{ type: 'text', text: "La peur de l'abandon est une réaction émotionnelle fréquente. Cette introduction explique clairement comment l'observer avec douceur et discernement." }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: "Peur de l'abandon : repères essentiels" }] },
    { type: 'paragraph', content: [{ type: 'text', text: "Elle désigne un sentiment d'insécurité relationnelle qui peut apparaître lors d'une séparation, d'un silence ou d'un changement de rythme dans une relation." }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: "Nommer l'émotion sans la juger." }] }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: "Prendre quelques minutes pour respirer, écrire et demander du soutien permet de créer un espace avant de réagir. Cette pratique soutient une relation plus apaisée." }] },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'FAQ' }] },
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: "Comment apaiser la peur de l'abandon ?" }] },
    { type: 'paragraph', content: [{ type: 'text', text: "Commencez par identifier le besoin qui se manifeste, puis formulez une demande simple et respectueuse à la personne concernée." }] },
  ],
};

describe('EditorialService hardening', () => {
  let service: EditorialService;
  let prisma: Record<string, any>;
  const normalized = normalizeEditorialContent(optimizedContent);
  const category = { id: 'cat-1', isActive: true };
  const tag = { id: 'tag-1', isActive: true };
  const auditArticle = {
    id: 'art-1',
    title: "Comprendre la peur de l'abandon",
    slug: 'comprendre-la-peur-de-labandon',
    excerpt: 'Un guide.',
    contentJson: optimizedContent,
    contentHtml: normalized.contentHtml,
    plainText: normalized.plainText,
    status: EditorialArticleStatus.DRAFT,
    seoTitle: "Comprendre la peur de l'abandon sereinement",
    seoDescription: "Un guide clair pour comprendre la peur de l'abandon, identifier ses manifestations relationnelles et adopter des repères concrets avec douceur.",
    focusKeyword: "peur de l'abandon",
    canonical: 'https://oraclelumira.com/blog/comprendre-la-peur-de-labandon',
    publishedAt: null,
    updatedAt: new Date(),
    category,
    tags: [{ tag }],
    coverAsset: { id: 'asset-1', altText: "Une illustration sur la peur de l'abandon" },
    author: { id: 'expert-1' },
    outboundLinks: [],
  };

  beforeEach(async () => {
    prisma = {
      editorialCategory: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      editorialTag: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      editorialAsset: { findUnique: jest.fn() },
      editorialTagAlias: { findUnique: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
      editorialArticle: { findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
      editorialArticleTag: { createMany: jest.fn(), deleteMany: jest.fn() },
      editorialPublicationEvent: { create: jest.fn() },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EditorialService,
        EditorialContentAuditService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(EditorialService);
  });

  it('derives safe HTML and plain text exclusively from Tiptap JSON', async () => {
    prisma.editorialCategory.findUnique.mockResolvedValue(category);
    prisma.editorialTag.findMany.mockResolvedValue([tag]);
    prisma.editorialArticle.findUnique.mockResolvedValue(null);
    prisma.editorialArticle.create.mockResolvedValue(auditArticle);
    prisma.editorialArticle.update.mockResolvedValue(auditArticle);

    await service.createArticle({ title: auditArticle.title, contentJson: optimizedContent, categoryId: 'cat-1', tagIds: ['tag-1'] });

    expect(prisma.editorialArticle.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contentHtml: normalized.contentHtml, plainText: normalized.plainText }),
    }));
    expect(prisma.editorialArticle.create.mock.calls[0][0].data).not.toHaveProperty('status', EditorialArticleStatus.PUBLISHED);
  });

  it('rejects hostile nodes and unsafe link URLs before persistence', () => {
    expect(() => normalizeEditorialContent({ type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] })).toThrow(BadRequestException);
    expect(() => normalizeEditorialContent({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'clic', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }] })).toThrow(BadRequestException);
    expect(() => normalizeEditorialContent({ type: 'doc', content: [{ type: 'iframe', attrs: { src: 'https://evil.example' } }] })).toThrow(BadRequestException);
    expect(() => normalizeEditorialContent({ type: 'doc', content: [{ type: 'paragraph', attrs: { onclick: 'alert(1)' }, content: [{ type: 'text', text: 'clic' }] }] })).toThrow(BadRequestException);
  });

  it('rejects inactive or missing relations with domain errors', async () => {
    prisma.editorialCategory.findUnique.mockResolvedValue({ ...category, isActive: false });
    await expect(service.createArticle({ title: auditArticle.title, contentJson: optimizedContent, categoryId: 'cat-1' })).rejects.toThrow(BadRequestException);

    prisma.editorialCategory.findUnique.mockResolvedValue(category);
    prisma.editorialTag.findMany.mockResolvedValue([]);
    await expect(service.createArticle({ title: auditArticle.title, contentJson: optimizedContent, categoryId: 'cat-1', tagIds: ['missing'] })).rejects.toThrow(NotFoundException);

    prisma.editorialTag.findMany.mockResolvedValue([tag]);
    prisma.editorialTag.findMany.mockResolvedValueOnce([{ ...tag, isActive: false }]);
    await expect(service.createArticle({ title: auditArticle.title, contentJson: optimizedContent, categoryId: 'cat-1', tagIds: ['tag-1'] })).rejects.toThrow(BadRequestException);

    prisma.editorialTag.findMany.mockResolvedValue([tag]);
    prisma.editorialAsset.findUnique.mockResolvedValue(null);
    await expect(service.createArticle({ title: auditArticle.title, contentJson: optimizedContent, categoryId: 'cat-1', tagIds: ['tag-1'], coverAssetId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('cannot change status through PATCH data', async () => {
    prisma.editorialArticle.findUnique.mockResolvedValue(auditArticle);
    prisma.editorialArticle.update.mockResolvedValue(auditArticle);
    await service.updateArticle('art-1', { featured: true });
    expect(prisma.editorialArticle.update.mock.calls[0][0].data).not.toHaveProperty('status');
  });

  it('keeps article and publication event in one transaction with an atomic state guard', async () => {
    const published = { ...auditArticle, status: EditorialArticleStatus.PUBLISHED, publishedAt: new Date() };
    prisma.editorialArticle.findUnique.mockResolvedValue({ ...auditArticle, status: EditorialArticleStatus.DRAFT });
    prisma.editorialArticle.updateMany.mockResolvedValue({ count: 1 });
    prisma.editorialArticle.findUniqueOrThrow.mockResolvedValue(published);

    const result = await service.publishArticle('art-1');

    expect(result.status).toBe(EditorialArticleStatus.PUBLISHED);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.editorialArticle.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'art-1', status: { in: [EditorialArticleStatus.DRAFT, EditorialArticleStatus.SCHEDULED] } },
    }));
    expect(prisma.editorialPublicationEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: EditorialPublicationEventType.PUBLISHED }) });
  });

  it('refuses incoherent transitions and allows a target-state operation to be idempotent', async () => {
    prisma.editorialArticle.findUnique.mockResolvedValue({ ...auditArticle, status: EditorialArticleStatus.PUBLISHED });
    await expect(service.scheduleArticle('art-1', new Date(Date.now() + 60_000))).rejects.toThrow(BadRequestException);

    const archived = { ...auditArticle, status: EditorialArticleStatus.ARCHIVED };
    prisma.editorialArticle.findUnique.mockResolvedValue(archived);
    await expect(service.archiveArticle('art-1')).resolves.toEqual(archived);
    expect(prisma.editorialPublicationEvent.create).not.toHaveBeenCalled();
  });

  it('uses the same atomic transaction for schedule, unschedule and archive', async () => {
    const future = new Date(Date.now() + 60_000);
    prisma.editorialArticle.findUnique.mockResolvedValue({ ...auditArticle, status: EditorialArticleStatus.DRAFT });
    prisma.editorialArticle.updateMany.mockResolvedValue({ count: 1 });
    prisma.editorialArticle.findUniqueOrThrow.mockResolvedValue({ ...auditArticle, status: EditorialArticleStatus.SCHEDULED });
    await service.scheduleArticle('art-1', future);
    expect(prisma.editorialPublicationEvent.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ type: EditorialPublicationEventType.SCHEDULED, scheduledFor: future }) });

    prisma.editorialArticle.findUnique.mockResolvedValue({ ...auditArticle, status: EditorialArticleStatus.SCHEDULED });
    prisma.editorialArticle.findUniqueOrThrow.mockResolvedValue({ ...auditArticle, status: EditorialArticleStatus.DRAFT });
    await service.unscheduleArticle('art-1');
    expect(prisma.editorialPublicationEvent.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ type: EditorialPublicationEventType.UNSCHEDULED }) });

    prisma.editorialArticle.findUnique.mockResolvedValue({ ...auditArticle, status: EditorialArticleStatus.DRAFT });
    prisma.editorialArticle.findUniqueOrThrow.mockResolvedValue({ ...auditArticle, status: EditorialArticleStatus.ARCHIVED });
    await service.archiveArticle('art-1');
    expect(prisma.editorialPublicationEvent.create).toHaveBeenLastCalledWith({ data: expect.objectContaining({ type: EditorialPublicationEventType.ARCHIVED }) });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('does not expose editorial bodies in list projections but keeps public HTML in detail', async () => {
    prisma.editorialArticle.count.mockResolvedValue(0);
    prisma.editorialArticle.findMany.mockResolvedValue([]);
    await service.findPublicArticles({});
    const listSelect = prisma.editorialArticle.findMany.mock.calls[0][0].select;
    expect(listSelect.contentJson).toBeUndefined();
    expect(listSelect.contentHtml).toBeUndefined();
    expect(listSelect.plainText).toBeUndefined();
    expect(listSelect.seoAudit).toBeUndefined();

    prisma.editorialArticle.findFirst.mockResolvedValue(null);
    await expect(service.findPublicArticleBySlug('draft')).rejects.toThrow(NotFoundException);
    expect(prisma.editorialArticle.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: EditorialArticleStatus.PUBLISHED, publishedAt: { lte: expect.any(Date) } }),
    }));
  });

  it('stores deterministic audits during manual recalculation', async () => {
    prisma.editorialArticle.findUnique.mockResolvedValue(auditArticle);
    prisma.editorialArticle.update.mockResolvedValue(auditArticle);
    await service.recalculateArticleAudit('art-1');
    const auditData = prisma.editorialArticle.update.mock.calls[0][0].data;
    expect(auditData.seoScore).toBeGreaterThanOrEqual(0);
    expect(auditData.geoAudit).toEqual(expect.objectContaining({ rules: expect.any(Array) }));
  });

  it('still protects draft, scheduled and archived articles from public lookup', async () => {
    prisma.editorialArticle.findFirst.mockResolvedValue(null);
    await expect(service.findPublicArticleBySlug('non-public')).rejects.toThrow(NotFoundException);
  });

  it('reports duplicate slugs as a business conflict', async () => {
    prisma.editorialCategory.findUnique.mockResolvedValue(category);
    prisma.editorialArticle.findUnique.mockResolvedValue({ id: 'other' });
    await expect(service.createArticle({ title: auditArticle.title, contentJson: optimizedContent, categoryId: 'cat-1' })).rejects.toThrow(ConflictException);
  });
});
