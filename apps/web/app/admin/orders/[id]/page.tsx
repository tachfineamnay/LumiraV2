'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { motion } from 'framer-motion';
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
    Send,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    MapPin,
    Target,
    HelpCircle,
    Image as ImageIcon,
    MessageSquare,
} from 'lucide-react';

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
    pdfUrl?: string;
    generatedContent?: {
        lecture?: string;
        synthesis?: {
            archetype?: string;
            keywords?: string[];
            emotional_state?: string;
            key_blockage?: string;
        };
    };
    user?: {
        id?: string;
        refId?: string;
        firstName?: string;
        lastName?: string;
        profile?: UserProfile;
    };
}

export default function OrderStudioPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = params.id as string;

    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSealing, setIsSealing] = useState(false);
    const [contextExpanded, setContextExpanded] = useState(false);
    const [editedContent, setEditedContent] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isRefining, setIsRefining] = useState(false);

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
            setEditedContent(data.generatedContent?.lecture || '');
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

    // Handle AI refinement
    const handleRefine = async () => {
        if (!aiPrompt.trim()) return;
        const token = getToken();
        setIsRefining(true);

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}/refine`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ instruction: aiPrompt, currentContent: editedContent }),
            });

            if (!res.ok) throw new Error('Erreur lors du raffinement');

            const data = await res.json();
            if (data.updatedContent) {
                setEditedContent(data.updatedContent);
                toast.success('Contenu mis à jour !');
            }
            setAiPrompt('');
        } catch (err) {
            toast.error('Échec du raffinement', {
                description: err instanceof Error ? err.message : 'Veuillez réessayer',
            });
        } finally {
            setIsRefining(false);
        }
    };

    // Handle sealing/validating the order
    const handleSeal = async () => {
        const token = getToken();
        setIsSealing(true);

        try {
            const res = await fetch(`${apiUrl}/api/expert/orders/${orderId}/finalize`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ finalContent: editedContent }),
            });

            if (!res.ok) throw new Error('Échec de la validation');

            toast.success('Lecture scellée avec succès !', {
                description: 'Le client a été notifié par email.',
            });

            setTimeout(() => router.push('/admin'), 1500);
        } catch (err) {
            toast.error('Erreur lors du scellement', {
                description: err instanceof Error ? err.message : 'Veuillez réessayer',
            });
        } finally {
            setIsSealing(false);
        }
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
            PROCESSING: { color: 'bg-blue-500/20 text-blue-400', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: 'Génération...' },
            AWAITING_VALIDATION: { color: 'bg-purple-500/20 text-purple-400', icon: <FileText className="w-3.5 h-3.5" />, label: 'À valider' },
            COMPLETED: { color: 'bg-emerald-500/20 text-emerald-400', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Terminée' },
        };
        const c = cfg[status] || cfg.PENDING;
        return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.color}`}>{c.icon}{c.label}</span>;
    };

    const hasContent = !!editedContent;

    // If order is still processing, show waiting state
    if (order.status === 'PROCESSING' || order.status === 'PAID') {
        return (
            <div className="min-h-screen bg-void">
                <Toaster position="top-right" richColors />
                <header className="border-b border-gold/20 bg-void-dark/50 backdrop-blur-sm">
                    <div className="max-w-4xl mx-auto px-4 py-3">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/admin')} className="p-2 rounded-lg text-divine/60 hover:text-divine hover:bg-gold/10" title="Retour">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="font-semibold text-divine">{order.orderNumber}</h1>
                                <p className="text-xs text-divine/50">{clientName}</p>
                            </div>
                            {getStatusBadge(order.status)}
                        </div>
                    </div>
                </header>
                <main className="max-w-4xl mx-auto p-8">
                    <div className="text-center py-16">
                        <div className="relative w-24 h-24 mx-auto mb-6">
                            <div className="absolute inset-0 rounded-full border-4 border-gold/20" />
                            <motion.div 
                                className="absolute inset-0 rounded-full border-4 border-gold border-t-transparent" 
                                animate={{ rotate: 360 }} 
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} 
                            />
                            <div className="absolute inset-4 rounded-full bg-gold/10 flex items-center justify-center">
                                <Sparkles className="w-8 h-8 text-gold" />
                            </div>
                        </div>
                        <h2 className="text-xl font-semibold text-divine mb-2">Génération en cours...</h2>
                        <p className="text-divine/60 mb-6">L&apos;Oracle compose la lecture pour {clientName}</p>
                        <button 
                            onClick={fetchOrder} 
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 text-gold hover:bg-gold/30"
                        >
                            <RefreshCw className="w-4 h-4" /> Actualiser
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-void">
            <Toaster position="top-right" richColors />

            {/* Header */}
            <header className="border-b border-gold/20 bg-void-dark/50 backdrop-blur-sm sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 py-3">
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
                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-full bg-gold/20 text-gold text-sm font-medium">
                                {order.level === 1 && 'Initié'}{order.level === 2 && 'Mystique'}{order.level === 3 && 'Profond'}{order.level === 4 && 'Intégral'}
                            </span>
                            {hasContent && order.status !== 'COMPLETED' && (
                                <button 
                                    onClick={handleSeal} 
                                    disabled={isSealing}
                                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold hover:from-emerald-600 hover:to-green-600 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isSealing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Valider & Envoyer
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-4">
                {/* Collapsible Client Context */}
                <div className="mb-4">
                    <button 
                        onClick={() => setContextExpanded(!contextExpanded)}
                        className="w-full flex items-center justify-between p-4 rounded-lg bg-void-dark border border-gold/20 text-divine hover:bg-gold/5 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gold" />
                            <span className="font-medium">Contexte Client</span>
                            {profile?.specificQuestion && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">Question</span>
                            )}
                        </div>
                        {contextExpanded ? <ChevronUp className="w-5 h-5 text-divine/50" /> : <ChevronDown className="w-5 h-5 text-divine/50" />}
                    </button>
                    
                    {contextExpanded && profile && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }} 
                            animate={{ opacity: 1, height: 'auto' }} 
                            className="mt-2 p-4 rounded-lg bg-void-dark border border-gold/20"
                        >
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {profile.birthDate && (
                                    <div>
                                        <span className="text-divine/50 text-xs uppercase">Naissance</span>
                                        <p className="text-divine">{profile.birthDate} {profile.birthTime && `à ${profile.birthTime}`}</p>
                                    </div>
                                )}
                                {profile.birthPlace && (
                                    <div>
                                        <span className="text-divine/50 text-xs uppercase flex items-center gap-1"><MapPin className="w-3 h-3" />Lieu</span>
                                        <p className="text-divine">{profile.birthPlace}</p>
                                    </div>
                                )}
                                {profile.objective && (
                                    <div>
                                        <span className="text-divine/50 text-xs uppercase flex items-center gap-1"><Target className="w-3 h-3" />Objectif</span>
                                        <p className="text-divine">{profile.objective}</p>
                                    </div>
                                )}
                                {profile.deliveryStyle && (
                                    <div>
                                        <span className="text-divine/50 text-xs uppercase">Style</span>
                                        <p className="text-divine">{profile.deliveryStyle}</p>
                                    </div>
                                )}
                            </div>
                            
                            {profile.specificQuestion && (
                                <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                    <span className="text-divine/50 text-xs uppercase flex items-center gap-1 mb-1"><HelpCircle className="w-3 h-3" />Question</span>
                                    <p className="text-divine italic">&quot;{profile.specificQuestion}&quot;</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                                {profile.highs && (
                                    <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                                        <span className="text-emerald-400 text-xs">Moments de grâce</span>
                                        <p className="text-divine/80 text-sm">{profile.highs}</p>
                                    </div>
                                )}
                                {profile.lows && (
                                    <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                                        <span className="text-red-400 text-xs">Épreuves</span>
                                        <p className="text-divine/80 text-sm">{profile.lows}</p>
                                    </div>
                                )}
                                {profile.fears && (
                                    <div className="p-2 rounded bg-orange-500/10 border border-orange-500/20">
                                        <span className="text-orange-400 text-xs">Peurs</span>
                                        <p className="text-divine/80 text-sm">{profile.fears}</p>
                                    </div>
                                )}
                                {profile.ailments && (
                                    <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20">
                                        <span className="text-rose-400 text-xs">Maux</span>
                                        <p className="text-divine/80 text-sm">{profile.ailments}</p>
                                    </div>
                                )}
                            </div>

                            {(profile.facePhotoUrl || profile.palmPhotoUrl) && (
                                <div className="mt-4 flex gap-3 items-center">
                                    <span className="text-divine/50 text-xs uppercase flex items-center gap-1"><ImageIcon className="w-3 h-3" />Photos</span>
                                    {profile.facePhotoUrl && (
                                        <a href={profile.facePhotoUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded bg-void border border-gold/20 overflow-hidden hover:border-gold/40">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={profile.facePhotoUrl} alt="Visage" className="w-full h-full object-cover" />
                                        </a>
                                    )}
                                    {profile.palmPhotoUrl && (
                                        <a href={profile.palmPhotoUrl} target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded bg-void border border-gold/20 overflow-hidden hover:border-gold/40">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={profile.palmPhotoUrl} alt="Paume" className="w-full h-full object-cover" />
                                        </a>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* Main Content Area */}
                {hasContent ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Content Display / Editor */}
                        <div className="lg:col-span-2">
                            <div className="bg-void-dark rounded-xl border border-gold/20 overflow-hidden">
                                <div className="flex items-center justify-between p-3 border-b border-gold/10">
                                    <h2 className="font-medium text-divine flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-gold" /> Lecture Générée
                                    </h2>
                                    <button 
                                        onClick={() => setIsEditing(!isEditing)}
                                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${isEditing ? 'bg-amber-500/20 text-amber-400' : 'bg-gold/10 text-divine/60 hover:text-divine'}`}
                                    >
                                        {isEditing ? 'Aperçu' : 'Éditer'}
                                    </button>
                                </div>
                                <div className="p-6 max-h-[70vh] overflow-y-auto">
                                    {isEditing ? (
                                        <textarea
                                            value={editedContent}
                                            onChange={(e) => setEditedContent(e.target.value)}
                                            className="w-full h-[60vh] bg-transparent text-divine font-mono text-sm resize-none focus:outline-none"
                                            placeholder="Contenu de la lecture..."
                                        />
                                    ) : (
                                        <div className="prose prose-invert prose-gold max-w-none whitespace-pre-wrap">
                                            {editedContent}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* AI Refinement Panel */}
                        <div className="space-y-4">
                            {/* Synthesis */}
                            {order.generatedContent?.synthesis && (
                                <div className="bg-void-dark rounded-xl border border-gold/20 p-4">
                                    <h3 className="font-medium text-divine mb-3 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-gold" /> Synthèse
                                    </h3>
                                    {order.generatedContent.synthesis.archetype && (
                                        <div className="mb-2">
                                            <span className="text-divine/50 text-xs">Archétype</span>
                                            <p className="text-divine font-medium">{order.generatedContent.synthesis.archetype}</p>
                                        </div>
                                    )}
                                    {order.generatedContent.synthesis.keywords && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {order.generatedContent.synthesis.keywords.map((kw, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded-full bg-gold/10 text-gold text-xs">{kw}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* AI Refinement */}
                            {order.status !== 'COMPLETED' && (
                                <div className="bg-void-dark rounded-xl border border-gold/20 p-4">
                                    <h3 className="font-medium text-divine mb-3 flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-gold" /> Raffinement IA
                                    </h3>
                                    <p className="text-divine/50 text-xs mb-2">Demandez à l&apos;IA de modifier le contenu</p>
                                    <textarea
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        placeholder="Ex: Rend le ton plus chaleureux, développe la partie sur les relations..."
                                        className="w-full h-24 p-3 rounded-lg bg-void border border-gold/20 text-divine text-sm resize-none focus:outline-none focus:border-gold/40 placeholder-divine/30"
                                    />
                                    <button
                                        onClick={handleRefine}
                                        disabled={isRefining || !aiPrompt.trim()}
                                        className="w-full mt-3 py-2 rounded-lg bg-gold/20 text-gold font-medium hover:bg-gold/30 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        {isRefining ? 'Raffinement...' : 'Appliquer'}
                                    </button>
                                </div>
                            )}

                            {/* Validate Button (mobile) */}
                            {order.status !== 'COMPLETED' && (
                                <button 
                                    onClick={handleSeal} 
                                    disabled={isSealing}
                                    className="w-full lg:hidden py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold hover:from-emerald-600 hover:to-green-600 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isSealing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                    Valider & Envoyer au Client
                                </button>
                            )}

                            {/* Completed state */}
                            {order.status === 'COMPLETED' && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                                    <p className="text-emerald-400 font-medium">Lecture envoyée</p>
                                    <p className="text-divine/50 text-sm">Le client a reçu sa lecture</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* No content yet */
                    <div className="bg-void-dark rounded-xl border border-gold/20 p-12 text-center">
                        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-divine mb-2">Aucun contenu généré</h2>
                        <p className="text-divine/60 mb-4">La génération automatique n&apos;a pas encore produit de contenu.</p>
                        <p className="text-divine/40 text-sm">Statut actuel: {order.status}</p>
                    </div>
                )}
            </main>
        </div>
    );
}
