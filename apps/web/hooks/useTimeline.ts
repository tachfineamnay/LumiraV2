'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import sanctuaireApi from '../lib/sanctuaireApi';
import type { PathStep } from '../components/sanctuary/TimelineConstellation';

interface SpiritualPathData {
    id: string;
    archetype: string;
    synthesis: string;
    keyBlockage?: string;
    startedAt: string;
    steps: PathStep[];
}

interface UseTimelineOptions {
    userId?: string;
    autoRefresh?: boolean;
}

export function useTimeline(options: UseTimelineOptions = {}) {
    const [spiritualPath, setSpiritualPath] = useState<SpiritualPathData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    // Calculate current day based on path start date
    const getCurrentDay = useCallback(() => {
        if (!spiritualPath?.startedAt) return 1;
        const start = new Date(spiritualPath.startedAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.min(diffDays, 30);
    }, [spiritualPath?.startedAt]);

    // Fetch spiritual path via BFF (httpOnly cookie)
    const fetchPath = useCallback(async () => {
        try {
            const res = await sanctuaireApi.get('/client/spiritual-path');
            const data = res.data;

            if (data.exists === false) {
                setSpiritualPath(null);
                return;
            }

            setSpiritualPath({
                id: data.id,
                archetype: data.archetype,
                synthesis: data.synthesis,
                keyBlockage: data.keyBlockage,
                startedAt: data.startedAt,
                steps: data.steps || [],
            });
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 404) {
                setSpiritualPath(null);
            } else if (status === 401) {
                setSpiritualPath(null);
            } else {
                const error = err instanceof Error ? err : new Error('Unknown error');
                setError(error);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Complete a step
    const completeStep = useCallback(async (stepId: string) => {
        try {
            await sanctuaireApi.post(`/client/spiritual-path/steps/${stepId}/complete`);

            setSpiritualPath(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    steps: prev.steps.map(step =>
                        step.id === stepId
                            ? { ...step, isCompleted: true, completedAt: new Date().toISOString() }
                            : step
                    ),
                };
            });

            toast.success('Étape complétée ! 🌟');
        } catch {
            toast.error('Session expirée ou erreur');
        }
    }, []);

    useEffect(() => {
        fetchPath();
        if (options.autoRefresh) {
            const interval = setInterval(fetchPath, 60000);
            return () => clearInterval(interval);
        }
    }, [fetchPath, options.autoRefresh]);

    return {
        spiritualPath,
        steps: spiritualPath?.steps || [],
        archetype: spiritualPath?.archetype,
        currentDay: getCurrentDay(),
        isLoading,
        error,
        completeStep,
        refetch: fetchPath,
    };
}

export default useTimeline;
