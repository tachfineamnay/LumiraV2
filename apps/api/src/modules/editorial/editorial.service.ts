import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateEditorialArticleDto,
  UpdateEditorialArticleDto,
  EditorialQueryDto,
  CreateEditorialCategoryDto,
  UpdateEditorialCategoryDto,
  CreateEditorialTagDto,
  UpdateEditorialTagDto,
  PublicBlogQueryDto,
} from './dto';
import { slugify } from './editorial-slug.utils';
import { EditorialArticleStatus, EditorialPublicationEventType, Prisma } from '@prisma/client';
import { normalizeEditorialContent } from './editorial-content-normalizer';
import {
  EditorialContentAuditInput,
  EditorialContentAuditService,
} from './editorial-content-audit.service';
import { EDITORIAL_AUDIT_RULE_VERSION } from './editorial-content-audit.config';

const ARTICLE_AUDIT_INCLUDE = {
  category: { select: { id: true, isActive: true } },
  tags: { select: { tag: { select: { id: true, isActive: true } } } },
  coverAsset: { select: { id: true, altText: true } },
  author: { select: { id: true } },
  outboundLinks: {
    where: { status: 'ACTIVE' },
    select: { anchorText: true, targetArticle: { select: { slug: true } } },
  },
} satisfies Prisma.EditorialArticleInclude;

type EditorialArticleForAudit = Prisma.EditorialArticleGetPayload<{
  include: typeof ARTICLE_AUDIT_INCLUDE;
}>;

@Injectable()
export class EditorialService {
  constructor(
    private prisma: PrismaService,
    private readonly contentAudit: EditorialContentAuditService,
  ) {}

  // ===========================================================================
  // ADMIN — Articles
  // ===========================================================================

  async findAllArticles(query: EditorialQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.EditorialArticleWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.search) {
      const searchNormalized = query.search.trim();
      where.OR = [
        { title: { contains: searchNormalized, mode: 'insensitive' } },
        { slug: { contains: searchNormalized, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.editorialArticle.count({ where }),
      this.prisma.editorialArticle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          tags: {
            include: { tag: true },
          },
          coverAsset: true,
          author: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findArticleById(id: string) {
    const article = await this.prisma.editorialArticle.findUnique({
      where: { id },
      include: {
        category: true,
        tags: {
          include: { tag: true },
        },
        coverAsset: true,
        author: {
          select: { id: true, name: true, email: true },
        },
        outboundLinks: {
          include: { targetArticle: { select: { id: true, title: true, slug: true } } },
        },
        inboundLinks: {
          include: { sourceArticle: { select: { id: true, title: true, slug: true } } },
        },
        publicationEvents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!article) {
      throw new NotFoundException(`Article introuvable (${id})`);
    }

    return article;
  }

  async createArticle(dto: CreateEditorialArticleDto, authorId?: string) {
    const rawSlug = dto.slug || dto.title;
    const normalizedSlug = slugify(rawSlug);

    if (!normalizedSlug) {
      throw new BadRequestException('Un slug valide ne peut pas être généré à partir du titre.');
    }

    const content = normalizeEditorialContent(dto.contentJson);
    return this.prisma.$transaction(async (tx) => {
      await this.validateArticleRelations(tx, dto.categoryId, dto.tagIds, dto.coverAssetId);

      const existing = await tx.editorialArticle.findUnique({ where: { slug: normalizedSlug } });
      if (existing) {
        throw new ConflictException(`Un article avec le slug '${normalizedSlug}' existe déjà.`);
      }

      const article = await tx.editorialArticle.create({
        data: {
          title: dto.title,
          slug: normalizedSlug,
          excerpt: dto.excerpt,
          contentJson: dto.contentJson as Prisma.InputJsonValue,
          contentHtml: content.contentHtml,
          plainText: content.plainText,
          categoryId: dto.categoryId,
          coverAssetId: dto.coverAssetId,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          focusKeyword: dto.focusKeyword,
          canonical: dto.canonical,
          featured: dto.featured ?? false,
          authorId: authorId || null,
          status: EditorialArticleStatus.DRAFT,
          searchModifiedAt: null,
          tags: dto.tagIds?.length ? { create: dto.tagIds.map((tagId) => ({ tagId })) } : undefined,
        },
        include: ARTICLE_AUDIT_INCLUDE,
      });

      return this.persistAudit(tx, article);
    });
  }

  async updateArticle(id: string, dto: UpdateEditorialArticleDto) {
    const article = await this.prisma.editorialArticle.findUnique({ where: { id } });

    if (!article) {
      throw new NotFoundException(`Article introuvable (${id})`);
    }

    let normalizedSlug: string | undefined;
    if (dto.slug !== undefined || dto.title !== undefined) {
      const candidateSlug = dto.slug || dto.title || article.title;
      normalizedSlug = slugify(candidateSlug);

      // Slug Immutability Rule for Published Articles
      if (
        (article.status === EditorialArticleStatus.PUBLISHED || article.publishedAt) &&
        normalizedSlug !== article.slug
      ) {
        throw new BadRequestException(
          "Le slug d'un article publié ne peut pas être modifié sans mise en place de redirections.",
        );
      }

      if (normalizedSlug !== article.slug) {
        const existing = await this.prisma.editorialArticle.findUnique({
          where: { slug: normalizedSlug },
        });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Un article avec le slug '${normalizedSlug}' existe déjà.`);
        }
      }
    }

    const content = dto.contentJson === undefined ? undefined : normalizeEditorialContent(dto.contentJson);
    const affectsAudit =
      dto.title !== undefined ||
      dto.slug !== undefined ||
      dto.excerpt !== undefined ||
      dto.contentJson !== undefined ||
      dto.categoryId !== undefined ||
      dto.tagIds !== undefined ||
      dto.coverAssetId !== undefined ||
      dto.seoTitle !== undefined ||
      dto.seoDescription !== undefined ||
      dto.focusKeyword !== undefined ||
      dto.canonical !== undefined;
    const changesPublicContent =
      dto.title !== undefined ||
      dto.excerpt !== undefined ||
      dto.contentJson !== undefined ||
      dto.categoryId !== undefined ||
      dto.tagIds !== undefined ||
      dto.coverAssetId !== undefined ||
      dto.seoTitle !== undefined ||
      dto.seoDescription !== undefined ||
      dto.canonical !== undefined;

    return this.prisma.$transaction(async (tx) => {
      if (dto.categoryId !== undefined) {
        await this.validateArticleRelations(tx, dto.categoryId, undefined, undefined);
      }
      if (dto.tagIds !== undefined) {
        await this.validateTags(tx, dto.tagIds);
      }
      if (dto.coverAssetId !== undefined) {
        await this.validateCoverAsset(tx, dto.coverAssetId);
      }

      if (dto.tagIds !== undefined) {
        await tx.editorialArticleTag.deleteMany({
          where: { articleId: id },
        });
        if (dto.tagIds.length > 0) {
          await tx.editorialArticleTag.createMany({
            data: dto.tagIds.map((tagId) => ({ articleId: id, tagId })),
          });
        }
      }

      const updated = await tx.editorialArticle.update({
        where: { id },
        data: {
          title: dto.title,
          slug: normalizedSlug,
          excerpt: dto.excerpt,
          contentJson: dto.contentJson === undefined ? undefined : (dto.contentJson as Prisma.InputJsonValue),
          contentHtml: content?.contentHtml,
          plainText: content?.plainText,
          categoryId: dto.categoryId,
          coverAssetId: dto.coverAssetId,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          focusKeyword: dto.focusKeyword,
          canonical: dto.canonical,
          featured: dto.featured,
          searchModifiedAt:
            article.status === EditorialArticleStatus.PUBLISHED && changesPublicContent
              ? new Date()
              : undefined,
        },
        include: ARTICLE_AUDIT_INCLUDE,
      });

      return affectsAudit ? this.persistAudit(tx, updated) : updated;
    });
  }

  async publishArticle(id: string) {
    const now = new Date();
    return this.transitionArticle({
      id,
      target: EditorialArticleStatus.PUBLISHED,
      allowedFrom: [EditorialArticleStatus.DRAFT, EditorialArticleStatus.SCHEDULED],
      data: { publishedAt: now, scheduledAt: null },
      event: { type: EditorialPublicationEventType.PUBLISHED, executedAt: now },
    });
  }

  async scheduleArticle(id: string, scheduledAt: Date) {
    const targetDate = new Date(scheduledAt);
    if (isNaN(targetDate.getTime()) || targetDate <= new Date()) {
      throw new BadRequestException('La date de programmation doit être dans le futur.');
    }

    return this.transitionArticle({
      id,
      target: EditorialArticleStatus.SCHEDULED,
      allowedFrom: [EditorialArticleStatus.DRAFT],
      data: { scheduledAt: targetDate },
      event: { type: EditorialPublicationEventType.SCHEDULED, scheduledFor: targetDate },
    });
  }

  async unscheduleArticle(id: string) {
    const now = new Date();
    return this.transitionArticle({
      id,
      target: EditorialArticleStatus.DRAFT,
      allowedFrom: [EditorialArticleStatus.SCHEDULED],
      data: { scheduledAt: null },
      event: { type: EditorialPublicationEventType.UNSCHEDULED, executedAt: now },
    });
  }

  async archiveArticle(id: string) {
    const now = new Date();
    return this.transitionArticle({
      id,
      target: EditorialArticleStatus.ARCHIVED,
      allowedFrom: [
        EditorialArticleStatus.DRAFT,
        EditorialArticleStatus.SCHEDULED,
        EditorialArticleStatus.PUBLISHED,
      ],
      data: { scheduledAt: null },
      event: { type: EditorialPublicationEventType.ARCHIVED, executedAt: now },
    });
  }

  async recalculateArticleAudit(id: string) {
    const article = await this.prisma.editorialArticle.findUnique({
      where: { id },
      include: ARTICLE_AUDIT_INCLUDE,
    });
    if (!article) throw new NotFoundException(`Article introuvable (${id})`);
    return this.persistAudit(this.prisma, article, true);
  }

  private async validateArticleRelations(
    tx: Prisma.TransactionClient,
    categoryId: string,
    tagIds?: string[],
    coverAssetId?: string,
  ) {
    const category = await tx.editorialCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException(`Catégorie introuvable (${categoryId})`);
    if (!category.isActive) throw new BadRequestException(`La catégorie (${categoryId}) est inactive.`);
    if (tagIds !== undefined) await this.validateTags(tx, tagIds);
    if (coverAssetId !== undefined) await this.validateCoverAsset(tx, coverAssetId);
  }

  private async validateTags(tx: Prisma.TransactionClient, tagIds: string[]) {
    const uniqueTagIds = [...new Set(tagIds)];
    if (uniqueTagIds.length !== tagIds.length) {
      throw new BadRequestException('Un tag ne peut être associé qu’une seule fois à un article.');
    }
    if (!uniqueTagIds.length) return;
    const tags = await tx.editorialTag.findMany({ where: { id: { in: uniqueTagIds } } });
    if (tags.length !== uniqueTagIds.length) {
      throw new NotFoundException('Au moins un tag est introuvable.');
    }
    if (tags.some((tag) => !tag.isActive)) {
      throw new BadRequestException('Les tags associés à un article doivent être actifs.');
    }
  }

  private async validateCoverAsset(tx: Prisma.TransactionClient, coverAssetId: string) {
    const asset = await tx.editorialAsset.findUnique({ where: { id: coverAssetId } });
    if (!asset) throw new NotFoundException(`Asset de couverture introuvable (${coverAssetId})`);
  }

  private async transitionArticle(options: {
    id: string;
    target: EditorialArticleStatus;
    allowedFrom: EditorialArticleStatus[];
    data: Prisma.EditorialArticleUpdateManyMutationInput;
    event: Prisma.EditorialPublicationEventCreateWithoutArticleInput;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.editorialArticle.findUnique({ where: { id: options.id } });
      if (!current) throw new NotFoundException(`Article introuvable (${options.id})`);
      if (current.status === options.target) return current;
      if (!options.allowedFrom.includes(current.status)) {
        throw new BadRequestException(`Transition ${current.status} → ${options.target} non autorisée.`);
      }

      const update = await tx.editorialArticle.updateMany({
        where: { id: options.id, status: { in: options.allowedFrom } },
        data: {
          ...options.data,
          status: options.target,
          searchModifiedAt:
            options.target === EditorialArticleStatus.PUBLISHED ? new Date() : undefined,
        },
      });
      if (update.count !== 1) {
        throw new ConflictException('La transition éditoriale a été modifiée par une autre opération.');
      }
      await tx.editorialPublicationEvent.create({ data: { articleId: options.id, ...options.event } });
      const transitioned = await tx.editorialArticle.findUniqueOrThrow({
        where: { id: options.id },
        include: ARTICLE_AUDIT_INCLUDE,
      });
      return this.persistAudit(tx, transitioned);
    });
  }

  private async persistAudit(
    tx: Prisma.TransactionClient | PrismaService,
    article: EditorialArticleForAudit,
    force = false,
  ) {
    const input: EditorialContentAuditInput = {
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      contentJson: article.contentJson,
      status: article.status,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      focusKeyword: article.focusKeyword,
      canonical: article.canonical,
      category: article.category,
      tags: article.tags.map(({ tag }) => tag),
      coverAsset: article.coverAsset,
      author: article.author,
      publishedAt: article.publishedAt,
      searchModifiedAt: article.searchModifiedAt,
      outboundLinks: article.outboundLinks,
    };
    const audit = this.contentAudit.auditAll(input);
    if (
      !force &&
      article.auditRuleVersion === EDITORIAL_AUDIT_RULE_VERSION &&
      article.auditInputHash === audit.seo.inputHash
    ) {
      return article;
    }
    return tx.editorialArticle.update({
      where: { id: article.id },
      data: {
        seoScore: audit.seo.score,
        aeoScore: audit.aeo.score,
        geoScore: audit.geo.score,
        seoAudit: audit.seo as Prisma.InputJsonValue,
        aeoAudit: audit.aeo as Prisma.InputJsonValue,
        geoAudit: audit.geo as Prisma.InputJsonValue,
        auditRuleVersion: EDITORIAL_AUDIT_RULE_VERSION,
        auditInputHash: audit.seo.inputHash,
      },
      include: ARTICLE_AUDIT_INCLUDE,
    });
  }

  // ===========================================================================
  // ADMIN — Categories
  // ===========================================================================

  async findAllCategories() {
    return this.prisma.editorialCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { articles: true },
        },
      },
    });
  }

  async createCategory(dto: CreateEditorialCategoryDto) {
    const normalizedSlug = slugify(dto.slug || dto.name);
    if (!normalizedSlug) {
      throw new BadRequestException('Un slug valide ne peut pas être généré.');
    }

    const existing = await this.prisma.editorialCategory.findUnique({
      where: { slug: normalizedSlug },
    });
    if (existing) {
      throw new ConflictException(`Une catégorie avec le slug '${normalizedSlug}' existe déjà.`);
    }

    return this.prisma.editorialCategory.create({
      data: {
        name: dto.name,
        slug: normalizedSlug,
        description: dto.description,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateEditorialCategoryDto) {
    const category = await this.prisma.editorialCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Catégorie introuvable (${id})`);
    }

    let normalizedSlug: string | undefined;
    if (dto.slug !== undefined || dto.name !== undefined) {
      normalizedSlug = slugify(dto.slug || dto.name || category.name);
      if (normalizedSlug !== category.slug) {
        const existing = await this.prisma.editorialCategory.findUnique({
          where: { slug: normalizedSlug },
        });
        if (existing && existing.id !== id) {
          throw new ConflictException(
            `Une catégorie avec le slug '${normalizedSlug}' existe déjà.`,
          );
        }
      }
    }

    return this.prisma.editorialCategory.update({
      where: { id },
      data: {
        name: dto.name,
        slug: normalizedSlug,
        description: dto.description,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  // ===========================================================================
  // ADMIN — Tags & Aliases
  // ===========================================================================

  async findAllTags() {
    return this.prisma.editorialTag.findMany({
      orderBy: { name: 'asc' },
      include: {
        aliases: true,
        _count: {
          select: { articles: true },
        },
      },
    });
  }

  async createTag(dto: CreateEditorialTagDto) {
    const normalizedSlug = slugify(dto.slug || dto.name);
    if (!normalizedSlug) {
      throw new BadRequestException('Un slug valide ne peut pas être généré.');
    }

    const existing = await this.prisma.editorialTag.findUnique({
      where: { slug: normalizedSlug },
    });
    if (existing) {
      throw new ConflictException(`Un tag avec le slug '${normalizedSlug}' existe déjà.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const tag = await tx.editorialTag.create({
        data: {
          name: dto.name,
          slug: normalizedSlug,
          family: dto.family,
          isActive: dto.isActive ?? true,
        },
      });

      if (dto.aliases?.length) {
        const aliasesData = dto.aliases
          .map((a) => a.trim().toLowerCase())
          .filter(Boolean)
          .map((alias) => ({ alias, tagId: tag.id }));

        if (aliasesData.length > 0) {
          await tx.editorialTagAlias.createMany({
            data: aliasesData,
            skipDuplicates: true,
          });
        }
      }

      return tx.editorialTag.findUnique({
        where: { id: tag.id },
        include: { aliases: true },
      });
    });
  }

  async updateTag(id: string, dto: UpdateEditorialTagDto) {
    const tag = await this.prisma.editorialTag.findUnique({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`Tag introuvable (${id})`);
    }

    let normalizedSlug: string | undefined;
    if (dto.slug !== undefined || dto.name !== undefined) {
      normalizedSlug = slugify(dto.slug || dto.name || tag.name);
      if (normalizedSlug !== tag.slug) {
        const existing = await this.prisma.editorialTag.findUnique({
          where: { slug: normalizedSlug },
        });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Un tag avec le slug '${normalizedSlug}' existe déjà.`);
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.editorialTag.update({
        where: { id },
        data: {
          name: dto.name,
          slug: normalizedSlug,
          family: dto.family,
          isActive: dto.isActive,
        },
      });

      if (dto.aliases !== undefined) {
        await tx.editorialTagAlias.deleteMany({ where: { tagId: id } });
        const aliasesData = dto.aliases
          .map((a) => a.trim().toLowerCase())
          .filter(Boolean)
          .map((alias) => ({ alias, tagId: id }));

        if (aliasesData.length > 0) {
          await tx.editorialTagAlias.createMany({
            data: aliasesData,
            skipDuplicates: true,
          });
        }
      }

      return tx.editorialTag.findUnique({
        where: { id },
        include: { aliases: true },
      });
    });
  }

  async resolveTagAlias(alias: string) {
    const cleanAlias = alias.trim().toLowerCase();
    if (!cleanAlias) {
      throw new BadRequestException("Un terme d'alias valide est requis.");
    }

    // 1. Check direct alias
    const tagAlias = await this.prisma.editorialTagAlias.findUnique({
      where: { alias: cleanAlias },
      include: {
        tag: {
          include: { aliases: true },
        },
      },
    });

    if (tagAlias) {
      return {
        matchedBy: 'ALIAS',
        searchedAlias: cleanAlias,
        tag: tagAlias.tag,
      };
    }

    // 2. Fallback check by tag slug or name
    const tagSlug = slugify(cleanAlias);
    const directTag = await this.prisma.editorialTag.findFirst({
      where: {
        OR: [{ slug: tagSlug }, { name: { equals: cleanAlias, mode: 'insensitive' } }],
      },
      include: { aliases: true },
    });

    if (directTag) {
      return {
        matchedBy: 'DIRECT_TAG',
        searchedAlias: cleanAlias,
        tag: directTag,
      };
    }

    throw new NotFoundException(`Aucun tag ou synonyme trouvé pour '${cleanAlias}'`);
  }

  // ===========================================================================
  // PUBLIC — Blog (Published articles ONLY: status=PUBLISHED AND publishedAt <= now)
  // ===========================================================================

  async findPublicArticles(query: PublicBlogQueryDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.EditorialArticleWhereInput = {
      status: EditorialArticleStatus.PUBLISHED,
      publishedAt: { lte: now },
    };

    if (query.categorySlug) {
      where.category = {
        slug: query.categorySlug,
        isActive: true,
      };
    }

    if (query.tagSlug) {
      where.tags = {
        some: {
          tag: {
            slug: query.tagSlug,
            isActive: true,
          },
        },
      };
    }

    const [total, data] = await Promise.all([
      this.prisma.editorialArticle.count({ where }),
      this.prisma.editorialArticle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          featured: true,
          seoTitle: true,
          seoDescription: true,
          canonical: true,
          category: {
            select: { id: true, name: true, slug: true },
          },
          tags: {
            select: {
              tag: {
                select: { id: true, name: true, slug: true, family: true },
              },
            },
          },
          coverAsset: {
            select: { id: true, publicUrl: true, altText: true, width: true, height: true },
          },
        },
      }),
    ]);

    return {
      data: data.map((art) => ({
        ...art,
        tags: art.tags.map((t) => t.tag),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findPublicArticleBySlug(slug: string) {
    const now = new Date();
    const article = await this.prisma.editorialArticle.findFirst({
      where: {
        slug,
        status: EditorialArticleStatus.PUBLISHED,
        publishedAt: { lte: now },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        contentHtml: true,
        publishedAt: true,
        featured: true,
        seoTitle: true,
        seoDescription: true,
        canonical: true,
        category: {
          select: { id: true, name: true, slug: true, description: true },
        },
        tags: {
          select: {
            tag: {
              select: { id: true, name: true, slug: true, family: true },
            },
          },
        },
        coverAsset: {
          select: { id: true, publicUrl: true, altText: true, width: true, height: true },
        },
        outboundLinks: {
          where: { status: 'ACTIVE' },
          select: {
            anchorText: true,
            targetArticle: {
              select: { title: true, slug: true },
            },
          },
        },
      },
    });

    if (!article) {
      throw new NotFoundException(`Article public introuvable (${slug})`);
    }

    return {
      ...article,
      tags: article.tags.map((t) => t.tag),
    };
  }

  async findPublicCategories() {
    const now = new Date();
    const categories = await this.prisma.editorialCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        seoTitle: true,
        seoDescription: true,
        _count: {
          select: {
            articles: {
              where: {
                status: EditorialArticleStatus.PUBLISHED,
                publishedAt: { lte: now },
              },
            },
          },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      seoTitle: cat.seoTitle,
      seoDescription: cat.seoDescription,
      publishedArticlesCount: cat._count.articles,
    }));
  }

  async findPublicCategoryBySlug(slug: string, query: PublicBlogQueryDto) {
    const category = await this.prisma.editorialCategory.findFirst({
      where: { slug, isActive: true },
    });

    if (!category) {
      throw new NotFoundException(`Catégorie publique introuvable (${slug})`);
    }

    const articles = await this.findPublicArticles({
      ...query,
      categorySlug: slug,
    });

    return {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
      },
      articles,
    };
  }
}
