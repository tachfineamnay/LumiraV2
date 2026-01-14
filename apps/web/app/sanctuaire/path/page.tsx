'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { TimelineConstellation } from '../../../components/sanctuary/TimelineConstellation';
import { useTimeline } from '../../../hooks/useTimeline';

export default function PathPage() {
    const { steps, archetype, currentDay, isLoading, completeStep } = useTimeline();

    const handleOpenChat = () => {
        // TODO: Open chat session overlay
        console.log('Open chat');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
        );
    }

    if (!steps.length) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
                    <span className="text-4xl">🌟</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">
                    Votre Chemin de Vie
                </h2>
                <p className="text-slate-400 max-w-md mb-8">
                    Votre parcours spirituel personnalisé sera disponible après la génération de votre lecture.
                    Contactez notre équipe si vous avez des questions.
                </p>
                <a
                    href="/sanctuaire"
                    className="px-6 py-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                >
                    Retour au Sanctuaire
                </a>
            </div>
        );
    }

    return (
        <div className="py-8 px-4">
            <TimelineConstellation
                steps={steps}
                currentDay={currentDay}
                archetype={archetype}
                onCompleteStep={completeStep}
                onOpenChat={handleOpenChat}
            />
        </div>
    );
}
