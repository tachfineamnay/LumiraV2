'use client';

import { useState, useEffect, useCallback } from 'react';
import expertApi from '@/lib/expertApi';
import { ActivityItem } from '../types';

interface UseActivityOptions {
  limit?: number;
  autoFetch?: boolean;
}

export function useActivity({ limit = 10, autoFetch = true }: UseActivityOptions = {}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await expertApi.get<{ activities: ActivityItem[] }>(`/expert/activity?limit=${limit}`);
      setItems(data.activities);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
      setError('Impossible de charger l\'activité');
      // Fallback to empty array on error
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (autoFetch) {
      fetchActivity();
    }
  }, [autoFetch, fetchActivity]);

  const addItem = (item: ActivityItem) => {
    setItems(prev => [item, ...prev].slice(0, limit));
  };

  return {
    items,
    isLoading,
    error,
    fetchActivity,
    addItem,
  };
}
