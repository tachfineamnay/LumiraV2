export interface SearchPerformanceOptions {
  startDate?: Date;
  endDate?: Date;
}

export interface ArticlePerformanceMetrics {
  articleId: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  data: Record<string, unknown>;
}

export interface SearchPerformanceProvider {
  fetchArticleMetrics(
    articleId: string,
    options?: SearchPerformanceOptions,
  ): Promise<ArticlePerformanceMetrics>;
}
