import { Controller, Get, Param, Query } from '@nestjs/common';
import { EditorialService } from './editorial.service';
import { PublicBlogQueryDto } from './dto';

@Controller('blog')
export class EditorialPublicController {
  constructor(private readonly editorialService: EditorialService) {}

  @Get()
  findPublicArticles(@Query() query: PublicBlogQueryDto) {
    return this.editorialService.findPublicArticles(query);
  }

  @Get('categories')
  findPublicCategories() {
    return this.editorialService.findPublicCategories();
  }

  @Get('categories/:slug')
  findPublicCategoryBySlug(@Param('slug') slug: string, @Query() query: PublicBlogQueryDto) {
    return this.editorialService.findPublicCategoryBySlug(slug, query);
  }

  @Get(':slug')
  findPublicArticleBySlug(@Param('slug') slug: string) {
    return this.editorialService.findPublicArticleBySlug(slug);
  }
}
