'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { TiptapEditor } from './TiptapEditor';
import { AIAssistant } from './AIAssistant';
import { ClientPanel } from './ClientPanel';
import { useSocket } from '../hooks/useSocket';
import { Order, OracleResponse, LEVEL_CONFIG } from '../types';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Send,
  RefreshCw,
  Wand2,
  FileCheck,
  Clock,
  X,
  History,
  RotateCcw,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface OrderWorkflowProps {
  orderId: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PAID: { label: 'En attente', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  PROCESSING: { label: 'En cours', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
  AWAITING_VALIDATION: { label: 'À valider', className: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
  COMPLETED: { label: 'Livrée', className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  FAILED: { label: 'Erreur', className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function OrderWorkflow({ orderId }: OrderWorkflowProps) {
  const router = useRouter();
  
  // Core state
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  
  // Version history
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Array<{ content: string; timestamp: string; action: string }>>([]);
  
  // Seal confirmation modal
  const [showSealConfirm, setShowSealConfirm] = useState(false);

  // Socket for real-time updates
  const { focusOrder, blurOrder } = useSocket({
    onGenerationComplete: (data) => {
      if (data.orderId === orderId) {
        if (data.success) {
          toast.success('Génération terminée !');
          fetchOrder();
          // Stay in studio mode after generation
        } else {
          toast.error('Échec de la génération', { description: data.error });
        }
        setIsGenerating(false);
        setIsRegenerating(false);
      }
    },
  });

  // Polling for generation status (fallback for WebSocket)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollErrorCountRef = useRef(0);

  useEffect(() => {
    if (!isGenerating && !isRegenerating) {
      // Clean up when not generating
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      pollErrorCountRef.current = 0;
      return;
    }

    // Calculate interval with exponential backoff on errors (base: 5s, max: 30s)
    const getPollingInterval = () => {
      const baseInterval = 5000; // 5 seconds base
      const maxInterval = 30000; // 30 seconds max
      const backoffMultiplier = Math.min(Math.pow(2, pollErrorCountRef.current), 6);
      return Math.min(baseInterval * backoffMultiplier, maxInterval);
    };

    const poll = async () => {
      try {
        const { data } = await api.get(`/expert/orders/${orderId}`);
        pollErrorCountRef.current = 0; // Reset error count on success
        
        // Check if generation completed (content appeared or status changed)
        const hasNewContent = data.generatedContent && !order?.generatedContent;
        const contentChanged = data.generatedContent?.pdf_content && 
          !order?.generatedContent?.pdf_content;
        const statusChanged = data.status !== order?.status;
        
        if (hasNewContent || contentChanged || statusChanged) {
          setOrder(data);
          if (data.generatedContent) {
            setEditorContent(oracleResponseToHtml(data.generatedContent));
          }
          
          // Generation completed!
          if (data.generatedContent?.pdf_content || data.status === 'COMPLETED') {
            toast.success('Génération terminée !', { 
              description: 'La lecture est prête pour révision' 
            });
            setIsGenerating(false);
            setIsRegenerating(false);
            return; // Stop polling
          }
        }
        
        // Schedule next poll
        pollIntervalRef.current = setTimeout(poll, getPollingInterval());
      } catch (err: any) {
        pollErrorCountRef.current++;
        console.warn(`Polling error (attempt ${pollErrorCountRef.current}):`, err?.response?.status || err);
        
        // Stop polling after 5 consecutive errors or if rate limited
        if (pollErrorCountRef.current >= 5) {
          console.error('Too many polling errors, stopping');
          toast.error('Erreur de synchronisation', { 
            description: 'Rechargez la page pour voir l\'état actuel' 
          });
          setIsGenerating(false);
          setIsRegenerating(false);
          return;
        }
        
        // Continue with backoff
        pollIntervalRef.current = setTimeout(poll, getPollingInterval());
      }
    };

    // Start polling
    pollIntervalRef.current = setTimeout(poll, getPollingInterval());

    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isGenerating, isRegenerating, orderId, order?.generatedContent, order?.status]);

  // Fetch order data
  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await api.get(`/expert/orders/${orderId}`);
      setOrder(data);
      
      // Set content if exists
      if (data.generatedContent) {
        setEditorContent(oracleResponseToHtml(data.generatedContent));
      }
      
      setError(null);
    } catch (err) {
      setError('Erreur de chargement de la commande');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  // Load versions
  const loadVersions = useCallback(async () => {
    try {
      const { data } = await api.get(`/expert/orders/${orderId}/versions`);
      setVersions(data.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    loadVersions();
    focusOrder(orderId);
    return () => blurOrder(orderId);
  }, [orderId, fetchOrder, loadVersions, focusOrder, blurOrder]);

  // Actions
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await api.post(`/expert/orders/${orderId}/generate`);
      toast.info('Génération lancée...', { description: 'L\'Oracle travaille sur votre lecture' });
    } catch {
      toast.error('Erreur lors du lancement de la génération');
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await api.post(`/expert/orders/${orderId}/regenerate`);
      toast.info('Régénération lancée...');
    } catch {
      toast.error('Erreur lors de la régénération');
      setIsRegenerating(false);
    }
  };

  const handleSeal = async () => {
    setIsSealing(true);
    try {
      await api.post(`/expert/orders/${orderId}/finalize`, { finalContent: editorContent });
      toast.success('Lecture scellée et envoyée au client !');
      router.push('/admin/board');
    } catch {
      toast.error('Erreur lors du scellement');
    } finally {
      setIsSealing(false);
    }
  };

  const handleRestoreVersion = async (index: number) => {
    try {
      await api.post(`/expert/orders/${orderId}/versions/${index}/restore`);
      toast.success('Version restaurée');
      fetchOrder();
      setShowVersions(false);
    } catch {
      toast.error('Erreur lors de la restauration');
    }
  };

  const handleInsertText = (text: string) => {
    setEditorContent(prev => prev + '\n\n' + text);
    toast.success('Texte inséré');
  };

  // Derived state
  const isReadOnly = order?.status === 'COMPLETED';
  const statusBadge = STATUS_BADGE[order?.status || 'PAID'] || STATUS_BADGE.PAID;

  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          <p className="text-slate-400">Chargement de la commande...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !order) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-slate-950">
        <AlertCircle className="w-16 h-16 text-red-400" />
        <p className="text-slate-400 text-lg">{error || 'Commande introuvable'}</p>
        <button
          onClick={() => router.push('/admin/board')}
          className="px-6 py-3 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
          Retour au board
        </button>
      </div>
    );
  }

  const levelConfig = LEVEL_CONFIG[order.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG[1];

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* ═══════════════════════════════════════════════════════════════════
          TOP BAR - Status badge + Order Info + Actions
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-shrink-0 px-4 py-3 bg-slate-900/80 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/board')}
              title="Retour au board"
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 
                              flex items-center justify-center text-sm font-bold text-white">
                {order.user.firstName?.[0]}{order.user.lastName?.[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">
                    {order.user.firstName} {order.user.lastName}
                  </span>
                  <span className="text-lg">{levelConfig.icon}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-amber-400">{order.orderNumber}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-500">{levelConfig.name}</span>
                </div>
              </div>
            </div>

            {/* Status badge */}
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          </div>

          {/* Inline actions */}
          <div className="flex items-center gap-2">
            {/* Generate — only when no content and not generating */}
            {!editorContent && !isGenerating && !isReadOnly && (
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg
                           bg-gradient-to-r from-amber-500 to-amber-600
                           text-slate-900 font-medium text-sm
                           hover:from-amber-400 hover:to-amber-500 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Générer</span>
              </button>
            )}

            {/* Regenerate — when content exists */}
            {editorContent && !isGenerating && !isReadOnly && (
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-3 py-2 rounded-lg
                           bg-slate-800/50 text-slate-400 hover:text-white 
                           hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {isRegenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="text-sm">Régénérer</span>
              </button>
            )}

            {/* Version history */}
            {versions.length > 0 && (
              <button
                onClick={() => setShowVersions(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 
                           text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <History className="w-4 h-4" />
                <span className="text-sm">{versions.length}</span>
              </button>
            )}

            {/* Seal CTA — when content exists, not completed, not busy */}
            {editorContent && !isReadOnly && !isGenerating && !isSealing && (
              <button
                onClick={() => setShowSealConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg
                           bg-gradient-to-r from-emerald-500 to-emerald-600
                           text-white font-semibold text-sm
                           hover:from-emerald-400 hover:to-emerald-500
                           hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>Sceller et envoyer</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          COMPLETED BANNER
      ═══════════════════════════════════════════════════════════════════ */}
      {isReadOnly && order.deliveredAt && (
        <div className="flex-shrink-0 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-400">
            <Lock className="w-3.5 h-3.5" />
            <span>
              Cette lecture a été scellée et envoyée le{' '}
              {new Date(order.deliveredAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN 3-COLUMN LAYOUT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL — Client Profile (collapsible) */}
        <div className={`flex-shrink-0 border-r border-white/5 transition-all duration-300 ${
          showLeftPanel ? 'w-72' : 'w-12'
        }`}>
          {showLeftPanel ? (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-semibold text-white">Profil client</h3>
                <button
                  onClick={() => setShowLeftPanel(false)}
                  title="Réduire le panneau"
                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <ClientPanel order={order} compact />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center py-3 gap-2">
              <button
                onClick={() => setShowLeftPanel(true)}
                title="Afficher le profil client"
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* CENTER — Editor area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isGenerating ? (
            /* Generation in progress */
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-24 h-24 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
                  <div className="absolute inset-2 rounded-full border-4 border-amber-500/30 animate-ping animation-delay-200" />
                  <div className="absolute inset-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 
                                  flex items-center justify-center shadow-xl shadow-amber-500/30">
                    <Sparkles className="w-8 h-8 text-white animate-pulse" />
                  </div>
                </div>
                <h3 className="text-xl font-playfair text-white mb-2">
                  L&apos;Oracle crée la lecture...
                </h3>
                <p className="text-sm text-slate-400 max-w-sm">
                  Analyse du profil de {order.user.firstName}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  <Clock className="w-3 h-3 inline mr-1" />
                  ~2-3 minutes
                </p>
              </div>
            </div>
          ) : editorContent ? (
            /* Editor with content */
            <div className={`flex-1 overflow-y-auto p-4 ${
              isReadOnly ? 'border-2 border-emerald-500/30 rounded-lg m-2' : ''
            }`}>
              <TiptapEditor
                orderId={orderId}
                initialContent={editorContent}
                onContentChange={isReadOnly ? undefined : setEditorContent}
                readOnly={isReadOnly}
              />
            </div>
          ) : (
            /* Empty state — no content yet */
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-slate-800/50 border border-white/10
                                flex items-center justify-center mx-auto mb-4">
                  <Wand2 className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  Prêt à créer la lecture
                </h3>
                <p className="text-sm text-slate-400 max-w-sm mb-6">
                  Consultez le profil client puis lancez la génération IA
                </p>
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-6 py-3 mx-auto rounded-xl
                             bg-gradient-to-r from-amber-500 to-amber-600
                             text-slate-900 font-semibold
                             hover:from-amber-400 hover:to-amber-500
                             hover:shadow-lg hover:shadow-amber-500/20 transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Lancer la génération</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL — AI Assistant (always visible) */}
        <div className="w-80 flex-shrink-0 border-l border-white/5 overflow-hidden">
          <AIAssistant
            orderId={orderId}
            clientContext={{
              firstName: order.user.firstName,
              birthDate: order.user.profile?.birthDate,
              question: order.user.profile?.specificQuestion,
              objective: order.user.profile?.objective,
            }}
            onInsertText={handleInsertText}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          VERSION HISTORY DRAWER
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showVersions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setShowVersions(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-white/10"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <History className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Historique</h2>
                    <p className="text-xs text-slate-500">{versions.length} versions</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVersions(false)}
                  title="Fermer l'historique"
                  className="p-2 rounded-lg hover:bg-white/5 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Version list */}
              <div className="flex-1 overflow-y-auto p-4">
                {versions.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500">Aucune version précédente</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {versions.map((version, index) => (
                      <div
                        key={index}
                        className="bg-slate-800/50 border border-white/5 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-500">
                            {new Date(version.timestamp).toLocaleString('fr-FR')}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">
                            {version.action}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                          {version.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
                        </p>
                        <button
                          onClick={() => handleRestoreVersion(index)}
                          className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restaurer cette version</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          SEAL CONFIRMATION MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSealConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !isSealing && setShowSealConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 px-6 py-5 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <FileCheck className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Confirmer l&apos;envoi</h2>
                    <p className="text-sm text-slate-400">Cette action est irréversible</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-200/80">
                      Sera immédiatement envoyée au client par email et ne pourra plus être modifiée.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Récapitulatif</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Destinataire</span>
                      <span className="text-white font-medium">{order.user.firstName} {order.user.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Email</span>
                      <span className="text-slate-300">{order.user.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Commande</span>
                      <span className="font-mono text-amber-400">{order.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Contenu</span>
                      <span className="text-emerald-400">{editorContent.length > 0 ? '✓ Prêt' : '⚠ Vide'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 px-6 py-4 bg-slate-800/50 border-t border-white/5">
                <button
                  onClick={() => setShowSealConfirm(false)}
                  disabled={isSealing}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-slate-300
                             hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setShowSealConfirm(false);
                    handleSeal();
                  }}
                  disabled={isSealing || editorContent.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                             bg-gradient-to-r from-emerald-500 to-emerald-600
                             text-white font-semibold
                             hover:from-emerald-400 hover:to-emerald-500
                             transition-all disabled:opacity-50"
                >
                  {isSealing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Envoi...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Confirmer et envoyer</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function oracleResponseToHtml(response: OracleResponse): string {
  const parts: string[] = [];

  if (response.pdf_content) {
    const { pdf_content } = response;
    if (pdf_content.introduction) parts.push(`<h1>Introduction</h1>\n<p>${pdf_content.introduction}</p>`);
    if (pdf_content.archetype_reveal) parts.push(`<h2>Révélation de l'Archétype</h2>\n<p>${pdf_content.archetype_reveal}</p>`);
    if (pdf_content.sections) {
      pdf_content.sections.forEach(s => parts.push(`<h2>${s.title}</h2>\n<p>${s.content}</p>`));
    }
    if (pdf_content.karmic_insights?.length) {
      parts.push(`<h2>Insights Karmiques</h2>\n<ul>${pdf_content.karmic_insights.map(i => `<li>${i}</li>`).join('')}</ul>`);
    }
    if (pdf_content.life_mission) parts.push(`<h2>Mission de Vie</h2>\n<p>${pdf_content.life_mission}</p>`);
    if (pdf_content.rituals?.length) {
      parts.push(`<h2>Rituels Recommandés</h2>`);
      pdf_content.rituals.forEach(r => parts.push(`<h3>${r.name}</h3>\n<p>${r.description}</p>`));
    }
    if (pdf_content.conclusion) parts.push(`<h2>Conclusion</h2>\n<p>${pdf_content.conclusion}</p>`);
  }

  if (parts.length === 0 && response.lecture) {
    return `<p>${response.lecture}</p>`;
  }

  return parts.join('\n\n');
}
