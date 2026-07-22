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
      <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 text-center">
        <div>
          <AlertCircle className="mx-auto h-8 w-8 text-rose-300" />
          <h1 className="mt-4 font-playfair text-2xl italic text-ivoire-100">
            Votre synthèse est momentanément indisponible
          </h1>
          <p className="mt-2 text-sm leading-6 text-brume-200">{error}</p>
          <button
            type="button"
            onClick={() => void loadSynthesis()}
            disabled={isRefreshing}
            className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-ivoire-500/[0.08] px-4 py-2 text-sm text-ivoire-200 hover:bg-brume-800/25 disabled:opacity-60"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Réessayer
          </button>
        </div>
      </div>
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
    <div className="mx-auto w-full max-w-4xl px-4 py-8 pb-28 sm:px-6 sm:py-12 lg:pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ivoire-400">
            Sanctuaire Lumira
          </p>
          <h1 className="mt-2 font-playfair text-3xl italic text-ivoire-100">Ma synthèse</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-brume-200">
            Les repères essentiels validés dans votre lecture, réunis pour être retrouvés
            rapidement.
          </p>
        </div>
        {hasContent && (
          <button
            type="button"
            onClick={() => void loadSynthesis()}
            disabled={isRefreshing}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-ivoire-500/[0.08] px-4 py-2 text-sm text-ivoire-200 hover:bg-brume-800/25 disabled:opacity-60"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Actualiser
          </button>
        )}
      </header>

      {!hasContent ? (
        <section className="mt-8 rounded-3xl border border-white/[0.08] bg-brume-800/20 p-8 text-center sm:p-12">
          <Sparkles className="mx-auto h-8 w-8 text-ivoire-400" />
          <h2 className="mt-4 font-playfair text-2xl italic text-ivoire-100">
            Votre synthèse apparaîtra après votre première lecture
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-brume-200">
            Elle regroupera seulement les enseignements qui auront été générés puis validés par
            l’équipe Lumira.
          </p>
          <Link
            href="/sanctuaire/draws"
            className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300"
          >
            <BookOpen className="h-4 w-4" /> Voir mes lectures
          </Link>
        </section>
      ) : (
        <div className="mt-8 space-y-5">
          {synthesis?.archetype && (
            <section className="overflow-hidden rounded-3xl border border-ivoire-400/20 bg-ivoire-400/[0.045] p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ivoire-400/10 text-ivoire-400">
                  <Sparkles className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ivoire-400">
                    Votre archétype
                  </p>
                  <h2 className="mt-2 font-playfair text-3xl italic text-ivoire-100">
                    {synthesis.archetype}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-brume-200">
                    Un repère central de votre lecture, à considérer comme une dynamique d’évolution
                    plutôt qu’une étiquette définitive.
                  </p>
                </div>
              </div>
            </section>
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
            <section className="rounded-3xl border border-amber-300/15 bg-amber-300/[0.035] p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-200">
                  <Eye className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200/75">
                    Point de vigilance
                  </p>
                  <h2 className="mt-2 font-playfair text-xl italic text-ivoire-100">
                    Ce qui mérite votre attention
                  </h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-brume-200">
                    {synthesis.keyBlockage}
                  </p>
                </div>
              </div>
            </section>
          )}

          {synthesis?.synthesis && (
            <section className="rounded-3xl border glass-aube p-5 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ivoire-400">
                À retenir
              </p>
              <h2 className="mt-2 font-playfair text-2xl italic text-ivoire-100">
                Vos conseils essentiels
              </h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ivoire-200">
                {synthesis.synthesis}
              </p>
            </section>
          )}

          {synthesis?.keywords?.length ? (
            <section className="rounded-3xl border border-white/[0.08] bg-brume-800/15 p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brume-300">
                Mots d’ancrage
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {synthesis.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-ivoire-400/20 bg-ivoire-400/[0.06] px-3 py-1.5 text-sm text-ivoire-300"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <Link
            href="/sanctuaire/draws"
            className="flex min-h-[56px] items-center justify-between rounded-2xl border border-white/[0.08] px-4 text-sm text-ivoire-200 transition-colors hover:bg-brume-800/22"
          >
            <span className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-ivoire-400" /> Revenir à la lecture complète
            </span>
            <ArrowRight className="h-4 w-4 text-brume-300" />
          </Link>
        </div>
      )}
    </div>
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
    <section className="rounded-3xl border glass-aube p-5 sm:p-6">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brume-800/22 text-ivoire-400">
        {icon}
      </span>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-brume-300">
        {eyebrow}
      </p>
      <h2 className="mt-2 font-playfair text-xl italic text-ivoire-100">{title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-brume-200">{content}</p>
    </section>
  );
}

function SynthesisSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl animate-pulse px-4 py-8 pb-28 sm:px-6 sm:py-12 lg:pb-12">
      <div className="h-3 w-32 rounded-full bg-brume-700/20" />
      <div className="mt-4 h-9 w-44 rounded-xl bg-brume-700/20" />
      <div className="mt-3 h-4 w-full max-w-xl rounded-full bg-brume-800/25" />
      <div className="mt-8 rounded-3xl border border-ivoire-500/[0.05] bg-brume-800/15 p-7">
        <div className="h-12 w-12 rounded-2xl bg-brume-700/20" />
        <div className="mt-5 h-8 w-64 max-w-full rounded-xl bg-brume-700/20" />
        <div className="mt-4 h-4 w-full rounded-full bg-brume-800/25" />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="rounded-3xl border border-ivoire-500/[0.05] bg-brume-800/15 p-6"
          >
            <div className="h-10 w-10 rounded-2xl bg-brume-700/20" />
            <div className="mt-5 h-6 w-2/3 rounded-lg bg-brume-700/20" />
            <div className="mt-4 h-4 w-full rounded-full bg-brume-800/25" />
            <div className="mt-2 h-4 w-4/5 rounded-full bg-brume-800/25" />
          </div>
        ))}
      </div>
    </div>
  );
}
