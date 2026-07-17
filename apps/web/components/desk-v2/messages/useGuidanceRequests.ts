'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import expertApi from '@/lib/expertApi';
import type { GuidanceRequest } from './types';

interface GuidanceListResponse {
  data: GuidanceRequest[];
}

export function useGuidanceRequests(pollIntervalMs = 5000) {
  const [requests, setRequests] = useState<GuidanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestRunning = useRef(false);

  const refresh = useCallback(async () => {
    if (requestRunning.current) return;
    requestRunning.current = true;
    try {
      const response = await expertApi.get<GuidanceListResponse>('/expert/requests?limit=300');
      if (!mounted.current) return;
      setRequests(response.data.data || []);
      setError(null);
    } catch (requestError) {
      if (!mounted.current) return;
      console.error('[GuidanceRequests] Refresh failed', requestError);
      setError('Impossible de synchroniser les demandes');
    } finally {
      if (mounted.current) setLoading(false);
      requestRunning.current = false;
    }
  }, []);

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

  const unreadCount = requests.reduce((total, request) => total + request.unreadCount, 0);
  const openCount = requests.filter(
    (request) => !['RESOLVED', 'ARCHIVED'].includes(request.status),
  ).length;

  return { requests, loading, error, unreadCount, openCount, refresh };
}
