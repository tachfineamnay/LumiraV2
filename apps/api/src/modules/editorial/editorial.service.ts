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

@Injectable()
export class EditorialService {
  constructor(private prisma: PrismaService) {}

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

    // Verify category existence
    const category = await this.prisma.editorialCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Catégorie introuvable (${dto.categoryId})`);
    }

    // Verify slug uniqueness
    const existing = await this.prisma.editorialArticle.findUnique({
      where: { slug: normalizedSlug },
    });
    if (existing) {
      throw new ConflictException(`Un article avec le slug '${normalizedSlug}' existe déjà.`);
    }

    return this.prisma.editorialArticle.create({
      data: {
        title: dto.title,
        slug: normalizedSlug,
        excerpt: dto.excerpt,
        contentJson: dto.contentJson,
        contentHtml: dto.contentHtml,
        plainText: dto.plainText,
        categoryId: dto.categoryId,
        coverAssetId: dto.coverAssetId,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        focusKeyword: dto.focusKeyword,
        canonical: dto.canonical,
        featured: dto.featured ?? false,
        authorId: authorId || null,
        status: EditorialArticleStatus.DRAFT,
        tags: dto.tagIds?.length
          ? {
              create: dto.tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
      include: {
        category: true,
        tags: { include: { tag: true } },
        coverAsset: true,
      },
    });
  }

  async updateArticle(id: string, dto: UpdateEditorialArticleDto) {
    const article = await this.prisma.editorialArticle.findUnique({
      where: { id },
      include: { tags: true },
    });

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

    if (dto.categoryId && dto.categoryId !== article.categoryId) {
      const category = await this.prisma.editorialCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException(`Catégorie introuvable (${dto.categoryId})`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
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

      return tx.editorialArticle.update({
        where: { id },
        data: {
          title: dto.title,
          slug: normalizedSlug,
          excerpt: dto.excerpt,
          contentJson: dto.contentJson,
          contentHtml: dto.contentHtml,
          plainText: dto.plainText,
          categoryId: dto.categoryId,
          coverAssetId: dto.coverAssetId,
          seoTitle: dto.seoTitle,
          seoDescription: dto.seoDescription,
          focusKeyword: dto.focusKeyword,
          canonical: dto.canonical,
          featured: dto.featured,
          status: dto.status,
        },
        include: {
          category: true,
          tags: { include: { tag: true } },
          coverAsset: true,
        },
      });
    });
  }

  async publishArticle(id: string) {
    const article = await this.prisma.editorialArticle.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article introuvable (${id})`);
    }

    const now = new Date();
    const updated = await this.prisma.editorialArticle.update({
      where: { id },
      data: {
        status: EditorialArticleStatus.PUBLISHED,
        publishedAt: article.publishedAt || now,
        scheduledAt: null,
      },
    });

    await this.prisma.editorialPublicationEvent.create({
      data: {
        articleId: id,
        type: EditorialPublicationEventType.PUBLISHED,
        executedAt: now,
      },
    });

    return updated;
  }

  async scheduleArticle(id: string, scheduledAt: Date) {
    const article = await this.prisma.editorialArticle.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article introuvable (${id})`);
    }

    const targetDate = new Date(scheduledAt);
    if (isNaN(targetDate.getTime()) || targetDate <= new Date()) {
      throw new BadRequestException('La date de programmation doit être dans le futur.');
    }

    const updated = await this.prisma.editorialArticle.update({
      where: { id },
      data: {
        status: EditorialArticleStatus.SCHEDULED,
        scheduledAt: targetDate,
      },
    });

    await this.prisma.editorialPublicationEvent.create({
      data: {
        articleId: id,
        type: EditorialPublicationEventType.SCHEDULED,
        scheduledFor: targetDate,
      },
    });

    return updated;
  }

  async unscheduleArticle(id: string) {
    const article = await this.prisma.editorialArticle.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article introuvable (${id})`);
    }

    const updated = await this.prisma.editorialArticle.update({
      where: { id },
      data: {
        status: EditorialArticleStatus.DRAFT,
        scheduledAt: null,
      },
    });

    await this.prisma.editorialPublicationEvent.create({
      data: {
        articleId: id,
        type: EditorialPublicationEventType.UNSCHEDULED,
      },
    });

    return updated;
  }

  async archiveArticle(id: string) {
    const article = await this.prisma.editorialArticle.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article introuvable (${id})`);
    }

    const updated = await this.prisma.editorialArticle.update({
      where: { id },
      data: {
        status: EditorialArticleStatus.ARCHIVED,
      },
    });

    await this.prisma.editorialPublicationEvent.create({
      data: {
        articleId: id,
        type: EditorialPublicationEventType.ARCHIVED,
      },
    });

    return updated;
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
          contentJson: true,
          contentHtml: true,
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
        contentJson: true,
        contentHtml: true,
        plainText: true,
        publishedAt: true,
        featured: true,
        seoTitle: true,
        seoDescription: true,
        focusKeyword: true,
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
