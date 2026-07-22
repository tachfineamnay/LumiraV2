'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import sanctuaireApi from '@/lib/sanctuaireApi';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export function extractOrderNumberFromPdfUrl(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/readings\/([^/]+)\/(download|file)/);
  return match?.[1] ?? null;
}

interface ReadingPdfViewerProps {
  orderNumber: string;
  title?: string;
  className?: string;
}

export function ReadingPdfViewer({
  orderNumber,
  title = 'Votre Lecture',
  className = '',
}: ReadingPdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(720);
  const [reloadKey, setReloadKey] = useState(0);

  const safeFilename = `${title.replace(/[^\w\-àâäéèêëïîôùûüç]+/gi, '_')}.pdf`;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      setPageWidth(Math.max(280, Math.min(w - 32, 900)));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [blobUrl]);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setNumPages(0);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      try {
        const { data } = await sanctuaireApi.get(`/readings/${orderNumber}/file`, {
          responseType: 'blob',
        });
        if (cancelled) return;
        const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
        revoked = url;
        setBlobUrl(url);
      } catch {
        if (!cancelled) {
          setError('Impossible de charger votre lecture pour le moment.');
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [orderNumber, reloadKey]);

  const handleZoomIn = () => setScale((s) => Math.min(Number((s + 0.15).toFixed(2)), 2.2));
  const handleZoomOut = () => setScale((s) => Math.max(Number((s - 0.15).toFixed(2)), 0.7));

  const handleDownload = useCallback(() => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = safeFilename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [blobUrl, safeFilename]);

  const handleOpenExternal = useCallback(() => {
    if (!blobUrl) return;
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  }, [blobUrl]);

  const pages = useMemo(
    () => (numPages > 0 ? Array.from({ length: numPages }, (_, i) => i + 1) : []),
    [numPages],
  );

  return (
    <div
      className={`flex min-h-[70vh] flex-col overflow-hidden rounded-[1.75rem] border border-paper-line bg-paper text-paper-ink shadow-paper ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-paper-line bg-paper-elevated/95 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-horizon-400/20 text-horizon-600">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-playfair text-xl italic text-paper-ink sm:text-2xl">
              {title}
            </h1>
            <p className="text-xs text-paper-subtle">
              {numPages > 0 ? `${numPages} page${numPages > 1 ? 's' : ''}` : 'Document PDF'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.7}
            className="grid h-10 w-10 place-items-center rounded-lg text-paper-soft hover:bg-paper-muted disabled:opacity-40"
            aria-label="Zoom arrière"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-paper-subtle">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 2.2}
            className="grid h-10 w-10 place-items-center rounded-lg text-paper-soft hover:bg-paper-muted disabled:opacity-40"
            aria-label="Zoom avant"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!blobUrl}
            className="ml-1 grid h-10 w-10 place-items-center rounded-lg text-paper-soft hover:bg-paper-muted disabled:opacity-40"
            aria-label="Télécharger"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleOpenExternal}
            disabled={!blobUrl}
            className="grid h-10 w-10 place-items-center rounded-lg text-paper-soft hover:bg-paper-muted disabled:opacity-40"
            aria-label="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto bg-paper-muted/60">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper/80">
            <div className="px-4 text-center">
              <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-horizon-500" />
              <p className="text-sm text-paper-subtle">Chargement de votre lecture...</p>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex min-h-[50vh] items-center justify-center px-4">
            <div className="max-w-sm text-center">
              <AlertCircle className="mx-auto mb-3 h-12 w-12 text-rose-500" />
              <p className="mb-1 font-medium text-paper-ink">Impossible d&apos;afficher le PDF</p>
              <p className="mb-4 text-sm text-paper-subtle">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-horizon-400 px-4 py-2.5 text-sm font-medium text-abyss-900 hover:bg-horizon-300"
              >
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </button>
            </div>
          </div>
        )}

        {blobUrl && !error && (
          <div className="flex flex-col items-center gap-6 px-3 py-6 sm:px-6 sm:py-8">
            <Document
              file={blobUrl}
              onLoadSuccess={({ numPages: next }) => {
                setNumPages(next);
                setIsLoading(false);
                setError(null);
              }}
              onLoadError={() => {
                setError('Le document PDF est illisible ou corrompu.');
                setIsLoading(false);
              }}
              loading={null}
              className="flex w-full flex-col items-center gap-6"
            >
              {pages.map((pageNumber) => (
                <Page
                  key={pageNumber}
                  pageNumber={pageNumber}
                  width={pageWidth * scale}
                  renderTextLayer
                  renderAnnotationLayer
                  className="overflow-hidden rounded-sm bg-white shadow-paper"
                />
              ))}
            </Document>
          </div>
        )}
      </div>
    </div>
  );
}
