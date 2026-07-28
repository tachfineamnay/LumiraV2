'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import sanctuaireApi from '@/lib/sanctuaireApi';

export function extractOrderNumberFromPdfUrl(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/readings\/([^/]+)\/(download|file)/);
  return match?.[1] ?? null;
}

interface ReadingPdfViewerProps {
  orderNumber: string;
  title?: string;
  className?: string;
  closeHref?: string;
}

export function ReadingPdfViewer({
  orderNumber,
  title = 'Votre Lecture',
  className = '',
  closeHref,
}: ReadingPdfViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [visualViewportHeight, setVisualViewportHeight] = useState<number | null>(null);

  const safeFilename = `${title.replace(/[^\w\-àâäéèêëïîôùûüç]+/gi, '_')}.pdf`;

  useEffect(() => {
    const updateViewportHeight = () => {
      setVisualViewportHeight(Math.round(window.visualViewport?.height ?? window.innerHeight));
    };

    updateViewportHeight();
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('scroll', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
      window.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const main = root?.closest('main') as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousMainOverflowY = main?.style.overflowY;
    document.body.style.overflow = 'hidden';
    if (main) main.style.overflowY = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      if (main && previousMainOverflowY !== undefined) main.style.overflowY = previousMainOverflowY;
    };
  }, []);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setPageNumber(1);
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
        setIsLoading(false);
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
  const goToPage = (nextPage: number) => {
    setPageNumber(nextPage);
    scrollRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

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

  const viewerStyle = useMemo(
    () =>
      ({
        '--reading-viewer-mobile-h': visualViewportHeight ? `${visualViewportHeight}px` : '100dvh',
        height:
          'max(22rem, calc(var(--reading-viewer-mobile-h) - var(--sanctuaire-header-h) - var(--sanctuaire-bottom-nav-h) - 0.75rem))',
      }) as React.CSSProperties,
    [visualViewportHeight],
  );
  const viewerUrl = blobUrl
    ? `${blobUrl}#page=${pageNumber}&zoom=${Math.round(scale * 100)}`
    : null;

  return (
    <div
      ref={rootRef}
      data-testid="reading-pdf-viewer"
      style={viewerStyle}
      className={`flex max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[rgba(90,148,205,0.18)] bg-[#E4EFF8] ${className}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgba(90,148,205,0.14)] bg-[rgba(242,250,255,0.96)] px-3 py-2.5 backdrop-blur-xl sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#8a6820]/10 text-[#8a6820]">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-playfair text-lg italic text-[#0d1f35] sm:text-2xl">
              {title}
            </h1>
            <p className="text-xs text-[#385c7a]">
              {blobUrl ? `Page ${pageNumber}` : 'Document PDF'}
            </p>
          </div>
        </div>

        {closeHref && (
          <Link
            href={closeHref}
            aria-label="Fermer le PDF"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#385c7a] hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5a94cd]"
          >
            <X className="h-5 w-5" />
          </Link>
        )}
      </div>

      <div
        ref={scrollRef}
        data-testid="reading-pdf-scroll"
        className="relative min-h-0 flex-1 overflow-auto bg-[#D8E9F4]"
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgba(232,245,252,0.85)] backdrop-blur-sm">
            <div className="px-4 text-center">
              <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-[#8a6820]" />
              <p className="text-sm text-[#385c7a]">Chargement de votre lecture...</p>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex min-h-[50vh] items-center justify-center px-4">
            <div className="max-w-sm text-center">
              <AlertCircle className="mx-auto mb-3 h-12 w-12 text-rose-400" />
              <p className="mb-1 font-medium text-[#0d1f35]">Impossible d&apos;afficher le PDF</p>
              <p className="mb-4 text-sm text-[#385c7a]">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[rgba(90,148,205,0.22)] bg-white/70 px-4 py-2.5 text-sm font-medium text-[#385c7a] hover:bg-white/90"
              >
                <RefreshCw className="h-4 w-4" />
                Réessayer
              </button>
            </div>
          </div>
        )}

        {viewerUrl && !error && (
          <iframe
            key={viewerUrl}
            title={title}
            src={viewerUrl}
            className="h-full w-full border-0 bg-white"
            onLoad={() => setIsLoading(false)}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-[rgba(90,148,205,0.14)] bg-[rgba(242,250,255,0.96)] px-2 py-2 [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-3">
          <div className="flex min-w-0 items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => goToPage(Math.max(1, pageNumber - 1))}
              disabled={pageNumber <= 1 || !blobUrl}
              className="grid h-10 w-10 place-items-center rounded-lg text-[#385c7a] hover:bg-white/70 disabled:opacity-40"
              aria-label="Page précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-[#385c7a]">
              {blobUrl ? `Page ${pageNumber}` : 'PDF'}
            </span>
            <button
              type="button"
              onClick={() => goToPage(pageNumber + 1)}
              disabled={!blobUrl}
              className="grid h-10 w-10 place-items-center rounded-lg text-[#385c7a] hover:bg-white/70 disabled:opacity-40"
              aria-label="Page suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-1">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 0.7}
              className="grid h-10 w-10 place-items-center rounded-lg text-[#385c7a] hover:bg-white/70 disabled:opacity-40"
              aria-label="Zoom arrière"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-xs tabular-nums text-[#385c7a]">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 2.2}
              className="grid h-10 w-10 place-items-center rounded-lg text-[#385c7a] hover:bg-white/70 disabled:opacity-40"
              aria-label="Zoom avant"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-w-0 items-center justify-center gap-1 min-[360px]:col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!blobUrl}
              className="grid h-10 w-10 place-items-center rounded-lg text-[#385c7a] hover:bg-white/70 disabled:opacity-40"
              aria-label="Télécharger"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleOpenExternal}
              disabled={!blobUrl}
              className="grid h-10 w-10 place-items-center rounded-lg text-[#385c7a] hover:bg-white/70 disabled:opacity-40"
              aria-label="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
