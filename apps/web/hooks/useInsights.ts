'use client';

import { useState, useEffect, useCallback } from 'react';
import sanctuaireApi from '../lib/sanctuaireApi';

// Types matching backend response
export interface InsightMetadata {
    label: string;
    description: string;
    icon: string;
    color: string;
}

export interface Insight {
    id: string;
    userId: string;
    orderId: string | null;
    category: InsightCategory;
    short: string;
    full: string;
    viewedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export type InsightCategory =
    | 'SPIRITUEL'
    | 'RELATIONS'
    | 'MISSION'
    | 'CREATIVITE'
    | 'EMOTIONS'
    | 'TRAVAIL'
    | 'SANTE'
    | 'FINANCE';

export interface CategoryWithInsight {
    category: InsightCategory;
    metadata: InsightMetadata;
    insight: Insight | null;
    isNew: boolean;
}

export interface InsightsResponse {
    categories: CategoryWithInsight[];
    metadata: Record<InsightCategory, InsightMetadata>;
}

export interface UseInsightsReturn {
    categories: CategoryWithInsight[];
    metadata: Record<InsightCategory, InsightMetadata> | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    markAsViewed: (category: InsightCategory) => Promise<void>;
}

export function useInsights(): UseInsightsReturn {
    const [categories, setCategories] = useState<CategoryWithInsight[]>([]);
    const [metadata, setMetadata] = useState<Record<InsightCategory, InsightMetadata> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInsights = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await sanctuaireApi.get<InsightsResponse>('/insights');
            setCategories(response.data.categories);
            setMetadata(response.data.metadata);
        } catch (err) {
            console.error('Failed to fetch insights:', err);
            setError('Erreur lors du chargement des insights');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const markAsViewed = useCallback(async (category: InsightCategory) => {
        try {
            await sanctuaireApi.patch(`/insights/${category}/view`);

            // Update local state to remove "new" badge
            setCategories((prev) =>
                prev.map((cat) =>
                    cat.category === category
                        ? { ...cat, isNew: false, insight: cat.insight ? { ...cat.insight, viewedAt: new Date().toISOString() } : null }
                        : cat
                )
            );
        } catch (err) {
            console.error('Failed to mark insight as viewed:', err);
        }
    }, []);

    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    return {
        categories,
        metadata,
        isLoading,
        error,
        refetch: fetchInsights,
        markAsViewed,
    };
}
