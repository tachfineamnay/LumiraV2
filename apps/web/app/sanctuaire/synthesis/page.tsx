'use client';

export const dynamic = 'force-dynamic';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Compass,
  Eye,
  Heart,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  SanctuairePage,
  SanctuaireShellIntro,
  SanctuaireStage,
  paperBtnPrimary,
  shellBtnGhost,
} from '../../../components/sanctuary/SanctuaireStage';
import sanctuaireApi from '../../../lib/sanctuaireApi';
import { cn } from '../../../lib/utils';

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSynthesis = useCallback(async (initial = false) => {
    if (initial) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const { data } = await sanctuaireApi.get('/client/spiritual-path');
      setSynthesis(data?.exists === false ? null : data);
    } catch {
      setError('Votre synthèse ne peut pas être chargée pour le moment.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSynthesis(true);
  }, [loadSynthesis]);

  if (isLoading) return <SynthesisSkeleton />;

  if (error) {
    return (
      <SanctuairePage
        maxWidth="max-w-xl"
        className="grid min-h-[60vh] place-items-center text-center"
      >
        <div>
          <AlertCircle className="mx-auto h-8 w-8 text-rose-300" />
          <h1 className="mt-4 font-playfair text-2xl italic text-stellar-100">
            Votre synthèse est momentanément indisponible
          </h1>
          <p className="mt-2 text-sm leading-6 text-stellar-400">{error}</p>
          <button
            type="button"
            onClick={() => void loadSynthesis()}
            disabled={isRefreshing}
            className={cn(shellBtnGhost(), 'mt-6')}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Réessayer
          </button>
        </div>
      </SanctuairePage>
    );
  }

  const hasContent = Boolean(
    synthesis?.archetype ||
    synthesis?.synthesis ||
    synthesis?.keyBlockage ||
    synthesis?.emotionalState ||
    synthesis?.lifeMission ||
    synthesis?.keywords?.length,
  );

  return (
    <SanctuairePage maxWidth="max-w-4xl">
      <SanctuaireShellIntro
        title="Ma synthèse"
        description="Les repères essentiels validés dans votre lecture, réunis pour être retrouvés rapidement."
        action={
          hasContent ? (
            <button
              type="button"
              onClick={() => void loadSynthesis()}
              disabled={isRefreshing}
              className={shellBtnGhost()}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Actualiser
            </button>
          ) : undefined
        }
      />

      {!hasContent ? (
        <SanctuaireStage className="mt-8 text-center" padded>
          <Sparkles className="mx-auto h-8 w-8 text-horizon-500" />
          <h2 className="mt-4 font-playfair text-2xl italic text-paper-ink">
            Votre synthèse apparaîtra après votre première lecture
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-paper-subtle">
            Elle regroupera seulement les enseignements qui auront été générés puis validés par
            l’équipe Lumira.
          </p>
          <Link href="/sanctuaire/draws" className={cn(paperBtnPrimary(), 'mt-6')}>
            <BookOpen className="h-4 w-4" /> Voir mes lectures
          </Link>
        </SanctuaireStage>
      ) : (
        <div className="mt-8 space-y-5">
          {synthesis?.archetype && (
            <SanctuaireStage>
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-horizon-400/20 text-horizon-600">
                  <Sparkles className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-600">
                    Votre archétype
                  </p>
                  <h2 className="mt-2 font-playfair text-3xl italic text-paper-ink">
                    {synthesis.archetype}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-paper-subtle">
                    Un repère central de votre lecture, à considérer comme une dynamique d’évolution
                    plutôt qu’une étiquette définitive.
                  </p>
                </div>
              </div>
            </SanctuaireStage>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {synthesis?.emotionalState && (
              <SynthesisSection
                icon={<Heart className="h-5 w-5" />}
                eyebrow="Aujourd’hui"
                title="Votre dynamique actuelle"
                content={synthesis.emotionalState}
              />
            )}
            {synthesis?.lifeMission && (
              <SynthesisSection
                icon={<Compass className="h-5 w-5" />}
                eyebrow="Direction"
                title="Ce qui cherche à prendre place"
                content={synthesis.lifeMission}
              />
            )}
          </div>

          {synthesis?.keyBlockage && (
            <SanctuaireStage>
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-horizon-400/20 text-horizon-600">
                  <Eye className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-horizon-600">
                    Point de vigilance
                  </p>
                  <h2 className="mt-2 font-playfair text-xl italic text-paper-ink">
                    Ce qui mérite votre attention
                  </h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-paper-subtle">
                    {synthesis.keyBlockage}
                  </p>
                </div>
              </div>
            </SanctuaireStage>
          )}

          {synthesis?.synthesis && (
            <SanctuaireStage>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-horizon-600">
                À retenir
              </p>
              <h2 className="mt-2 font-playfair text-2xl italic text-paper-ink">
                Vos conseils essentiels
              </h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-paper-soft">
                {synthesis.synthesis}
              </p>
            </SanctuaireStage>
          )}

          {synthesis?.keywords?.length ? (
            <SanctuaireStage>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-paper-subtle">
                Mots d’ancrage
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {synthesis.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-horizon-500/25 bg-horizon-400/10 px-3 py-1.5 text-sm text-horizon-600"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </SanctuaireStage>
          ) : null}

          <Link
            href="/sanctuaire/draws"
            className="flex min-h-[56px] items-center justify-between rounded-[1.25rem] border border-paper-line bg-paper px-4 text-sm text-paper-soft shadow-paper-soft transition-colors hover:bg-paper-elevated"
          >
            <span className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-horizon-600" /> Revenir à la lecture complète
            </span>
            <ArrowRight className="h-4 w-4 text-paper-subtle" />
          </Link>
        </div>
      )}
    </SanctuairePage>
  );
}

function SynthesisSection({
  icon,
  eyebrow,
  title,
  content,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  content: string;
}) {
  return (
    <SanctuaireStage>
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-horizon-400/15 text-horizon-600">
        {icon}
      </span>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-paper-subtle">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-playfair text-xl italic text-paper-ink">{title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-paper-subtle">{content}</p>
    </SanctuaireStage>
  );
}

function SynthesisSkeleton() {
  return (
    <SanctuairePage maxWidth="max-w-4xl" className="animate-pulse">
      <div className="h-3 w-32 rounded-full bg-white/[0.06]" />
      <div className="mt-4 h-9 w-44 rounded-xl bg-white/[0.07]" />
      <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-white/[0.05]" />
      <div className="mt-8 h-40 rounded-[1.75rem] bg-paper/20" />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="h-36 rounded-[1.75rem] bg-paper/15" />
        ))}
      </div>
    </SanctuairePage>
  );
}
