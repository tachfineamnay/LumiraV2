'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ClipboardCheck,
  Download,
  FileText,
  Layers,
  Loader2,
  MessageCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { ReadingPreparation } from '../../components/onboarding/ReadingPreparation';
import { MysticAudioPlayer } from '../../components/ui/MysticAudioPlayer';
import {
  PaperPanel,
  SanctuairePage,
  SanctuaireShellIntro,
  SanctuaireStage,
  paperBtnPrimary,
  paperBtnSecondary,
} from '../../components/sanctuary/SanctuaireStage';
import { useSanctuaire } from '../../context/SanctuaireContext';
import { useSanctuaireAuth } from '../../context/SanctuaireAuthContext';
import sanctuaireApi from '../../lib/sanctuaireApi';
import { resolveSanctuaireHomeState } from '../../lib/sanctuaireHomeState';
import { cn } from '../../lib/utils';

type Reading = {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
  deliveredAt: string | null;
  createdAt?: string;
  assets: { pdf?: string | null; audio?: string | null };
};

function toBffAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/api/') ? url.replace('/api/', '/api/bff/') : url;
}

function SanctuaireHome() {
  const searchParams = useSearchParams();
  const { isLoading: entitlementsLoading } = useSanctuaire();
  const {
    isLoading: authLoading,
    onboardingProgress,
    orders,
    profile,
    refetchData,
    user,
  } = useSanctuaireAuth();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [readingsError, setReadingsError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const homeState = resolveSanctuaireHomeState({
    profile,
    draft: onboardingProgress,
    orders,
  });
  const isPreparation = homeState.kind === 'PREPARE' || homeState.kind === 'RESUME';

  useEffect(() => {
    if (searchParams.get('onboarding') === '1' && isPreparation) {
      const el = document.getElementById('dossier-preparation');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isPreparation, searchParams]);

  const refreshReadings = useCallback(async () => {
    if (!profile?.profileCompleted) {
      setReadings([]);
      return;
    }
    setIsRefreshing(true);
    try {
      setReadingsError(false);
      const { data } = await sanctuaireApi.get('/client/readings');
      setReadings(data.readings || []);
    } catch {
      setReadingsError(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [profile?.profileCompleted]);

  useEffect(() => {
    void refreshReadings();
  }, [refreshReadings]);

  const latestReading = useMemo(
    () =>
      [...readings].sort((left, right) => {
        const leftDate = left.deliveredAt || left.createdAt || '';
        const rightDate = right.deliveredAt || right.createdAt || '';
        return new Date(rightDate).getTime() - new Date(leftDate).getTime();
      })[0],
    [readings],
  );

  const downloadPdf = async () => {
    if (!latestReading?.assets.pdf || isDownloading) return;
    setIsDownloading(true);
    try {
      const { data } = await sanctuaireApi.get(`/readings/${latestReading.orderNumber}/file`, {
        responseType: 'blob',
      });
      const blob = new Blob([data], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${latestReading.title.replace(/[^\w-]+/gi, '_')}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setReadingsError(true);
    } finally {
      setIsDownloading(false);
    }
  };

  if (authLoading || entitlementsLoading) {
    return <SanctuaireHomeSkeleton />;
  }

  const isReady = homeState.kind === 'READY';
  const hasPdf = Boolean(latestReading?.assets.pdf);
  const audioUrl = toBffAssetUrl(latestReading?.assets.audio);
  const audioPending = isReady && hasPdf && !audioUrl;
  const savedDraftStep =
    homeState.kind === 'RESUME'
      ? Math.min(5, Math.max(1, (onboardingProgress?.currentStep ?? 0) + 1))
      : null;

  return (
    <SanctuairePage className="animate-hero-enter">
      <SanctuaireShellIntro
        title={<>Bonjour {user?.firstName || ''}</>}
        description="Votre dossier, votre lecture et les échanges avec l’équipe sont réunis ici."
      />

      <SanctuaireStage className="mt-8">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-2xl',
              isReady ? 'bg-emerald-600/15 text-emerald-700' : 'bg-horizon-400/20 text-horizon-600',
            )}
          >
            {isReady ? <Checkmark /> : <Sparkles className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-paper-subtle">
              Votre situation
            </p>
            <h2 className="mt-2 font-playfair text-2xl italic text-paper-ink">{homeState.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-paper-subtle">
              {homeState.description}
            </p>
          </div>
        </div>

        {savedDraftStep !== null && (
          <div
            className="mt-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-paper-line bg-paper-elevated px-3 py-2 text-xs text-paper-subtle"
            aria-label={`Brouillon sauvegardé à l’étape ${savedDraftStep} sur 5`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden />
            <span>Brouillon sauvegardé</span>
            <span aria-hidden>·</span>
            <span>Étape {savedDraftStep} sur 5</span>
          </div>
        )}

        {(homeState.kind === 'EXPERT_REVIEW' || homeState.kind === 'PREPARING') && (
          <Link
            href="/sanctuaire/dossier"
            className={cn(paperBtnPrimary(), 'mt-6 w-full sm:w-auto')}
          >
            <ClipboardCheck className="h-4 w-4" /> Voir ce que j’ai transmis
          </Link>
        )}

        {isReady && !latestReading && !readingsError && (
          <PaperPanel className="mt-6" tone="calm">
            <p className="text-sm leading-6 text-paper-soft">
              Votre dossier est prêt, mais la lecture n’apparaît pas encore ici. Actualisez dans un
              instant ou ouvrez « Mes lectures ».
            </p>
          </PaperPanel>
        )}

        {isReady && (
          <div className="mt-7 space-y-5">
            {latestReading?.title && (
              <div className="border-l-2 border-horizon-500/50 pl-4">
                <p className="text-xs uppercase tracking-[0.14em] text-paper-subtle">
                  Dernière lecture
                </p>
                <p className="mt-1 text-lg font-medium text-paper-ink">{latestReading.title}</p>
              </div>
            )}

            {audioUrl ? (
              <MysticAudioPlayer audioUrl={audioUrl} variant="paper" />
            ) : audioPending ? (
              <PaperPanel tone="warn" role="status">
                <p className="font-medium text-horizon-600">Narration en préparation</p>
                <p className="mt-1 text-sm leading-6 text-paper-subtle">
                  Votre PDF est disponible. L’enregistrement audio arrive dès qu’il est prêt —
                  actualisez cette page dans quelques minutes.
                </p>
                <button
                  type="button"
                  onClick={() => void refreshReadings()}
                  disabled={isRefreshing}
                  className="mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-xs font-semibold text-horizon-600 hover:bg-horizon-400/10 disabled:opacity-60"
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Vérifier l’audio
                </button>
              </PaperPanel>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              {hasPdf && latestReading ? (
                <Link
                  href={`/sanctuaire/lecture/${encodeURIComponent(latestReading.orderNumber)}`}
                  className={cn(paperBtnPrimary(), 'flex-1')}
                >
                  <FileText className="h-4 w-4" /> Lire ma lecture
                </Link>
              ) : (
                <Link href="/sanctuaire/draws" className={cn(paperBtnPrimary(), 'flex-1')}>
                  Voir ma lecture
                </Link>
              )}
              {hasPdf && (
                <button
                  type="button"
                  onClick={() => void downloadPdf()}
                  disabled={isDownloading}
                  className={cn(paperBtnSecondary(), 'disabled:cursor-wait disabled:opacity-60')}
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Télécharger le PDF
                </button>
              )}
            </div>

            <div className="grid gap-2 border-t border-paper-line pt-5 sm:grid-cols-2">
              <Link
                href="/sanctuaire/synthesis"
                className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-sm text-paper-soft transition-colors hover:bg-paper-muted"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-horizon-400/15 text-horizon-600">
                  <Layers className="h-4 w-4" />
                </span>
                Retrouver l’essentiel dans ma synthèse
              </Link>
              <Link
                href="/sanctuaire/chat"
                className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-sm text-paper-soft transition-colors hover:bg-paper-muted"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-serenity-400/15 text-serenity-500">
                  <MessageCircle className="h-4 w-4" />
                </span>
                Demander un éclairage à l’équipe
              </Link>
            </div>
          </div>
        )}
      </SanctuaireStage>

      {isPreparation && (
        <div className="mt-8">
          <ReadingPreparation
            variant="inline"
            onCompleted={async () => {
              await refetchData();
              await refreshReadings();
            }}
          />
        </div>
      )}

      {readingsError && (
        <div
          role="alert"
          className="mt-5 flex flex-col gap-3 rounded-2xl border border-rose-400/30 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>Vos fichiers ne sont pas accessibles pour le moment.</span>
          <button
            type="button"
            onClick={() => void refreshReadings()}
            disabled={isRefreshing}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-rose-300/40 px-4 py-2 font-medium hover:bg-rose-100 disabled:opacity-60"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Réessayer
          </button>
        </div>
      )}
    </SanctuairePage>
  );
}

function Checkmark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SanctuaireHomeSkeleton() {
  return (
    <SanctuairePage className="animate-pulse">
      <div className="h-4 w-40 rounded-full bg-white/[0.06]" />
      <div className="mt-4 h-10 w-72 max-w-full rounded-2xl bg-white/[0.07]" />
      <div className="mt-3 h-4 w-96 max-w-full rounded-full bg-white/[0.05]" />
      <div className="mt-8 h-48 rounded-[1.75rem] bg-paper/20" />
    </SanctuairePage>
  );
}

export default function SanctuairePageRoute() {
  return (
    <Suspense fallback={<SanctuaireHomeSkeleton />}>
      <SanctuaireHome />
    </Suspense>
  );
}
