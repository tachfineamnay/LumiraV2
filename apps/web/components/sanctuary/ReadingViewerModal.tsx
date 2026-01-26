'use client';

import React, { useState, useEffect } from 'react';
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
    ExternalLink
} from 'lucide-react';

interface ReadingViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string;
    title?: string;
}

export function ReadingViewerModal({ isOpen, onClose, pdfUrl, title = 'Votre Lecture' }: ReadingViewerModalProps) {
    const [zoom, setZoom] = useState(100);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = `${title.replace(/\s+/g, '_')}.pdf`;
        link.click();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex items-center justify-center"
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md"
                        onClick={onClose}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="relative w-full h-full max-w-6xl max-h-[90vh] m-4 flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-abyss-800/80 backdrop-blur-sm border-b border-white/10 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-horizon-400/20">
                                    <FileText className="w-5 h-5 text-horizon-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">{title}</h2>
                                    <p className="text-xs text-stellar-400">Document PDF</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-stellar-400 hover:text-white transition-colors"
                                aria-label="Fermer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* PDF Viewer */}
                        <div className="flex-1 bg-abyss-900 relative overflow-hidden">
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-abyss-900 z-10">
                                    <div className="text-center">
                                        <Loader2 className="w-10 h-10 text-horizon-400 animate-spin mx-auto mb-3" />
                                        <p className="text-stellar-400 text-sm">Chargement du document...</p>
                                    </div>
                                </div>
                            )}
                            <iframe
                                src={`${pdfUrl}#zoom=${zoom}&toolbar=0&navpanes=0`}
                                className="w-full h-full border-0"
                                style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                                onLoad={() => setIsLoading(false)}
                                title={title}
                            />
                        </div>

                        {/* Floating Control Bar */}
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-abyss-800/95 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl"
                            >
                                {/* Zoom Controls */}
                                <button
                                    onClick={handleZoomOut}
                                    disabled={zoom <= 50}
                                    className="p-2 rounded-lg hover:bg-white/10 text-stellar-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Zoom arrière"
                                    title="Zoom arrière"
                                >
                                    <ZoomOut className="w-4 h-4" />
                                </button>
                                <span className="px-3 py-1 rounded-lg bg-white/5 text-xs font-mono text-stellar-300 min-w-[50px] text-center">
                                    {zoom}%
                                </span>
                                <button
                                    onClick={handleZoomIn}
                                    disabled={zoom >= 200}
                                    className="p-2 rounded-lg hover:bg-white/10 text-stellar-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Zoom avant"
                                    title="Zoom avant"
                                >
                                    <ZoomIn className="w-4 h-4" />
                                </button>

                                <div className="w-px h-6 bg-white/10 mx-2" />

                                {/* Fullscreen */}
                                <button
                                    onClick={toggleFullscreen}
                                    className="p-2 rounded-lg hover:bg-white/10 text-stellar-300 hover:text-white transition-colors"
                                    aria-label={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
                                    title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
                                >
                                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                </button>

                                {/* Open in new tab */}
                                <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg hover:bg-white/10 text-stellar-300 hover:text-white transition-colors"
                                    aria-label="Ouvrir dans un nouvel onglet"
                                    title="Ouvrir dans un nouvel onglet"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>

                                <div className="w-px h-6 bg-white/10 mx-2" />

                                {/* Download */}
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-horizon-400/20 hover:bg-horizon-400/30 text-horizon-400 font-medium text-sm transition-colors"
                                    aria-label="Télécharger"
                                    title="Télécharger le PDF"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Télécharger</span>
                                </button>
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
