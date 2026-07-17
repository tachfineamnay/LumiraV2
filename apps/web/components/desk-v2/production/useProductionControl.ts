'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import expertApi from '@/lib/expertApi';
import type { ProductionJob, ProductionSummary } from './types';

interface UseProductionControlOptions {
  pollIntervalMs?: number;
  includeJobs?: boolean;
}

interface ProductionJobsResponse {
  data: ProductionJob[];
}

const EMPTY_SUMMARY: ProductionSummary = {
  queued: 0,
  running: 0,
  failed: 0,
  awaitingReview: 0,
  audioMissing: 0,
};

export function useProductionControl(options: UseProductionControlOptions = {}) {
  const { pollIntervalMs = 5000, includeJobs = true } = options;
  const [summary, setSummary] = useState<ProductionSummary>(EMPTY_SUMMARY);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestRunning = useRef(false);

  const refresh = useCallback(async () => {
    if (requestRunning.current) return;
    requestRunning.current = true;
    try {
      const summaryRequest = expertApi.get<ProductionSummary>('/expert/production/summary');
      const jobsRequest = includeJobs
        ? expertApi.get<ProductionJobsResponse>('/expert/production/jobs?limit=150')
        : Promise.resolve(null);
      const [summaryResponse, jobsResponse] = await Promise.all([summaryRequest, jobsRequest]);
      if (!mounted.current) return;
      setSummary(summaryResponse.data);
      if (jobsResponse) setJobs(jobsResponse.data.data || []);
      setError(null);
    } catch (requestError) {
      if (!mounted.current) return;
      console.error('[ProductionControl] Refresh failed', requestError);
      setError('Impossible de synchroniser la production');
    } finally {
      if (mounted.current) setIsLoading(false);
      requestRunning.current = false;
    }
  }, [includeJobs]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollIntervalMs);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollIntervalMs, refresh]);

  const retry = useCallback(
    async (jobId: string) => {
      await expertApi.post(`/expert/production/jobs/${jobId}/retry`);
      await refresh();
    },
    [refresh],
  );

  const cancel = useCallback(
    async (jobId: string) => {
      await expertApi.post(`/expert/production/jobs/${jobId}/cancel`);
      await refresh();
    },
    [refresh],
  );

  return { summary, jobs, isLoading, error, refresh, retry, cancel };
}
