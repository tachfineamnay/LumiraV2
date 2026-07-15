'use client';

export const dynamic = 'force-dynamic';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { TimelineConstellation } from '../../../components/sanctuary/TimelineConstellation';
import { useTimeline } from '../../../hooks/useTimeline';

export default function PathPage() {
  const router = useRouter();
  const { steps, archetype, currentDay, isLoading, completeStep } = useTimeline();

  const handleOpenChat = () => {
    router.push('/sanctuaire/chat?from=path');
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!steps.length) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-4 sm:p-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
          <span className="text-4xl" aria-hidden>
            🌟
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Votre Chemin de Vie</h2>
        <p className="text-slate-400 max-w-md mb-8 text-sm sm:text-base">
          Votre parcours spirituel personnalisé sera disponible après la génération de votre
          lecture.
        </p>
        <a
          href="/sanctuaire"
          className="px-6 py-3 min-h-[48px] inline-flex items-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
        >
          Retour au Sanctuaire
        </a>
      </div>
    );
  }

  return (
    <div className="py-4 sm:py-8 px-3 sm:px-4">
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
