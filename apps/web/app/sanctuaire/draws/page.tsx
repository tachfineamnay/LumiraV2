'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    FileText,
    Calendar,
    Clock,
    Sparkles,
    Lock,
    Loader2,
    ChevronRight,
    Eye,
    Plus,
    Hash,
    Download,
    Headphones
} from 'lucide-react';
import { useSanctuaire } from '../../../context/SanctuaireContext';
import { ReadingViewerModal } from '../../../components/sanctuary/ReadingViewerModal';
import { MysticAudioPlayer } from '../../../components/ui/MysticAudioPlayer';

// =============================================================================
// TYPES
// =============================================================================

interface Reading {
    id: string;
    orderNumber: string;
    level: number;
    status?: 'COMPLETED' | 'PENDING' | 'PROCESSING' | 'AWAITING_VALIDATION' | 'PAID';
    deliveredAt: string | null;
    createdAt: string;
    archetype: string | null;
    title: string;
    intention?: string;
    keywords?: string[];
    inProgress?: boolean;
    assets: {
        pdf?: string;
        audio?: string;
    };
}

interface DrawType {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    available: boolean;
    comingSoon?: boolean;
}

// =============================================================================
// DRAW TYPES
// =============================================================================

const DRAW_TYPES: DrawType[] = [
    {
        id: 'soul-reading',
        name: 'Lecture d\'Âme',
        description: 'Votre guidance spirituelle complète',
        icon: <Sparkles className="w-5 h-5" />,
        available: true,
    },
    {
        id: 'energy-reading',
        name: 'Tirage Énergétique',
        description: 'État de vos énergies actuelles',
        icon: <Eye className="w-5 h-5" />,
        available: false,
        comingSoon: true,
    },
    {
        id: 'karmic-reading',
        name: 'Analyse Karmique',
        description: 'Exploration de vos vies passées',
        icon: <Clock className="w-5 h-5" />,
        available: false,
        comingSoon: true,
    },
    {
        id: 'mission-reading',
        name: 'Mission de Vie',
        description: 'Découvrez votre purpose',
        icon: <Hash className="w-5 h-5" />,
        available: false,
        comingSoon: true,
    },
];

// =============================================================================
// DRAW CARD COMPONENT
// =============================================================================

function DrawCard({ draw }: { draw: DrawType }) {
    return (
        <motion.div
            whileHover={draw.available ? { scale: 1.02 } : undefined}
            className={`relative p-5 rounded-2xl border transition-all ${
                draw.available
                    ? 'bg-abyss-700/50 border-white/10 hover:border-horizon-400/30 cursor-pointer'
                    : 'bg-abyss-800/30 border-white/5'
            }`}
        >
            {/* Coming Soon Badge */}
            {draw.comingSoon && (
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-serenity-500/20 text-serenity-300 text-[10px] font-medium uppercase tracking-wider">
                    Bientôt
                </span>
            )}

            <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                    draw.available
                        ? 'bg-horizon-400/20 text-horizon-400'
                        : 'bg-white/5 text-stellar-500'
                }`}>
                    {draw.available ? draw.icon : <Lock className="w-5 h-5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold mb-1 ${draw.available ? 'text-white' : 'text-stellar-500'}`}>
                        {draw.name}
                    </h3>
                    <p className="text-xs text-stellar-500 line-clamp-2">
                        {draw.description}
                    </p>
                </div>
            </div>

            {/* Action */}
            {draw.available && (
                <Link href="/commande">
                    <button className="mt-4 w-full py-2.5 rounded-xl bg-horizon-400/10 hover:bg-horizon-400/20 text-horizon-400 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                        Lancer
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </Link>
            )}
        </motion.div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DrawsPage() {
    const { highestLevel, isLoading: contextLoading } = useSanctuaire();
    const [readings, setReadings] = useState<Reading[]>([]);
    const [pendingReadings, setPendingReadings] = useState<Reading[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedPdf, setSelectedPdf] = useState<{ url: string; title: string } | null>(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    // Helper to resolve PDF URLs (convert relative API URLs to absolute)
    const resolvePdfUrl = useCallback((url: string | null | undefined): string | null => {
        if (!url) return null;
        if (url.startsWith('/api/')) {
            return `${apiUrl}${url}`;
        }
        return url;
    }, [apiUrl]);

    // Fetch user's readings
    const fetchReadings = useCallback(async () => {
        const token = localStorage.getItem('sanctuaire_token');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${apiUrl}/api/client/readings`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setReadings(data.readings || []);
                setPendingReadings(data.pending || []);
            }
        } catch (error) {
            console.error('Failed to fetch readings:', error);
        } finally {
            setLoading(false);
        }
    }, [apiUrl]);

    useEffect(() => {
        fetchReadings();
    }, [fetchReadings]);

    const openPdfViewer = (pdfUrl: string, title: string) => {
        setSelectedPdf({ url: pdfUrl, title });
        setViewerOpen(true);
    };

    const closePdfViewer = () => {
        setViewerOpen(false);
        setSelectedPdf(null);
    };

    // Get the latest reading (completed or pending)
    const latestReading = readings[0];
    const latestPending = pendingReadings[0];
    const currentMonth = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    if (contextLoading || loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-horizon-400 animate-spin mx-auto mb-3" />
                    <p className="text-stellar-400 text-sm">Chargement de vos révélations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            {/* PDF Viewer Modal */}
            {selectedPdf && (
                <ReadingViewerModal
                    isOpen={viewerOpen}
                    onClose={closePdfViewer}
                    pdfUrl={selectedPdf.url}
                    title={selectedPdf.title}
                />
            )}

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-10"
            >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-serif italic text-white mb-1">
                            Mes Révélations
                        </h1>
                        <p className="text-stellar-400 text-sm">
                            Accédez à vos lectures et tirages personnalisés
                        </p>
                    </div>
                    {!latestPending && (
                        <Link href="/commande">
                            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-horizon-400 text-abyss-900 font-semibold text-sm hover:bg-horizon-300 transition-colors">
                                <Plus className="w-4 h-4" />
                                Nouvelle Lecture
                            </button>
                        </Link>
                    )}
                </div>
            </motion.div>

            {/* BANNIÈRE INFORMATIVE - Lecture en cours ou disponible */}
            {latestPending && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3"
                >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">
                            Lecture en cours de préparation
                        </p>
                        <p className="text-xs text-stellar-400">
                            Disponible sous 24-48h • <span className="font-mono text-amber-400/80">#{latestPending.orderNumber}</span>
                        </p>
                    </div>
                </motion.div>
            )}

            {/* BANNIÈRE - Lecture disponible */}
            {latestReading && latestReading.assets.pdf && !latestPending && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3"
                >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">
                            Votre lecture est disponible
                        </p>
                        <p className="text-xs text-stellar-400">
                            Consultez votre PDF, chemin de vie et synthèses ci-dessous
                        </p>
                    </div>
                    <button
                        onClick={() => openPdfViewer(latestReading.assets.pdf!, latestReading.title)}
                        className="flex-shrink-0 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                    >
                        Consulter
                    </button>
                </motion.div>
            )}

            {/* MA LECTURE - Main Reading Section */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-10"
            >
                <h2 className="text-xs font-bold text-stellar-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Ma Lecture
                </h2>

                {latestReading ? (
                    <div className="p-6 rounded-2xl bg-abyss-700/30 border border-white/10 backdrop-blur-sm">
                        {/* Top: Title & Date */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-xl font-semibold text-white mb-1">
                                    Guidance de {currentMonth}
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-stellar-400">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {latestReading.deliveredAt
                                            ? new Date(latestReading.deliveredAt).toLocaleDateString('fr-FR', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric'
                                            })
                                            : 'En cours de préparation'
                                        }
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-horizon-400/20 text-horizon-400 font-medium">
                                        #{latestReading.orderNumber}
                                    </span>
                                </div>
                            </div>
                            {latestReading.archetype && (
                                <span className="px-3 py-1.5 rounded-full bg-serenity-500/20 text-serenity-300 text-xs font-medium">
                                    {latestReading.archetype}
                                </span>
                            )}
                        </div>

                        {/* Middle: Intention & Keywords */}
                        <div className="mb-6 p-4 rounded-xl bg-abyss-800/50 border border-white/5">
                            <p className="text-stellar-300 text-sm leading-relaxed line-clamp-3">
                                {latestReading.intention || 'Votre lecture spirituelle personnalisée est prête. Découvrez les messages de l\'Oracle concernant votre chemin de vie et votre évolution spirituelle.'}
                            </p>
                            {latestReading.keywords && latestReading.keywords.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {latestReading.keywords.map((keyword, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-0.5 rounded-full bg-white/5 text-stellar-400 text-xs"
                                        >
                                            {keyword}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Bottom: Audio Player & Action */}
                        <div className="space-y-4">
                            {/* Audio Player */}
                            {highestLevel >= 2 && (
                                <MysticAudioPlayer audioUrl={latestReading.assets.audio} />
                            )}

                            {/* Action Button */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                {latestReading.assets.pdf ? (
                                    <button
                                        onClick={() => openPdfViewer(latestReading.assets.pdf!, latestReading.title)}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-horizon-400 text-abyss-900 font-semibold hover:bg-horizon-300 transition-all hover:shadow-lg hover:shadow-horizon-400/20"
                                    >
                                        <Eye className="w-5 h-5" />
                                        Ouvrir le Dossier
                                    </button>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 text-stellar-500">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Préparation en cours...
                                    </div>
                                )}

                                {latestReading.assets.pdf && (
                                    <a
                                        href={resolvePdfUrl(latestReading.assets.pdf) || '#'}
                                        download
                                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-stellar-300 transition-colors"
                                    >
                                        <Download className="w-5 h-5" />
                                        <span className="sm:hidden">Télécharger</span>
                                    </a>
                                )}

                                {highestLevel >= 2 && latestReading.assets.audio && (
                                    <a
                                        href={latestReading.assets.audio}
                                        download
                                        title="Télécharger l'audio"
                                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-stellar-300 transition-colors"
                                    >
                                        <Headphones className="w-5 h-5" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 rounded-2xl bg-abyss-700/30 border border-white/10 text-center">
                        <div className="w-16 h-16 rounded-full bg-horizon-400/10 flex items-center justify-center mx-auto mb-4">
                            <FileText className="w-8 h-8 text-horizon-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">
                            Aucune lecture disponible
                        </h3>
                        <p className="text-stellar-400 text-sm mb-4">
                            Commencez votre voyage spirituel avec votre première lecture
                        </p>
                        <Link href="/commande">
                            <button className="px-6 py-2.5 rounded-xl bg-horizon-400 text-abyss-900 font-semibold text-sm hover:bg-horizon-300 transition-colors">
                                Commander ma première lecture
                            </button>
                        </Link>
                    </div>
                )}
            </motion.section>

            {/* MES TIRAGES - Draw Types Section */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <h2 className="text-xs font-bold text-stellar-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Mes Tirages
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {DRAW_TYPES.map((draw) => (
                        <DrawCard key={draw.id} draw={draw} />
                    ))}
                </div>
            </motion.section>

            {/* Previous Readings History */}
            {readings.length > 1 && (
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-10"
                >
                    <h2 className="text-xs font-bold text-stellar-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Historique
                    </h2>

                    <div className="space-y-3">
                        {readings.slice(1).map((reading) => (
                            <div
                                key={reading.id}
                                className="flex items-center justify-between p-4 rounded-xl bg-abyss-800/30 border border-white/5 hover:border-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-stellar-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">{reading.title}</p>
                                        <p className="text-xs text-stellar-500">
                                            {reading.deliveredAt
                                                ? new Date(reading.deliveredAt).toLocaleDateString('fr-FR')
                                                : 'En cours'
                                            }
                                        </p>
                                    </div>
                                </div>
                                {reading.assets.pdf && (
                                    <button
                                        onClick={() => openPdfViewer(reading.assets.pdf!, reading.title)}
                                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-stellar-300 text-sm transition-colors"
                                    >
                                        Lire
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </motion.section>
            )}
        </div>
    );
}
