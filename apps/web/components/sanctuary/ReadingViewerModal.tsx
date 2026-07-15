'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  Minimize2,
  Loader2,
  FileText,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import sanctuaireApi from '@/lib/sanctuaireApi';
import axios from 'axios';

// Serve worker from public/ — reliable with Next.js + pnpm (keep in sync with pdfjs-dist)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export function extractOrderNumberFromPdfUrl(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/readings\/([^/]+)\/(download|file)/);
  return match?.[1] ?? null;
}

interface ReadingViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title?: string;
  orderNumber?: string;
}

export function ReadingViewerModal({
  isOpen,
  onClose,
  pdfUrl,
  title = 'Votre Lecture',
  orderNumber: orderNumberProp,
}: ReadingViewerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pageWidth, setPageWidth] = useState(600);
  const [reloadKey, setReloadKey] = useState(0);

  const orderNumber = useMemo(
    () => orderNumberProp || extractOrderNumberFromPdfUrl(pdfUrl),
    [orderNumberProp, pdfUrl],
  );

  const safeFilename = `${title.replace(/[^\w\-àâäéèêëïîôùûüç]+/gi, '_')}.pdf`;

  // Measure viewer width for responsive page sizing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isOpen) return;

    const update = () => {
      const w = el.clientWidth;
      // Leave side padding; clamp for readability
      setPageWidth(Math.max(280, Math.min(w - 24, 900)));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen, blobUrl]);

  // Fetch PDF as authenticated blob via BFF (/readings/:orderNumber/file)
  useEffect(() => {
    if (!isOpen) return;

    let revoked: string | null = null;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setPageNumber(1);
      setNumPages(0);
      setScale(1);
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

      try {
        let url: string;

        if (orderNumber) {
          const { data } = await sanctuaireApi.get(`/readings/${orderNumber}/file`, {
            responseType: 'blob',
          });

          let blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });

          // Detect JSON error payloads returned as blob (auth / not found)
          if (
            blob.type.includes('application/json') ||
            (blob.size < 512 && blob.type !== 'application/pdf')
          ) {
            const text = await blob.text();
            try {
              const json = JSON.parse(text) as { message?: string; error?: string };
              throw new Error(json.message || json.error || 'PDF non disponible');
            } catch (e) {
              if (!(e instanceof SyntaxError)) throw e;
              blob = new Blob([text], { type: 'application/pdf' });
            }
          }

          if (blob.type && blob.type !== 'application/pdf' && !blob.type.includes('octet-stream')) {
            blob = new Blob([blob], { type: 'application/pdf' });
          }

          url = URL.createObjectURL(blob);
        } else {
          // Fallback: absolute API URL (legacy)
          const absolute = pdfUrl.startsWith('/api/')
            ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${pdfUrl}`
            : pdfUrl;
          const res = await fetch(absolute, { credentials: 'include' });
          if (!res.ok) throw new Error('Impossible de charger le document');
          const blob = await res.blob();
          url = URL.createObjectURL(blob);
        }

        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        revoked = url;
        setBlobUrl(url);
      } catch (err) {
        console.error('PDF load failed:', err);
        if (!cancelled) {
          let message = 'Impossible de charger votre lecture. Réessayez.';
          if (axios.isAxiosError(err)) {
            const data = err.response?.data;
            if (data instanceof Blob) {
              try {
                const json = JSON.parse(await data.text()) as {
                  message?: string;
                  error?: string;
                };
                message = json.message || json.error || message;
              } catch {
                /* ignore parse errors */
              }
            } else if (data && typeof data === 'object' && ('message' in data || 'error' in data)) {
              const obj = data as { message?: string; error?: string };
              message = obj.message || obj.error || message;
            } else if (err.response?.status === 401) {
              message = 'Session expirée. Reconnectez-vous pour voir votre lecture.';
            } else if (err.response?.status === 404) {
              message = "PDF introuvable. Il n'est peut-être pas encore prêt.";
            }
          } else if (err instanceof Error && err.message) {
            message = err.message;
          }
          setError(message);
          setBlobUrl(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [isOpen, orderNumber, pdfUrl, reloadKey]);

  // Revoke blob on close
  useEffect(() => {
    if (!isOpen && blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
  }, [isOpen, blobUrl]);

  // ESC + body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => undefined);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        setPageNumber((p) => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight') {
        setPageNumber((p) => Math.min(numPages || p, p + 1));
      }
    };

    document.addEventListener('keydown', handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose, numPages]);

  // Track fullscreen changes
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const handleZoomIn = () => setScale((s) => Math.min(Number((s + 0.2).toFixed(2)), 2.5));
  const handleZoomOut = () => setScale((s) => Math.max(Number((s - 0.2).toFixed(2)), 0.5));

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen failed:', err);
    }
  }, []);

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

  const onDocumentLoadSuccess = ({ numPages: next }: { numPages: number }) => {
    setNumPages(next);
    setIsLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('react-pdf error:', err);
    setError('Le document PDF est illisible ou corrompu.');
    setIsLoading(false);
  };

  const zoomPercent = Math.round(scale * 100);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-5xl
                                   sm:m-4 flex flex-col bg-abyss-900 sm:rounded-2xl overflow-hidden
                                   shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center justify-between gap-2 px-3 sm:px-6 py-3
                                        bg-abyss-800/90 backdrop-blur-sm border-b border-white/10"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-horizon-400/20 flex-shrink-0">
                  <FileText className="w-5 h-5 text-horizon-400" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-white truncate">
                    {title}
                  </h2>
                  <p className="text-xs text-stellar-400">
                    {numPages > 0 ? `Page ${pageNumber} / ${numPages}` : 'Document PDF'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 min-w-[44px] min-h-[44px] rounded-lg bg-white/5 hover:bg-white/10
                                           text-stellar-400 hover:text-white transition-colors flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Viewer */}
            <div ref={scrollRef} className="flex-1 relative overflow-auto bg-abyss-950 min-h-0">
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-abyss-900/80">
                  <div className="text-center px-4">
                    <Loader2 className="w-10 h-10 text-horizon-400 animate-spin mx-auto mb-3" />
                    <p className="text-stellar-400 text-sm">Chargement de votre lecture...</p>
                  </div>
                </div>
              )}

              {error && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 px-4">
                  <div className="text-center max-w-sm">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-white font-medium mb-1">Impossible d&apos;afficher le PDF</p>
                    <p className="text-stellar-400 text-sm mb-4">{error}</p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        onClick={() => setReloadKey((k) => k + 1)}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px]
                                                           rounded-xl bg-horizon-400/20 text-horizon-400 text-sm font-medium
                                                           hover:bg-horizon-400/30 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Réessayer
                      </button>
                      {orderNumber && (
                        <a
                          href={`/api/bff/readings/${orderNumber}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px]
                                                               rounded-xl bg-white/5 text-stellar-300 text-sm
                                                               hover:bg-white/10 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Ouvrir ailleurs
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {blobUrl && !error && (
                <div className="flex flex-col items-center py-4 px-2 sm:px-4 min-h-full">
                  <Document
                    file={blobUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={null}
                    className="flex flex-col items-center"
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth * scale}
                      renderTextLayer
                      renderAnnotationLayer
                      className="shadow-2xl rounded-sm overflow-hidden bg-white"
                    />
                  </Document>
                </div>
              )}
            </div>

            {/* Bottom toolbar */}
            <div
              className="flex-shrink-0 border-t border-white/10 bg-abyss-800/95 backdrop-blur-xl
                                        px-2 sm:px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
            >
              <div className="flex items-center justify-between gap-1 sm:gap-2 max-w-3xl mx-auto">
                {/* Page nav */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <button
                    onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                    disabled={pageNumber <= 1 || !numPages}
                    className="p-2.5 min-w-[40px] min-h-[40px] rounded-lg hover:bg-white/10 text-stellar-300
                                                   hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                                                   flex items-center justify-center"
                    aria-label="Page précédente"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="hidden sm:inline px-2 text-xs font-mono text-stellar-400 min-w-[4.5rem] text-center">
                    {numPages ? `${pageNumber}/${numPages}` : '—'}
                  </span>
                  <button
                    onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
                    disabled={!numPages || pageNumber >= numPages}
                    className="p-2.5 min-w-[40px] min-h-[40px] rounded-lg hover:bg-white/10 text-stellar-300
                                                   hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                                                   flex items-center justify-center"
                    aria-label="Page suivante"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Zoom */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <button
                    onClick={handleZoomOut}
                    disabled={scale <= 0.5}
                    className="p-2.5 min-w-[40px] min-h-[40px] rounded-lg hover:bg-white/10 text-stellar-300
                                                   hover:text-white disabled:opacity-40 transition-colors flex items-center justify-center"
                    aria-label="Zoom arrière"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="px-2 py-1 rounded-lg bg-white/5 text-xs font-mono text-stellar-300 min-w-[48px] text-center">
                    {zoomPercent}%
                  </span>
                  <button
                    onClick={handleZoomIn}
                    disabled={scale >= 2.5}
                    className="p-2.5 min-w-[40px] min-h-[40px] rounded-lg hover:bg-white/10 text-stellar-300
                                                   hover:text-white disabled:opacity-40 transition-colors flex items-center justify-center"
                    aria-label="Zoom avant"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <button
                    onClick={toggleFullscreen}
                    className="hidden sm:flex p-2.5 min-w-[40px] min-h-[40px] rounded-lg hover:bg-white/10
                                                   text-stellar-300 hover:text-white transition-colors items-center justify-center"
                    aria-label={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleOpenExternal}
                    disabled={!blobUrl}
                    className="p-2.5 min-w-[40px] min-h-[40px] rounded-lg hover:bg-white/10 text-stellar-300
                                                   hover:text-white disabled:opacity-40 transition-colors flex items-center justify-center"
                    aria-label="Ouvrir dans un nouvel onglet"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={!blobUrl}
                    className="flex items-center gap-1.5 px-3 py-2.5 min-h-[40px] rounded-lg
                                                   bg-horizon-400/20 hover:bg-horizon-400/30 text-horizon-400
                                                   font-medium text-sm transition-colors disabled:opacity-40"
                    aria-label="Télécharger"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Télécharger</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
