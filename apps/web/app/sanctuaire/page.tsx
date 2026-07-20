'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import dynamicImport from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BookOpen,
  ClipboardCheck,
  Download,
  FileText,
  Headphones,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ReadingPreparation } from '../../components/onboarding/ReadingPreparation';
import { MysticAudioPlayer } from '../../components/ui/MysticAudioPlayer';
import { useSanctuaire } from '../../context/SanctuaireContext';
import { useSanctuaireAuth } from '../../context/SanctuaireAuthContext';
import sanctuaireApi from '../../lib/sanctuaireApi';
import { resolveSanctuaireHomeState } from '../../lib/sanctuaireHomeState';

const ReadingViewerModal = dynamicImport(
  () =>
    import('../../components/sanctuary/ReadingViewerModal').then(
      (module) => module.ReadingViewerModal,
    ),
  { ssr: false },
);

type Reading = {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
  deliveredAt: string | null;
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
  const [showPreparation, setShowPreparation] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [readingsError, setReadingsError] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<{
    url: string;
    title: string;
    orderNumber: string;
  } | null>(null);

  const homeState = resolveSanctuaireHomeState({
    profile,
    draft: onboardingProgress,
    orders,
  });

  useEffect(() => {
    if (searchParams.get('onboarding') === '1' && !profile?.profileCompleted) {
      setShowPreparation(true);
    }
  }, [profile?.profileCompleted, searchParams]);

  const refreshReadings = useCallback(async () => {
    if (!profile?.profileCompleted) {
      setReadings([]);
      return;
    }
    try {
      setReadingsError(false);
      const { data } = await sanctuaireApi.get('/client/readings');
      setReadings(data.readings || []);
    } catch {
      setReadingsError(true);
    }
  }, [profile?.profileCompleted]);

  useEffect(() => {
    refreshReadings();
  }, [refreshReadings]);

  const latestReading = readings[0];
  const openReading = () => {
    const pdfUrl = toBffAssetUrl(latestReading?.assets.pdf);
    if (pdfUrl && latestReading) {
      setSelectedPdf({
        url: pdfUrl,
        title: latestReading.title,
        orderNumber: latestReading.orderNumber,
      });
    }
  };

  const downloadPdf = async () => {
    if (!latestReading?.assets.pdf) return;
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
    }
  };

  const blockForInitialLoad = (authLoading || entitlementsLoading) && !showPreparation;

  if (blockForInitialLoad) {
    return (
      <div className="grid min-h-[60vh] place-items-center" role="status">
        <Loader2 className="h-9 w-9 animate-spin text-horizon-300" />
      </div>
    );
  }

  const isPreparation = homeState.kind === 'PREPARE' || homeState.kind === 'RESUME';
  const isReady = homeState.kind === 'READY';
  const hasPdf = Boolean(latestReading?.assets.pdf);
  const audioUrl = toBffAssetUrl(latestReading?.assets.audio);

  return (
    <>
      {showPreparation && (
        <ReadingPreparation
          onCompleted={async () => {
            await refetchData();
            await refreshReadings();
          }}
          onClose={() => setShowPreparation(false)}
        />
      )}
      {selectedPdf && (
        <ReadingViewerModal
          isOpen
          onClose={() => setSelectedPdf(null)}
          pdfUrl={selectedPdf.url}
          title={selectedPdf.title}
          orderNumber={selectedPdf.orderNumber}
        />
      )}

      <div className="mx-auto w-full max-w-5xl px-4 py-8 pb-28 sm:px-6 sm:py-12 lg:pb-12">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-300">
            Sanctuaire Lumira
          </p>
          <h1 className="mt-3 font-playfair text-3xl italic text-stellar-100 sm:text-4xl">
            Bonjour {user?.firstName || ''}
          </h1>
          <p className="mt-3 text-base leading-7 text-stellar-400">
            Suivez votre dossier, retrouvez vos lectures et échangez avec l’équipe depuis un seul espace.
          </p>
        </header>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/[0.08] bg-abyss-600/50 p-5 shadow-abyss sm:p-7">
          <div className="flex items-start gap-4">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${
                isReady
                  ? 'bg-emerald-400/15 text-emerald-300'
                  : 'bg-horizon-400/15 text-horizon-300'
              }`}
            >
              {isReady ? <Checkmark /> : <Sparkles className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <h2 className="font-playfair text-2xl italic text-stellar-100">{homeState.title}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-stellar-400">
                {homeState.description}
              </p>
            </div>
          </div>

          {isPreparation && (
            <button
              type="button"
              onClick={() => setShowPreparation(true)}
              className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300"
            >
              <ClipboardCheck className="h-4 w-4" /> {homeState.actionLabel}
            </button>
          )}

          {(homeState.kind === 'EXPERT_REVIEW' || homeState.kind === 'PREPARING') && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sanctuaire/dossier"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300"
              >
                <ClipboardCheck className="h-4 w-4" /> Voir ce que j’ai transmis
              </Link>
              <Link
                href="/sanctuaire/draws"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-stellar-200 hover:bg-white/[0.05]"
              >
                <BookOpen className="h-4 w-4" /> Suivre ma lecture
              </Link>
            </div>
          )}

          {isReady && (
            <div className="mt-6 space-y-4">
              {audioUrl && (
                <MysticAudioPlayer
                  audioUrl={audioUrl}
                  loadingText="Audio indisponible pour le moment."
                />
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                {hasPdf ? (
                  <button
                    type="button"
                    onClick={openReading}
                    className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300"
                  >
                    <FileText className="h-4 w-4" /> Lire
                  </button>
                ) : (
                  <Link
                    href="/sanctuaire/draws"
                    className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-stellar-200 hover:bg-white/[0.05]"
                  >
                    <BookOpen className="h-4 w-4" /> Voir mes lectures
                  </Link>
                )}
                {audioUrl && (
                  <a
                    href="#audio"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-stellar-200 hover:bg-white/[0.05]"
                  >
                    <Headphones className="h-4 w-4" /> Écouter
                  </a>
                )}
                {hasPdf && (
                  <button
                    type="button"
                    onClick={downloadPdf}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-stellar-200 hover:bg-white/[0.05]"
                  >
                    <Download className="h-4 w-4" /> Télécharger le PDF
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <Link
            href="/sanctuaire/dossier"
            className="rounded-2xl border border-horizon-400/20 bg-horizon-400/[0.055] p-5 transition-colors hover:bg-horizon-400/[0.09]"
          >
            <ClipboardCheck className="h-5 w-5 text-horizon-300" />
            <h2 className="mt-4 text-base font-medium text-stellar-100">Mon dossier</h2>
            <p className="mt-1 text-sm leading-6 text-stellar-500">
              Voir les éléments choisis, le brouillon ou l’instantané scellé.
            </p>
          </Link>
          <Link
            href="/sanctuaire/draws"
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.06]"
          >
            <BookOpen className="h-5 w-5 text-horizon-300" />
            <h2 className="mt-4 text-base font-medium text-stellar-100">Mes lectures</h2>
            <p className="mt-1 text-sm leading-6 text-stellar-500">
              Suivre, lire, écouter ou télécharger les éléments disponibles.
            </p>
          </Link>
          <Link
            href="/sanctuaire/synthesis"
            className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.06]"
          >
            <Sparkles className="h-5 w-5 text-horizon-300" />
            <h2 className="mt-4 text-base font-medium text-stellar-100">Ma synthèse</h2>
            <p className="mt-1 text-sm leading-6 text-stellar-500">
              Retrouver les enseignements validés dans vos lectures.
            </p>
          </Link>
        </section>

        {readingsError && (
          <p role="alert" className="mt-5 text-sm text-rose-300">
            Vos fichiers ne sont pas accessibles pour le moment. Vous pouvez réessayer depuis Mes
            lectures.
          </p>
        )}
      </div>
    </>
  );
}

function Checkmark() {
  return (
    <span aria-hidden className="text-xl">
      ✓
    </span>
  );
}

export default function SanctuaireDashboard() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[60vh] place-items-center">
          <Loader2 className="h-9 w-9 animate-spin text-horizon-300" />
        </div>
      }
    >
      <SanctuaireHome />
    </Suspense>
  );
}
