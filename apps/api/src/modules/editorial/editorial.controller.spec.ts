import { Test, TestingModule } from '@nestjs/testing';
import { EditorialAdminController } from './editorial-admin.controller';
import { EditorialPublicController } from './editorial-public.controller';
import { EditorialService } from './editorial.service';
import { EditorialLinkingService } from './editorial-linking.service';
import { ExpertAuthGuard, RolesGuard } from '../expert/guards';
import { Reflector } from '@nestjs/core';
import { EditorialArticleStatus } from '@prisma/client';

describe('EditorialControllers (Admin & Public Routing)', () => {
  let adminController: EditorialAdminController;
  let publicController: EditorialPublicController;
  let service: jest.Mocked<EditorialService>;
  let linkingService: jest.Mocked<EditorialLinkingService>;

  const mockAdminUser = {
    id: 'expert-admin-1',
    email: 'admin@oraclelumira.com',
    name: 'Grégory Tordjman',
    role: 'ADMIN',
    isActive: true,
  };

  const mockArticle = {
    id: 'art-1',
    title: 'Titre Test',
    slug: 'titre-test',
    status: EditorialArticleStatus.PUBLISHED,
    publishedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      findAllArticles: jest.fn(),
      findArticleById: jest.fn(),
      createArticle: jest.fn(),
      updateArticle: jest.fn(),
      publishArticle: jest.fn(),
      scheduleArticle: jest.fn(),
      unscheduleArticle: jest.fn(),
      archiveArticle: jest.fn(),
      recalculateArticleAudit: jest.fn(),
      findAllCategories: jest.fn(),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      findAllTags: jest.fn(),
      createTag: jest.fn(),
      updateTag: jest.fn(),
      resolveTagAlias: jest.fn(),
      findPublicArticles: jest.fn(),
      findPublicArticleBySlug: jest.fn(),
      findPublicCategories: jest.fn(),
      findPublicCategoryBySlug: jest.fn(),
    };
    const mockLinkingService = {
      getArticleGraph: jest.fn(),
      listSuggestions: jest.fn(),
      generateSuggestions: jest.fn(),
      acceptSuggestion: jest.fn(),
      ignoreSuggestion: jest.fn(),
      removeLink: jest.fn(),
      listOrphans: jest.fn(),
      getClusterHealth: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EditorialAdminController, EditorialPublicController],
      providers: [
        { provide: EditorialService, useValue: mockService },
        { provide: EditorialLinkingService, useValue: mockLinkingService },
        Reflector,
      ],
    })
      .overrideGuard(ExpertAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    adminController = module.get<EditorialAdminController>(EditorialAdminController);
    publicController = module.get<EditorialPublicController>(EditorialPublicController);
    service = module.get(EditorialService);
    linkingService = module.get(EditorialLinkingService);
  });

  describe('EditorialAdminController', () => {
    it('should be defined with ADMIN guards metadata', () => {
      expect(adminController).toBeDefined();
      const roles = Reflect.getMetadata('roles', EditorialAdminController);
      expect(roles).toEqual(['ADMIN']);
    });

    it('delegates findAllArticles to service', async () => {
      service.findAllArticles.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
      await adminController.findAllArticles({ page: 1 });
      expect(service.findAllArticles).toHaveBeenCalledWith({ page: 1 });
    });

    it('delegates createArticle to service passing current expert id', async () => {
      service.createArticle.mockResolvedValue(mockArticle as any);
      await adminController.createArticle(
        {
          title: 'Test',
          contentJson: {},
          categoryId: 'cat-1',
        },
        mockAdminUser as any,
      );

      expect(service.createArticle).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Test' }),
        'expert-admin-1',
      );
    });

    it('delegates publishArticle to service', async () => {
      service.publishArticle.mockResolvedValue(mockArticle as any);
      await adminController.publishArticle('art-1');
      expect(service.publishArticle).toHaveBeenCalledWith('art-1');
    });

    it('delegates scheduleArticle to service', async () => {
      const scheduledAt = new Date(Date.now() + 86400000);
      service.scheduleArticle.mockResolvedValue(mockArticle as any);
      await adminController.scheduleArticle('art-1', { scheduledAt });
      expect(service.scheduleArticle).toHaveBeenCalledWith('art-1', scheduledAt);
    });

    it('delegates unscheduleArticle to service', async () => {
      service.unscheduleArticle.mockResolvedValue(mockArticle as any);
      await adminController.unscheduleArticle('art-1');
      expect(service.unscheduleArticle).toHaveBeenCalledWith('art-1');
    });

    it('delegates archiveArticle to service', async () => {
      service.archiveArticle.mockResolvedValue(mockArticle as any);
      await adminController.archiveArticle('art-1');
      expect(service.archiveArticle).toHaveBeenCalledWith('art-1');
    });

    it('delegates a manual audit to the service', async () => {
      service.recalculateArticleAudit.mockResolvedValue(mockArticle as any);
      await adminController.recalculateArticleAudit('art-1');
      expect(service.recalculateArticleAudit).toHaveBeenCalledWith('art-1');
    });

    it('delegates graph actions to the deterministic linking service', async () => {
      linkingService.generateSuggestions.mockResolvedValue({
        suggestions: [],
        ruleVersion: '2026.08.v1',
      } as any);
      linkingService.acceptSuggestion.mockResolvedValue({ id: 'link-1' } as any);
      await adminController.generateSuggestions('art-1');
      await adminController.acceptSuggestion('link-1');
      expect(linkingService.generateSuggestions).toHaveBeenCalledWith('art-1');
      expect(linkingService.acceptSuggestion).toHaveBeenCalledWith('link-1');
    });

    it('delegates resolveTagAlias to service', async () => {
      service.resolveTagAlias.mockResolvedValue({
        matchedBy: 'ALIAS',
        searchedAlias: 'peur abandon',
        tag: {} as any,
      });
      await adminController.resolveTagAlias('peur abandon');
      expect(service.resolveTagAlias).toHaveBeenCalledWith('peur abandon');
    });
  });

  describe('EditorialPublicController', () => {
    it('delegates findPublicArticles to service', async () => {
      service.findPublicArticles.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
      await publicController.findPublicArticles({ page: 1 });
      expect(service.findPublicArticles).toHaveBeenCalledWith({ page: 1 });
    });

    it('delegates findPublicArticleBySlug to service', async () => {
      service.findPublicArticleBySlug.mockResolvedValue(mockArticle as any);
      await publicController.findPublicArticleBySlug('titre-test');
      expect(service.findPublicArticleBySlug).toHaveBeenCalledWith('titre-test');
    });

    it('delegates findPublicCategories to service', async () => {
      service.findPublicCategories.mockResolvedValue([]);
      await publicController.findPublicCategories();
      expect(service.findPublicCategories).toHaveBeenCalled();
    });

    it('delegates findPublicCategoryBySlug to service', async () => {
      service.findPublicCategoryBySlug.mockResolvedValue({
        category: {} as any,
        articles: { data: [], total: 0, page: 1, limit: 10, totalPages: 0 },
      });
      await publicController.findPublicCategoryBySlug('relations-amour', { page: 1 });
      expect(service.findPublicCategoryBySlug).toHaveBeenCalledWith('relations-amour', { page: 1 });
    });
  });
});
