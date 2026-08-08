export interface SearchResearchOptions {
  country?: string;
  language?: string;
  limit?: number;
}

export interface SearchResearchResultItem {
  title: string;
  url: string;
  snippet: string;
  rank: number;
}

export interface SearchResearchResult {
  query: string;
  results: SearchResearchResultItem[];
  metadata?: Record<string, unknown>;
}

export interface SearchResearchProvider {
  search(query: string, options?: SearchResearchOptions): Promise<SearchResearchResult>;
}
