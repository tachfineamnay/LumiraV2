'use client';

export const dynamic = 'force-dynamic';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamicImport from 'next/dynamic';
import Link from 'next/link';
import {
  AlertCircle,
  ClipboardCheck,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { MysticAudioPlayer } from '../../../components/ui/MysticAudioPlayer';
import sanctuaireApi from '../../../lib/sanctuaireApi';

const ReadingViewerModal = dynamicImport(
  () =>
    import('../../../components/sanctuary/ReadingViewerModal').then(
      (module) => module.ReadingViewerModal,
    ),
  { ssr: false },
);

type ReadingStatus = 'PAID' | 'PROCESSING' | 'AWAITING_VALIDATION' | 'COMPLETED';

interface Reading {
  id: string;
  orderNumber: string;
  status: ReadingStatus;
  deliveredAt: string | null;
  createdAt: string;
  title: string;
  archetype: string | null;
  intention?: string | null;
  assets: { pdf?: string | null; audio?: string | null };
}

function toBffAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/api/') ? url.replace('/api/', '/api/bff/') : url;
}

function statusCopy(status: ReadingStatus): { label: string; description: string; tone: string } {
  if (status === 'COMPLETED')
    return {
      label: 'Prête',
      description: 'Votre lecture a été validée et mise à votre disposition.',
      tone: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/25',
    };
  if (status === 'AWAITING_VALIDATION')
    return {
      label: 'Relue par l’équipe',
      description: 'Une dernière vérification humaine est en cours avant sa publication.',
      tone: 'bg-horizon-400/15 text-horizon-200 border-horizon-400/25',
    };
  return {
    label: 'En préparation',
    description: 'Vous n’avez plus rien à faire. Nous vous écrirons dès qu’elle sera prête.',
    tone: 'bg-horizon-400/15 text-horizon-200 border-horizon-400/25',
  };
}

export default function DrawsPage() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [pending, setPending] = useState<Reading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<{
    url: string;
    title: string;
    orderNumber: string;
  } | null>(null);

  const loadReadings = useCallback(async (initial = false) => {
    if (initial) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const { data } = await sanctuaireApi.get('/client/readings');
      setReadings(data.readings || []);
      setPending(data.pending || []);
    } catch {
      setError('Vos lectures ne sont pas accessibles pour le moment.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReadings(true);
  }, [loadReadings]);

  const allReadings = useMemo(() => {
    const unique = new Map<string, Reading>();
    [...pending, ...readings].forEach((reading) => unique.set(reading.id, reading));
    return [...unique.values()].sort((left, right) => {
      const leftDate = left.deliveredAt || left.createdAt;
      const rightDate = right.deliveredAt || right.createdAt;
      return new Date(rightDate).getTime() - new Date(leftDate).getTime();
    });
  }, [pending, readings]);

  const downloadPdf = async (reading: Reading) => {
    if (downloadingId) return;
    setDownloadingId(reading.id);
    setError(null);
    try {
      const { data } = await sanctuaireApi.get(`/readings/${reading.orderNumber}/file`, {
        responseType: 'blob',
      });
      const objectUrl = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${reading.title.replace(/[^\w-]+/gi, '_')}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError('Le PDF ne peut pas être téléchargé pour le moment.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) return <ReadingsSkeleton />;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 pb-28 sm:px-6 sm:py-12 lg:pb-12">
      {selectedPdf && (
        <ReadingViewerModal
          isOpen
          onClose={() => setSelectedPdf(null)}
          pdfUrl={selectedPdf.url}
          title={selectedPdf.title}
          orderNumber={selectedPdf.orderNumber}
        />
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-300">
            Sanctuaire Lumira
          </p>
          <h1 className="mt-2 font-playfair text-3xl italic text-stellar-100">Mes lectures</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stellar-400">
            Suivez leur préparation, puis retrouvez l’audio et le document validés par l’équipe.
          </p>
        </div>
        {allReadings.length > 0 && (
          <button
            type="button"
            onClick={() => void loadReadings()}
            disabled={isRefreshing}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2 text-sm text-stellar-300 hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60"
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

      {error && (
        <div
          role="alert"
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </span>
          <button
            type="button"
            onClick={() => void loadReadings()}
            disabled={isRefreshing}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-rose-300/20 px-4 py-2 font-medium hover:bg-rose-300/10 disabled:opacity-60"
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

      {allReadings.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 text-center sm:p-12">
          <Sparkles className="mx-auto h-8 w-8 text-horizon-300" />
          <h2 className="mt-4 font-playfair text-2xl italic text-stellar-100">
            Aucune lecture en préparation
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stellar-400">
            Préparez et confirmez votre dossier. Votre lecture apparaîtra ici dès sa prise en charge.
          </p>
          <Link
            href="/sanctuaire/dossier"
            className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300"
          >
            <ClipboardCheck className="h-4 w-4" /> Ouvrir mon dossier
          </Link>
        </section>
      ) : (
        <div className="mt-8 space-y-4">
          {allReadings.map((reading) => {
            const status = statusCopy(reading.status);
            const pdfUrl = toBffAssetUrl(reading.assets.pdf);
            const audioUrl = toBffAssetUrl(reading.assets.audio);
            const hasAssets = Boolean(pdfUrl || audioUrl);
            const displayDate = reading.deliveredAt || reading.createdAt;

            return (
              <article
                key={reading.id}
                className="rounded-3xl border border-white/[0.08] bg-abyss-600/50 p-5 sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-horizon-300" />
                      <div className="min-w-0">
                        <h2 className="text-lg font-medium text-stellar-100">{reading.title}</h2>
                        <p className="mt-2 text-sm leading-6 text-stellar-400">
                          {status.description}
                        </p>
                      </div>
                    </div>
                    {reading.intention && (
                      <div className="mt-4 border-l-2 border-horizon-400/25 pl-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stellar-500">
                          Votre intention
                        </p>
                        <p className="mt-1 text-sm leading-6 text-stellar-300">{reading.intention}</p>
                      </div>
                    )}
                    <p className="mt-4 text-xs text-stellar-500">
                      {reading.status === 'COMPLETED' ? 'Disponible' : 'Dossier ouvert'} le{' '}
                      {new Date(displayDate).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span
                    className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${status.tone}`}
                  >
                    {status.label}
                  </span>
                </div>

                {reading.status === 'COMPLETED' && (
                  <div className="mt-6 border-t border-white/[0.06] pt-5">
                    {hasAssets ? (
                      <div className="space-y-4">
                        {audioUrl && <MysticAudioPlayer audioUrl={audioUrl} />}
                        <div className="flex flex-col gap-3 sm:flex-row">
                          {pdfUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedPdf({
                                  url: pdfUrl,
                                  title: reading.title,
                                  orderNumber: reading.orderNumber,
                                })
                              }
                              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-horizon-400 px-5 py-3 text-sm font-semibold text-abyss-900 hover:bg-horizon-300"
                            >
                              <FileText className="h-4 w-4" /> Lire ma lecture
                            </button>
                          )}
                          {pdfUrl && (
                            <button
                              type="button"
                              onClick={() => void downloadPdf(reading)}
                              disabled={downloadingId !== null}
                              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-stellar-200 hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60"
                            >
                              {downloadingId === reading.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              Télécharger le PDF
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 rounded-2xl border border-horizon-400/15 bg-horizon-400/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm leading-6 text-stellar-400">
                          La lecture est validée. Ses fichiers sont encore en cours de mise à disposition.
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadReadings()}
                          disabled={isRefreshing}
                          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2 text-sm text-stellar-200 hover:bg-white/[0.05] disabled:opacity-60"
                        >
                          {isRefreshing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Vérifier
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReadingsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl animate-pulse px-4 py-8 pb-28 sm:px-6 sm:py-12 lg:pb-12">
      <div className="h-3 w-32 rounded-full bg-white/[0.06]" />
      <div className="mt-4 h-9 w-48 rounded-xl bg-white/[0.07]" />
      <div className="mt-3 h-4 w-full max-w-lg rounded-full bg-white/[0.05]" />
      {[0, 1].map((item) => (
        <div
          key={item}
          className="mt-6 rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6"
        >
          <div className="h-6 w-2/3 rounded-lg bg-white/[0.07]" />
          <div className="mt-4 h-4 w-full rounded-full bg-white/[0.05]" />
          <div className="mt-2 h-4 w-4/5 rounded-full bg-white/[0.05]" />
          <div className="mt-6 h-12 w-full rounded-xl bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}
