'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { StepDossier } from './StepDossier';
import { StepBriefing } from './StepBriefing';
import { StepRevision } from './StepRevision';
import { useSocket } from '../hooks/useSocket';
import { Order, OracleResponse, LEVEL_CONFIG } from '../types';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Send,
  FileCheck,
  X,
  History,
  RotateCcw,
  Lock,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type StudioStep = 'dossier' | 'briefing' | 'revision';

interface OrderWorkflowProps {
  orderId: string;
}

const STEP_META: Record<StudioStep, { num: number; label: string }> = {
  dossier: { num: 1, label: 'Dossier' },
  briefing: { num: 2, label: 'Briefing' },
  revision: { num: 3, label: 'Révision' },
};

function computeInitialStep(order: Order): StudioStep {
  if (order.status === 'COMPLETED' || order.status === 'AWAITING_VALIDATION') return 'revision';
  if (order.generatedContent?.pdf_content) return 'revision';
  if (order.status === 'PROCESSING') return 'briefing';
  return 'dossier';
}

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
  const [step, setStep] = useState<StudioStep>('dossier');
  
  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
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
          fetchOrder().then(() => setStep('revision'));
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
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      pollErrorCountRef.current = 0;
      return;
    }

    const getPollingInterval = () => {
      const baseInterval = 5000;
      const maxInterval = 30000;
      const backoffMultiplier = Math.min(Math.pow(2, pollErrorCountRef.current), 6);
      return Math.min(baseInterval * backoffMultiplier, maxInterval);
    };

    const poll = async () => {
      try {
        const { data } = await api.get(`/expert/orders/${orderId}`);
        pollErrorCountRef.current = 0;
        
        const hasNewContent = data.generatedContent && !order?.generatedContent;
        const contentChanged = data.generatedContent?.pdf_content && 
          !order?.generatedContent?.pdf_content;
        const statusChanged = data.status !== order?.status;
        
        if (hasNewContent || contentChanged || statusChanged) {
          setOrder(data);
          if (data.generatedContent) {
            setEditorContent(oracleResponseToHtml(data.generatedContent));
          }
          
          if (data.generatedContent?.pdf_content || data.status === 'COMPLETED' || data.status === 'AWAITING_VALIDATION') {
            toast.success('Génération terminée !', { 
              description: 'La lecture est prête pour révision' 
            });
            setIsGenerating(false);
            setIsRegenerating(false);
            setStep('revision');
            return;
          }
        }
        
        pollIntervalRef.current = setTimeout(poll, getPollingInterval());
      } catch (err: any) {
        pollErrorCountRef.current++;
        console.warn(`Polling error (attempt ${pollErrorCountRef.current}):`, err?.response?.status || err);
        
        if (pollErrorCountRef.current >= 5) {
          console.error('Too many polling errors, stopping');
          toast.error('Erreur de synchronisation', { 
            description: 'Rechargez la page pour voir l\'état actuel' 
          });
          setIsGenerating(false);
          setIsRegenerating(false);
          return;
        }
        
        pollIntervalRef.current = setTimeout(poll, getPollingInterval());
      }
    };

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
      
      if (data.generatedContent) {
        setEditorContent(oracleResponseToHtml(data.generatedContent));
      }
      
      setError(null);
      return data;
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

  // Initial load — set step based on order status
  useEffect(() => {
    fetchOrder().then((data) => {
      if (data) {
        const initialStep = computeInitialStep(data);
        setStep(initialStep);
        if (data.status === 'PROCESSING') {
          setIsGenerating(true);
        }
      }
    });
    loadVersions();
    focusOrder(orderId);
    return () => blurOrder(orderId);
  }, [orderId, fetchOrder, loadVersions, focusOrder, blurOrder]);

  // ========= ACTIONS =========

  const handleLaunch = async (expertPrompt: string, expertInstructions?: string) => {
    setIsGenerating(true);
    try {
      await api.post('/expert/process-order', {
        orderId,
        expertPrompt,
        expertInstructions,
      });
      toast.success('Génération terminée !');
      await fetchOrder();
      setStep('revision');
      setIsGenerating(false);
    } catch (err: any) {
      // If timeout or network error, generation may still be running
      if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
        toast.info('Génération en cours...', { description: 'L\'Oracle travaille, veuillez patienter.' });
        // Keep isGenerating true → polling will pick up
      } else {
        toast.error('Erreur lors du lancement', { description: err?.response?.data?.message || err?.message });
        setIsGenerating(false);
      }
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      await api.post(`/expert/orders/${orderId}/regenerate`);
      toast.info('Régénération lancée...');
      setStep('briefing');
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
  const levelConfig = order ? (LEVEL_CONFIG[order.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG[1]) : LEVEL_CONFIG[1];

  // ========= LOADING / ERROR =========

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

  // ========= RENDER =========

  return (
    <div className="h-full flex flex-col bg-slate-950">
      {/* ═══════════════ TOP BAR ═══════════════ */}
      <div className="flex-shrink-0 px-4 py-3 bg-slate-900/80 border-b border-white/5">
        <div className="flex items-center justify-between">
          {/* Left: back + client info */}
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
          </div>

          {/* Center: Stepper */}
          <div className="flex items-center gap-1">
            {(['dossier', 'briefing', 'revision'] as StudioStep[]).map((s, i) => {
              const meta = STEP_META[s];
              const isCurrent = step === s;
              const isPast = STEP_META[step].num > meta.num;
              
              return (
                <div key={s} className="flex items-center gap-1">
                  {i > 0 && (
                    <div className={`w-8 h-px ${isPast ? 'bg-amber-500/60' : 'bg-white/10'}`} />
                  )}
                  <button
                    onClick={() => {
                      // Only allow navigating to past/current steps (not future beyond what's been reached)
                      if (isPast || isCurrent) setStep(s);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isCurrent
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : isPast
                          ? 'bg-white/5 text-slate-400 hover:bg-white/10 cursor-pointer'
                          : 'bg-transparent text-slate-600 cursor-default'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isCurrent ? 'bg-amber-500 text-slate-900' : isPast ? 'bg-slate-700 text-slate-400' : 'bg-slate-800 text-slate-600'
                    }`}>
                      {meta.num}
                    </span>
                    <span className="hidden sm:inline">{meta.label}</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right: status */}
          <div className="flex items-center gap-2">
            {isReadOnly && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Livrée
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════ STEP CONTENT ═══════════════ */}
      <div className="flex-1 overflow-hidden">
        {step === 'dossier' && (
          <StepDossier
            order={order}
            onContinue={() => setStep('briefing')}
          />
        )}

        {step === 'briefing' && (
          <StepBriefing
            order={order}
            isGenerating={isGenerating || isRegenerating}
            onLaunch={handleLaunch}
            onBack={() => setStep('dossier')}
          />
        )}

        {step === 'revision' && (
          <StepRevision
            order={order}
            orderId={orderId}
            editorContent={editorContent}
            onContentChange={setEditorContent}
            onInsertText={handleInsertText}
            onSeal={() => setShowSealConfirm(true)}
            onRegenerate={handleRegenerate}
            onBackToBriefing={() => setStep('briefing')}
            isReadOnly={isReadOnly}
            isRegenerating={isRegenerating}
            isSealing={isSealing}
            versions={versions}
            onShowVersions={() => setShowVersions(true)}
          />
        )}
      </div>

      {/* ═══════════════ VERSION HISTORY DRAWER ═══════════════ */}
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

      {/* ═══════════════ SEAL CONFIRMATION MODAL ═══════════════ */}
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
