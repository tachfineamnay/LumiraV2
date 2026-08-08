import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ExpertAuthGuard, RolesGuard } from '../expert/guards';
import { Roles, CurrentExpert } from '../expert/decorators';
import { Expert } from '@prisma/client';
import { EditorialService } from './editorial.service';
import { EditorialLinkingService } from './editorial-linking.service';
import {
  CreateEditorialArticleDto,
  UpdateEditorialArticleDto,
  ScheduleArticleDto,
  EditorialQueryDto,
  CreateEditorialCategoryDto,
  UpdateEditorialCategoryDto,
  CreateEditorialTagDto,
  UpdateEditorialTagDto,
} from './dto';

@Controller('expert/editorial')
@UseGuards(ExpertAuthGuard, RolesGuard)
@Roles('ADMIN')
export class EditorialAdminController {
  constructor(
    private readonly editorialService: EditorialService,
    private readonly editorialLinkingService: EditorialLinkingService,
  ) {}

  // ---------------------------------------------------------------------------
  // Articles
  // ---------------------------------------------------------------------------

  @Get('articles')
  findAllArticles(@Query() query: EditorialQueryDto) {
    return this.editorialService.findAllArticles(query);
  }

  @Get('articles/:id')
  findArticleById(@Param('id') id: string) {
    return this.editorialService.findArticleById(id);
  }

  @Post('articles')
  createArticle(@Body() dto: CreateEditorialArticleDto, @CurrentExpert() expert: Expert) {
    return this.editorialService.createArticle(dto, expert.id);
  }

  @Patch('articles/:id')
  updateArticle(@Param('id') id: string, @Body() dto: UpdateEditorialArticleDto) {
    return this.editorialService.updateArticle(id, dto);
  }

  @Post('articles/:id/publish')
  @HttpCode(HttpStatus.OK)
  publishArticle(@Param('id') id: string) {
    return this.editorialService.publishArticle(id);
  }

  @Post('articles/:id/schedule')
  @HttpCode(HttpStatus.OK)
  scheduleArticle(@Param('id') id: string, @Body() dto: ScheduleArticleDto) {
    return this.editorialService.scheduleArticle(id, dto.scheduledAt);
  }

  @Post('articles/:id/unschedule')
  @HttpCode(HttpStatus.OK)
  unscheduleArticle(@Param('id') id: string) {
    return this.editorialService.unscheduleArticle(id);
  }

  @Post('articles/:id/archive')
  @HttpCode(HttpStatus.OK)
  archiveArticle(@Param('id') id: string) {
    return this.editorialService.archiveArticle(id);
  }

  @Post('articles/:id/audit')
  @HttpCode(HttpStatus.OK)
  recalculateArticleAudit(@Param('id') id: string) {
    return this.editorialService.recalculateArticleAudit(id);
  }

  // ---------------------------------------------------------------------------
  // Deterministic internal-link graph. Suggestions are explicit records only;
  // accepting one never mutates an article's canonical Tiptap document.
  // ---------------------------------------------------------------------------

  @Get('graph/orphans')
  findOrphans() {
    return this.editorialLinkingService.listOrphans();
  }

  @Get('graph/cluster-health')
  clusterHealth() {
    return this.editorialLinkingService.getClusterHealth();
  }

  @Get('graph/articles/:id')
  articleGraph(@Param('id') id: string) {
    return this.editorialLinkingService.getArticleGraph(id);
  }

  @Get('graph/articles/:id/suggestions')
  articleSuggestions(@Param('id') id: string) {
    return this.editorialLinkingService.listSuggestions(id);
  }

  @Post('graph/articles/:id/suggestions')
  @HttpCode(HttpStatus.OK)
  generateSuggestions(@Param('id') id: string) {
    return this.editorialLinkingService.generateSuggestions(id);
  }

  @Post('graph/links/:id/accept')
  @HttpCode(HttpStatus.OK)
  acceptSuggestion(@Param('id') id: string) {
    return this.editorialLinkingService.acceptSuggestion(id);
  }

  @Post('graph/links/:id/ignore')
  @HttpCode(HttpStatus.OK)
  ignoreSuggestion(@Param('id') id: string) {
    return this.editorialLinkingService.ignoreSuggestion(id);
  }

  @Post('graph/links/:id/remove')
  @HttpCode(HttpStatus.OK)
  removeLink(@Param('id') id: string) {
    return this.editorialLinkingService.removeLink(id);
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  @Get('categories')
  findAllCategories() {
    return this.editorialService.findAllCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateEditorialCategoryDto) {
    return this.editorialService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateEditorialCategoryDto) {
    return this.editorialService.updateCategory(id, dto);
  }

  // ---------------------------------------------------------------------------
  // Tags & Aliases
  // ---------------------------------------------------------------------------

  @Get('tags/resolve')
  resolveTagAlias(@Query('alias') alias: string) {
    if (!alias) {
      throw new BadRequestException("Le paramètre d'URL 'alias' est requis.");
    }
    return this.editorialService.resolveTagAlias(alias);
  }

  @Get('tags')
  findAllTags() {
    return this.editorialService.findAllTags();
  }

  @Post('tags')
  createTag(@Body() dto: CreateEditorialTagDto) {
    return this.editorialService.createTag(dto);
  }

  @Patch('tags/:id')
  updateTag(@Param('id') id: string, @Body() dto: UpdateEditorialTagDto) {
    return this.editorialService.updateTag(id, dto);
  }
}
