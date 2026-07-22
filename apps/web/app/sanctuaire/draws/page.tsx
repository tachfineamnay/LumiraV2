'use client';

export const dynamic = 'force-dynamic';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  PaperPanel,
  SanctuairePage,
  SanctuaireShellIntro,
  SanctuaireStage,
  paperBtnPrimary,
  paperBtnSecondary,
  shellBtnGhost,
} from '../../../components/sanctuary/SanctuaireStage';
import sanctuaireApi from '../../../lib/sanctuaireApi';
import { cn } from '../../../lib/utils';

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
      tone: 'border-emerald-600/25 bg-emerald-500/10 text-emerald-800',
    };
  if (status === 'AWAITING_VALIDATION')
    return {
      label: 'Relue par l’équipe',
      description: 'Une dernière vérification humaine est en cours avant sa publication.',
      tone: 'border-horizon-500/30 bg-horizon-400/15 text-horizon-700',
    };
  return {
    label: 'En préparation',
    description: 'Vous n’avez plus rien à faire. Nous vous écrirons dès qu’elle sera prête.',
    tone: 'border-serenity-400/30 bg-serenity-200/20 text-serenity-700',
  };
}

export default function DrawsPage() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [pending, setPending] = useState<Reading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    return Array.from(unique.values()).sort((left, right) => {
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
    <SanctuairePage maxWidth="max-w-4xl">
      <SanctuaireShellIntro
        title="Mes lectures"
        description="Suivez leur préparation, puis retrouvez l’audio et le document validés par l’équipe."
        action={
          allReadings.length > 0 ? (
            <button
              type="button"
              onClick={() => void loadReadings()}
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

      {error && (
        <div
          role="alert"
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-rose-400/30 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </span>
          <button
            type="button"
            onClick={() => void loadReadings()}
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

      {allReadings.length === 0 ? (
        <SanctuaireStage className="mt-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-horizon-500" />
          <h2 className="mt-4 font-playfair text-2xl italic text-paper-ink">
            Aucune lecture en préparation
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-paper-subtle">
            Préparez et confirmez votre dossier. Votre lecture apparaîtra ici dès sa prise en
            charge.
          </p>
          <Link href="/sanctuaire/dossier" className={cn(paperBtnPrimary(), 'mt-6')}>
            <ClipboardCheck className="h-4 w-4" /> Ouvrir mon dossier
          </Link>
        </SanctuaireStage>
      ) : (
        <div className="mt-8 space-y-4">
          {allReadings.map((reading) => {
            const status = statusCopy(reading.status);
            const pdfUrl = toBffAssetUrl(reading.assets.pdf);
            const audioUrl = toBffAssetUrl(reading.assets.audio);
            const hasAssets = Boolean(pdfUrl || audioUrl);
            const displayDate = reading.deliveredAt || reading.createdAt;

            return (
              <SanctuaireStage key={reading.id}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 h-5 w-5 shrink-0 text-horizon-600" />
                      <div className="min-w-0">
                        <h2 className="text-lg font-medium text-paper-ink">{reading.title}</h2>
                        <p className="mt-2 text-sm leading-6 text-paper-subtle">
                          {status.description}
                        </p>
                      </div>
                    </div>
                    {reading.intention && (
                      <div className="mt-4 border-l-2 border-horizon-500/40 pl-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-paper-subtle">
                          Votre intention
                        </p>
                        <p className="mt-1 text-sm leading-6 text-paper-soft">
                          {reading.intention}
                        </p>
                      </div>
                    )}
                    <p className="mt-4 text-xs text-paper-subtle">
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
                  <div className="mt-6 border-t border-paper-line pt-5">
                    {hasAssets ? (
                      <div className="space-y-4">
                        {audioUrl ? (
                          <MysticAudioPlayer audioUrl={audioUrl} variant="paper" />
                        ) : pdfUrl ? (
                          <PaperPanel tone="warn">
                            <p className="text-sm text-paper-soft">
                              Narration en préparation — actualisez dans quelques minutes.
                            </p>
                          </PaperPanel>
                        ) : null}
                        <div className="flex flex-col gap-3 sm:flex-row">
                          {pdfUrl && (
                            <Link
                              href={`/sanctuaire/lecture/${encodeURIComponent(reading.orderNumber)}`}
                              className={cn(paperBtnPrimary(), 'flex-1')}
                            >
                              <FileText className="h-4 w-4" /> Lire ma lecture
                            </Link>
                          )}
                          {pdfUrl && (
                            <button
                              type="button"
                              onClick={() => void downloadPdf(reading)}
                              disabled={downloadingId !== null}
                              className={cn(
                                paperBtnSecondary(),
                                'disabled:cursor-wait disabled:opacity-60',
                              )}
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
                      <PaperPanel
                        tone="warn"
                        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <p className="text-sm leading-6 text-paper-subtle">
                          La lecture est validée. Ses fichiers sont encore en cours de mise à
                          disposition.
                        </p>
                        <button
                          type="button"
                          onClick={() => void loadReadings()}
                          disabled={isRefreshing}
                          className={cn(paperBtnSecondary(), 'shrink-0 disabled:opacity-60')}
                        >
                          {isRefreshing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Vérifier
                        </button>
                      </PaperPanel>
                    )}
                  </div>
                )}
              </SanctuaireStage>
            );
          })}
        </div>
      )}
    </SanctuairePage>
  );
}

function ReadingsSkeleton() {
  return (
    <SanctuairePage maxWidth="max-w-4xl" className="animate-pulse">
      <div className="h-3 w-32 rounded-full bg-white/[0.06]" />
      <div className="mt-4 h-9 w-48 rounded-xl bg-white/[0.07]" />
      <div className="mt-3 h-4 w-full max-w-lg rounded-full bg-white/[0.05]" />
      {[0, 1].map((item) => (
        <div key={item} className="mt-6 h-40 rounded-[1.75rem] bg-paper/20" />
      ))}
    </SanctuairePage>
  );
}
