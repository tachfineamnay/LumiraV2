import { Injectable } from '@nestjs/common';
import {
  SearchResearchProvider,
  SearchResearchOptions,
  SearchResearchResult,
  SearchPerformanceProvider,
  SearchPerformanceOptions,
  ArticlePerformanceMetrics,
} from './contracts';

@Injectable()
export class BaselineSearchResearchProvider implements SearchResearchProvider {
  async search(query: string, options?: SearchResearchOptions): Promise<SearchResearchResult> {
    return {
      query,
      results: [
        {
          title: `Résultat de recherche baseline pour "${query}"`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          snippet: 'Donnée de recherche brute initiale — aucune valeur inventée.',
          rank: 1,
        },
      ],
      metadata: {
        country: options?.country || 'FR',
        language: options?.language || 'fr',
        limit: options?.limit || 10,
        status: 'UNKNOWN',
      },
    };
  }
}

@Injectable()
export class BaselineSearchPerformanceProvider implements SearchPerformanceProvider {
  async fetchArticleMetrics(
    articleId: string,
    options?: SearchPerformanceOptions,
  ): Promise<ArticlePerformanceMetrics> {
    return {
      articleId,
      clicks: undefined,
      impressions: undefined,
      ctr: undefined,
      position: undefined,
      data: {
        status: 'UNKNOWN',
        startDate: options?.startDate?.toISOString(),
        endDate: options?.endDate?.toISOString(),
        note: 'Performance Search Console sync indisponible en phase fondation.',
      },
    };
  }
}
