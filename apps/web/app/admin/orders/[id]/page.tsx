'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    FileText,
    User,
    Calendar,
    Hash,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Sparkles,
    Play,
    MapPin,
    HelpCircle,
    Target,
    ImageIcon,
} from 'lucide-react';
import { StudioLayout } from '../../../../components/admin/studio';

interface UserProfile {
    birthDate?: string;
    birthTime?: string;
    birthPlace?: string;
    specificQuestion?: string;
    objective?: string;
    facePhotoUrl?: string;
    palmPhotoUrl?: string;
    highs?: string;
    lows?: string;
    strongSide?: string;
    weakSide?: string;
    strongZone?: string;
    weakZone?: string;
    deliveryStyle?: string;
    pace?: number;
    ailments?: string;
    fears?: string;
    rituals?: string;
}

interface OrderDetail {
    id: string;
    orderNumber: string;
    userName: string | null;
    userEmail: string;
    level: number;
    amount: number;
    status: string;
    createdAt: string;
    expertPrompt?: string;
    formData?: Record<string, unknown>;
    generatedContent?: {
        lecture?: string;
        pdf_content?: unknown;
        synthesis?: {
            archetype?: string;
            keywords?: string[];
            emotional_state?: string;
            key_blockage?: string;
        };
        generatedAt?: string;
    };
    user?: {
        id?: string;
        refId?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        profile?: UserProfile;
    };
}

type StudioPhase = 'context' | 'generating' | 'review';

export default function OrderStudioPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = params.id as string;

    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [phase, setPhase] = useState<StudioPhase>('context');
    const [expertInstructions, setExpertInstructions] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const getToken = () => localStorage.getItem('expert_token');

    const fetchOrder = useCallback(async () => {
        const token = getToken();
        if (!token) {
            router.push('/admin');
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                throw new Error('Commande non trouvée');
            }

            const data = await res.json();
            setOrder(data);

            // Determine initial phase based on order status
            if (data.status === 'AWAITING_VALIDATION' || data.status === 'COMPLETED') {
                setPhase('review');
            } else if (data.generatedContent?.lecture) {
                setPhase('review');
            } else {
                setPhase('context');
            }

            // Load saved instructions if any
            if (data.expertPrompt) {
                setExpertInstructions(data.expertPrompt);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur de chargement');
            toast.error('Impossible de charger la commande');
        } finally {
            setLoading(false);
        }
    }, [orderId, apiUrl, router]);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    // Handle AI generation
    const handleGenerate = async () => {
        const token = getToken();
        if (!token || !order) return;

        setIsGenerating(true);
        setPhase('generating');
        setGenerationProgress(0);

        const progressInterval = setInterval(() => {
            setGenerationProgress(prev => Math.min(prev + Math.random() * 15, 90));
        }, 1000);

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}/generate-full`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    expertPrompt: expertInstructions || undefined,
                }),
            });

            clearInterval(progressInterval);
            setGenerationProgress(100);

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || 'Erreur lors de la génération');
            }

            toast.success('Génération terminée !', {
                description: 'La lecture est prête pour validation.',
            });

            await fetchOrder();
            setPhase('review');
        } catch (err) {
            clearInterval(progressInterval);
            toast.error('Échec de la génération', {
                description: err instanceof Error ? err.message : 'Veuillez réessayer',
            });
            setPhase('context');
        } finally {
            setIsGenerating(false);
        }
    };

    // Handle AI request for content refinement
    const handleAIRequest = async (instruction: string, currentContent: string): Promise<string> => {
        const token = getToken();

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}/refine`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ instruction, currentContent }),
            });

            if (!res.ok) throw new Error('Erreur lors du raffinement');

            const data = await res.json();

            if (data.updatedContent) {
                return `${data.message}\n\n---CONTENT_UPDATE---\n${data.updatedContent}`;
            }

            return data.message || "J'ai bien reçu votre demande. Le contenu a été mis à jour.";
        } catch (err) {
            console.error('AI request failed:', err);
            throw err;
        }
    };

    // Handle sealing/validating the order
    const handleSeal = async (finalContent: string) => {
        const token = getToken();

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}/finalize`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ finalContent }),
            });

            if (!res.ok) throw new Error('Échec de la validation');

            toast.success('Lecture scellée avec succès !', {
                description: 'Le client a été notifié par email et notification.',
            });

            setTimeout(() => router.push('/admin'), 1500);
        } catch (err) {
            toast.error('Erreur lors du scellement', {
                description: err instanceof Error ? err.message : 'Veuillez réessayer',
            });
            throw err;
        }
    };

    const getInitialContent = (): string => {
        if (!order) return '';
        return order.generatedContent?.lecture || '';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-void flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto mb-4" />
                    <p className="text-divine/60">Chargement du Studio...</p>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-void flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-divine mb-2">Commande introuvable</h2>
                    <p className="text-divine/60 mb-6">{error || 'Cette commande n\'existe pas.'}</p>
                    <button onClick={() => router.push('/admin')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 text-gold hover:bg-gold/30">
                        <ArrowLeft className="w-4 h-4" /> Retour
                    </button>
                </motion.div>
            </div>
        );
    }

    const clientName = order.user?.firstName ? `${order.user.firstName} ${order.user.lastName || ''}` : order.userName || order.userEmail;
    const profile = order.user?.profile;

    const getStatusBadge = (status: string) => {
        const cfg: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
            PENDING: { color: 'bg-amber-500/20 text-amber-400', icon: <Clock className="w-3.5 h-3.5" />, label: 'En attente' },
            PAID: { color: 'bg-amber-500/20 text-amber-400', icon: <Clock className="w-3.5 h-3.5" />, label: 'Payé' },
            PROCESSING: { color: 'bg-blue-500/20 text-blue-400', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: 'En cours' },
            AWAITING_VALIDATION: { color: 'bg-purple-500/20 text-purple-400', icon: <FileText className="w-3.5 h-3.5" />, label: 'À valider' },
            COMPLETED: { color: 'bg-emerald-500/20 text-emerald-400', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Terminée' },
        };
        const c = cfg[status] || cfg.PENDING;
        return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.color}`}>{c.icon}{c.label}</span>;
    };

    return (
        <div className="min-h-screen bg-void">
            <Toaster position="top-right" richColors />

            <header className="border-b border-gold/20 bg-void-dark/50 backdrop-blur-sm sticky top-0 z-40">
                <div className="max-w-[1800px] mx-auto px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/admin')} className="p-2 rounded-lg text-divine/60 hover:text-divine hover:bg-gold/10" title="Retour">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-gold/20 to-amber-500/20">
                                    <FileText className="w-5 h-5 text-gold" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="font-semibold text-divine">{order.orderNumber}</h1>
                                        {getStatusBadge(order.status)}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-divine/50">
                                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{clientName}</span>
                                        {order.user?.refId && <span className="flex items-center gap-1 font-mono"><Hash className="w-3 h-3" />{order.user.refId}</span>}
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${phase === 'context' ? 'bg-amber-400' : 'bg-amber-400/30'}`} />
                                <div className={`w-2 h-2 rounded-full ${phase === 'generating' ? 'bg-blue-400 animate-pulse' : phase === 'review' ? 'bg-blue-400' : 'bg-blue-400/30'}`} />
                                <div className={`w-2 h-2 rounded-full ${phase === 'review' ? 'bg-emerald-400' : 'bg-emerald-400/30'}`} />
                            </div>
                            <span className="px-3 py-1 rounded-full bg-gold/20 text-gold text-sm font-medium">
                                {order.level === 1 && 'Initié'}{order.level === 2 && 'Mystique'}{order.level === 3 && 'Profond'}{order.level === 4 && 'Intégral'}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1800px] mx-auto p-4">
                <AnimatePresence mode="wait">
                    {phase === 'context' && (
                        <motion.div key="context" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="bg-void-dark rounded-xl border border-gold/20 p-6">
                                    <h2 className="text-lg font-semibold text-divine mb-4 flex items-center gap-2">
                                        <User className="w-5 h-5 text-gold" /> Contexte Client
                                    </h2>
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="space-y-2">
                                            <label className="text-xs text-divine/50 uppercase tracking-wider">Naissance</label>
                                            <div className="p-3 rounded-lg bg-void border border-gold/10">
                                                <p className="text-divine font-medium">{profile?.birthDate || 'Non renseigné'}</p>
                                                {profile?.birthTime && <p className="text-sm text-divine/60">{profile.birthTime}</p>}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs text-divine/50 uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3" /> Lieu</label>
                                            <div className="p-3 rounded-lg bg-void border border-gold/10">
                                                <p className="text-divine">{profile?.birthPlace || 'Non renseigné'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    {profile?.specificQuestion && (
                                        <div className="mb-4">
                                            <label className="text-xs text-divine/50 uppercase tracking-wider flex items-center gap-1 mb-2"><HelpCircle className="w-3 h-3" /> Question Spécifique</label>
                                            <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                                <p className="text-divine italic">&quot;{profile.specificQuestion}&quot;</p>
                                            </div>
                                        </div>
                                    )}
                                    {profile?.objective && (
                                        <div className="mb-4">
                                            <label className="text-xs text-divine/50 uppercase tracking-wider flex items-center gap-1 mb-2"><Target className="w-3 h-3" /> Objectif</label>
                                            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                <p className="text-divine">{profile.objective}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        {profile?.highs && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Moments de grâce</label>
                                                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                                    <p className="text-sm text-divine/80">{profile.highs}</p>
                                                </div>
                                            </div>
                                        )}
                                        {profile?.lows && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Épreuves</label>
                                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                                    <p className="text-sm text-divine/80">{profile.lows}</p>
                                                </div>
                                            </div>
                                        )}
                                        {profile?.fears && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Peurs</label>
                                                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                                    <p className="text-sm text-divine/80">{profile.fears}</p>
                                                </div>
                                            </div>
                                        )}
                                        {profile?.ailments && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Maux physiques</label>
                                                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                                    <p className="text-sm text-divine/80">{profile.ailments}</p>
                                                </div>
                                            </div>
                                        )}
                                        {profile?.strongSide && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Côté dominant</label>
                                                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                                                    <p className="text-sm text-divine/80">{profile.strongSide}</p>
                                                </div>
                                            </div>
                                        )}
                                        {profile?.weakSide && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Côté faible</label>
                                                <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/20">
                                                    <p className="text-sm text-divine/80">{profile.weakSide}</p>
                                                </div>
                                            </div>
                                        )}
                                        {profile?.strongZone && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Zone corporelle forte</label>
                                                <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                                                    <p className="text-sm text-divine/80">{profile.strongZone}</p>
                                                </div>
                                            </div>
                                        )}
                                        {profile?.weakZone && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Zone corporelle faible</label>
                                                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                    <p className="text-sm text-divine/80">{profile.weakZone}</p>
                                                </div>
                                            </div>
                                        )}
                                        {profile?.rituals && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Rituels actuels</label>
                                                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                                    <p className="text-sm text-divine/80">{profile.rituals}</p>
                                                </div>
                                            </div>
                                        )}
                                        {profile?.deliveryStyle && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Style préféré</label>
                                                <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                                                    <p className="text-sm text-divine/80">{profile.deliveryStyle}</p>
                                                </div>
                                            </div>
                                        )}
                                        {profile?.pace !== undefined && profile.pace !== null && (
                                            <div>
                                                <label className="text-xs text-divine/50 uppercase tracking-wider mb-2 block">Rythme</label>
                                                <div className="p-3 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20">
                                                    <p className="text-sm text-divine/80">{profile.pace}/100</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {(profile?.facePhotoUrl || profile?.palmPhotoUrl) && (
                                        <div className="mt-4">
                                            <label className="text-xs text-divine/50 uppercase tracking-wider flex items-center gap-1 mb-2"><ImageIcon className="w-3 h-3" /> Photos</label>
                                            <div className="flex gap-4">
                                                {profile.facePhotoUrl && <div className="w-24 h-24 rounded-lg bg-void border border-gold/20 overflow-hidden"><img src={profile.facePhotoUrl} alt="Visage" className="w-full h-full object-cover" /></div>}
                                                {profile.palmPhotoUrl && <div className="w-24 h-24 rounded-lg bg-void border border-gold/20 overflow-hidden"><img src={profile.palmPhotoUrl} alt="Paume" className="w-full h-full object-cover" /></div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-void-dark rounded-xl border border-gold/20 p-6 sticky top-24">
                                    <h2 className="text-lg font-semibold text-divine mb-4 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-gold" /> Instructions pour l&apos;IA
                                    </h2>
                                    <p className="text-sm text-divine/60 mb-4">Donnez des indications pour personnaliser la lecture (optionnel).</p>
                                    <textarea
                                        value={expertInstructions}
                                        onChange={(e) => setExpertInstructions(e.target.value)}
                                        placeholder="Ex: Insiste sur les relations familiales, adopte un ton plus doux..."
                                        className="w-full h-40 p-4 rounded-lg bg-void border border-gold/20 text-divine placeholder-divine/30 resize-none focus:outline-none focus:border-gold/40"
                                    />
                                    <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                        <p className="text-xs text-amber-400">💡 L&apos;IA utilisera ces instructions + données client.</p>
                                    </div>
                                    <button onClick={handleGenerate} disabled={isGenerating} className="w-full mt-6 py-4 rounded-xl bg-gradient-to-r from-gold to-amber-500 text-void font-bold hover:from-gold/90 hover:to-amber-500/90 flex items-center justify-center gap-2 disabled:opacity-50">
                                        <Play className="w-5 h-5" /> Lancer la Génération IA
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {phase === 'generating' && (
                        <motion.div key="generating" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center justify-center min-h-[60vh]">
                            <div className="text-center max-w-md">
                                <div className="relative w-32 h-32 mx-auto mb-8">
                                    <div className="absolute inset-0 rounded-full border-4 border-gold/20" />
                                    <motion.div className="absolute inset-0 rounded-full border-4 border-gold border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} />
                                    <div className="absolute inset-4 rounded-full bg-gold/10 flex items-center justify-center">
                                        <Sparkles className="w-12 h-12 text-gold animate-pulse" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-divine mb-2">Génération en cours...</h2>
                                <p className="text-divine/60 mb-6">L&apos;Oracle compose la lecture pour {clientName}</p>
                                <div className="w-full h-2 rounded-full bg-void-dark overflow-hidden">
                                    <motion.div className="h-full bg-gradient-to-r from-gold to-amber-500" initial={{ width: 0 }} animate={{ width: `${generationProgress}%` }} />
                                </div>
                                <p className="text-sm text-divine/40 mt-2">
                                    {generationProgress < 30 && 'Analyse du profil...'}
                                    {generationProgress >= 30 && generationProgress < 60 && 'Génération de la lecture...'}
                                    {generationProgress >= 60 && generationProgress < 90 && 'Création du parcours...'}
                                    {generationProgress >= 90 && 'Finalisation...'}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {phase === 'review' && (
                        <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <StudioLayout orderId={order.id} orderNumber={order.orderNumber} clientName={clientName} clientRefId={order.user?.refId} initialContent={getInitialContent()} onSeal={handleSeal} onAIRequest={handleAIRequest} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
