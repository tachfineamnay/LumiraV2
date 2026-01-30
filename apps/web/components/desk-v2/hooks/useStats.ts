'use client';

import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/api';
import type { DeskStats } from '../types';

interface UseStatsOptions {
  autoFetch?: boolean;
  pollInterval?: number | null;
}

const defaultStats: DeskStats = {
  pendingCount: 0,
  processingCount: 0,
  validationCount: 0,
  completedCount: 0,
  completedToday: 0,
  revenueToday: 0,
};

export function useStats(options: UseStatsOptions = {}) {
  const { autoFetch = true, pollInterval = null } = options;

  const [stats, setStats] = useState<DeskStats>(defaultStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/expert/stats');
      setStats({
        pendingCount: data.pendingOrders || 0,
        processingCount: data.processingOrders || 0,
        validationCount: data.validationOrders || 0,
        completedCount: data.completedOrders || 0,
        completedToday: data.ordersToday || 0,
        revenueToday: data.revenueToday || 0,
      });
      setError(null);
    } catch (err) {
      console.error('[useStats] Fetch error:', err);
      setError('Erreur de chargement des statistiques');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateStats = useCallback((newStats: Partial<DeskStats>) => {
    setStats(prev => ({ ...prev, ...newStats }));
  }, []);

  // Auto fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchStats();
    }
  }, [autoFetch, fetchStats]);

  // Polling
  useEffect(() => {
    if (pollInterval && pollInterval > 0) {
      const interval = setInterval(fetchStats, pollInterval);
      return () => clearInterval(interval);
    }
  }, [pollInterval, fetchStats]);

  return {
    stats,
    isLoading,
    error,
    fetchStats,
    updateStats,
  };
}
