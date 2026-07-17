'use client';

export const dynamic = 'force-dynamic';

import React, { useCallback, useEffect, useState } from 'react';
import dynamicImport from 'next/dynamic';
import { AlertCircle, Download, FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react';
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
      description: 'Disponible dans votre espace.',
      tone: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/25',
    };
  if (status === 'AWAITING_VALIDATION')
    return {
      label: 'En vérification',
      description: 'Notre équipe vérifie votre lecture avant sa mise à disposition.',
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
  const [error, setError] = useState<string | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<{
    url: string;
    title: string;
    orderNumber: string;
  } | null>(null);

  const loadReadings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await sanctuaireApi.get('/client/readings');
      setReadings(data.readings || []);
      setPending(data.pending || []);
    } catch {
      setError('Vos lectures ne sont pas accessibles pour le moment. Réessayez dans un instant.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReadings();
  }, [loadReadings]);

  const downloadPdf = async (reading: Reading) => {
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
    }
  };

  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-9 w-9 animate-spin text-horizon-300" />
      </div>
    );
  }

  const allReadings = [...pending, ...readings];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {selectedPdf && (
        <ReadingViewerModal
          isOpen
          onClose={() => setSelectedPdf(null)}
          pdfUrl={selectedPdf.url}
          title={selectedPdf.title}
          orderNumber={selectedPdf.orderNumber}
        />
      )}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-horizon-300">
            Sanctuaire Lumira
          </p>
          <h1 className="mt-2 font-playfair text-3xl italic text-stellar-100">Mes lectures</h1>
          <p className="mt-2 text-sm text-stellar-400">
            Vos lectures sont disponibles ici dès leur validation.
          </p>
        </div>
        <button
          type="button"
          onClick={loadReadings}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2 text-sm text-stellar-300 hover:bg-white/[0.05]"
        >
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {allReadings.length === 0 ? (
        <section className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 text-center sm:p-12">
          <Sparkles className="mx-auto h-8 w-8 text-horizon-300" />
          <h2 className="mt-4 font-playfair text-2xl italic text-stellar-100">
            Vos lectures apparaîtront ici
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stellar-400">
            Votre lecture sera ajoutée à cet espace dès que votre préparation aura été validée et
            que les éléments seront prêts.
          </p>
        </section>
      ) : (
        <div className="mt-8 space-y-4">
          {allReadings.map((reading) => {
            const status = statusCopy(reading.status);
            const pdfUrl = toBffAssetUrl(reading.assets.pdf);
            const audioUrl = toBffAssetUrl(reading.assets.audio);
            return (
              <article
                key={reading.id}
                className="rounded-3xl border border-white/[0.08] bg-abyss-600/50 p-5 sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-horizon-300" />
                      <h2 className="truncate text-lg font-medium text-stellar-100">
                        {reading.title}
                      </h2>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-stellar-400">
                      {reading.intention || status.description}
                    </p>
                    {reading.deliveredAt && (
                      <p className="mt-3 text-xs text-stellar-500">
                        Disponible depuis le{' '}
                        {new Date(reading.deliveredAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${status.tone}`}
                  >
                    {status.label}
                  </span>
                </div>

                {reading.status === 'COMPLETED' && (
                  <div className="mt-5 space-y-4">
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
                          <FileText className="h-4 w-4" /> Lire
                        </button>
                      )}
                      {pdfUrl && (
                        <button
                          type="button"
                          onClick={() => downloadPdf(reading)}
                          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-5 py-3 text-sm font-medium text-stellar-200 hover:bg-white/[0.05]"
                        >
                          <Download className="h-4 w-4" /> Télécharger le PDF
                        </button>
                      )}
                    </div>
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
