'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface GenerationResult {
    success: boolean;
    orderId: string;
    orderNumber: string;
    pdfUrl: string;
    archetype: string;
    stepsCreated: number;
}

interface UseOrderGenerationOptions {
    onSuccess?: (result: GenerationResult) => void;
    onError?: (error: Error) => void;
}

export function useOrderGeneration(options: UseOrderGenerationOptions = {}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<GenerationResult | null>(null);
    const [error, setError] = useState<Error | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const generate = useCallback(async (orderId: string) => {
        const token = localStorage.getItem('expert_token');
        if (!token) {
            toast.error('Session expirée. Veuillez vous reconnecter.');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const response = await fetch(`${apiUrl}/api/expert/orders/${orderId}/generate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Échec de la génération');
            }

            const data: GenerationResult = await response.json();
            setResult(data);

            toast.success(`Lecture générée ! Archétype: ${data.archetype}`);
            options.onSuccess?.(data);

            return data;
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Erreur inconnue');
            setError(error);
            toast.error(error.message);
            options.onError?.(error);
            throw error;
        } finally {
            setIsGenerating(false);
        }
    }, [apiUrl, options]);

    const reset = useCallback(() => {
        setResult(null);
        setError(null);
    }, []);

    return {
        generate,
        isGenerating,
        result,
        error,
        reset,
    };
}

export default useOrderGeneration;
