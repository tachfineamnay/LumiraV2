'use client';

export const dynamic = 'force-dynamic';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import sanctuaireApi from '../../../lib/sanctuaireApi';

interface SpiritualPath {
  archetype?: string | null;
  synthesis?: string | null;
  keyBlockage?: string | null;
  keywords?: string[];
  emotionalState?: string | null;
  lifeMission?: string | null;
}

export default function SynthesisPage() {
  const [synthesis, setSynthesis] = useState<SpiritualPath | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSynthesis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await sanctuaireApi.get('/client/spiritual-path');
      setSynthesis(data?.exists === false ? null : data);
    } catch {
      setError('Votre synthèse ne peut pas être chargée pour le moment.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSynthesis();
  }, [loadSynthesis]);

  if (isLoading)
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-9 w-9 animate-spin text-horizon-300" />
      </div>
    );

  if (error) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 text-center">
        <div>
          <AlertCircle className="mx-auto h-8 w-8 text-rose-300" />
          <h1 className="mt-4 font-playfair text-2xl italic text-stellar-100">
            Erreur de chargement
          </h1>
          <p className="mt-2 text-sm text-stellar-400">{error}</p>
          <button
            type="button"
            onClick={loadSynthesis}
            className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2 text-sm text-stellar-200 hover:bg-white/[0.05]"
          >
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
        </div>
      </div>
    );
  }

  const sections = [
    synthesis?.archetype || synthesis?.lifeMission
      ? {
          title: 'Forces',
          content: [
            synthesis.archetype && `Archétype : ${synthesis.archetype}`,
            synthesis.lifeMission,
          ]
            .filter(Boolean)
            .join('\n'),
        }
      : null,
    synthesis?.keyBlockage ? { title: 'Points d’attention', content: synthesis.keyBlockage } : null,
    synthesis?.keywords?.length
      ? { title: 'Thèmes récurrents', content: synthesis.keywords.join(' · ') }
      : null,
    synthesis?.synthesis ? { title: 'Conseils essentiels', content: synthesis.synthesis } : null,
  ].filter((section): section is { title: string; content: string } => Boolean(section));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-300">
            Sanctuaire Lumira
          </p>
          <h1 className="mt-2 font-playfair text-3xl italic text-stellar-100">Ma synthèse</h1>
          <p className="mt-2 text-sm text-stellar-400">
            Les enseignements qui ont réellement été générés et validés dans vos lectures.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSynthesis}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2 text-sm text-stellar-300 hover:bg-white/[0.05]"
        >
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </header>

      {sections.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 text-center sm:p-12">
          <Sparkles className="mx-auto h-8 w-8 text-horizon-300" />
          <h2 className="mt-4 font-playfair text-2xl italic text-stellar-100">
            Votre synthèse se construit avec vos lectures.
          </h2>
        </section>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-3xl border border-white/[0.08] bg-abyss-600/50 p-5 sm:p-6"
            >
              <h2 className="font-playfair text-xl italic text-stellar-100">{section.title}</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stellar-400">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
