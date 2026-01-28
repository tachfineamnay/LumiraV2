'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Calculate current day based on path start date
    const getCurrentDay = useCallback(() => {
        if (!spiritualPath?.startedAt) return 1;
        const start = new Date(spiritualPath.startedAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.min(diffDays, 30);
    }, [spiritualPath?.startedAt]);

    // Fetch spiritual path
    const fetchPath = useCallback(async () => {
        const token = localStorage.getItem('sanctuaire_token');
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch(`${apiUrl}/api/client/spiritual-path`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                if (res.status === 404) {
                    // No path yet - this is normal for new users
                    setSpiritualPath(null);
                    return;
                }
                throw new Error('Failed to fetch spiritual path');
            }

            const data = await res.json();
            
            // Handle backend response structure
            if (data.exists === false) {
                setSpiritualPath(null);
                return;
            }
            
            // Set the spiritual path data (exists: true is stripped)
            setSpiritualPath({
                id: data.id,
                archetype: data.archetype,
                synthesis: data.synthesis,
                keyBlockage: data.keyBlockage,
                startedAt: data.startedAt,
                steps: data.steps || [],
            });
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
        } finally {
            setIsLoading(false);
        }
    }, [apiUrl]);

    // Complete a step
    const completeStep = useCallback(async (stepId: string) => {
        const token = localStorage.getItem('sanctuaire_token');
        if (!token) {
            toast.error('Session expirée');
            return;
        }

        try {
            const res = await fetch(`${apiUrl}/api/client/spiritual-path/steps/${stepId}/complete`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                throw new Error('Failed to complete step');
            }

            // Update local state
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
        } catch (err) {
            toast.error('Erreur lors de la complétion');
            throw err;
        }
    }, [apiUrl]);

    // Initial fetch
    useEffect(() => {
        fetchPath();
    }, [fetchPath]);

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
