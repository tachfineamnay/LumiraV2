'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Check,
  Send,
  ChevronRight,
  RefreshCw,
  User,
  Wand2,
  FileCheck,
  Clock,
  X,
  History,
  RotateCcw,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface OrderWorkflowProps {
  orderId: string;
}

// Simplified 2-step workflow: Studio (edit) → Delivery (confirm & send)
type WorkflowStep = 'studio' | 'delivery';

interface StepConfig {
  id: WorkflowStep;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  description: string;
}

const WORKFLOW_STEPS: StepConfig[] = [
  { 
    id: 'studio', 
    label: 'Studio', 
    shortLabel: 'Éditer',
    icon: <Wand2 className="w-4 h-4" />,
    description: 'Créer et affiner la lecture',
  },
  { 
    id: 'delivery', 
    label: 'Livraison', 
    shortLabel: 'Livrer',
    icon: <Send className="w-4 h-4" />,
    description: 'Sceller et envoyer au client',
  },
];

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
  
  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('studio');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Version history
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Array<{ content: string; timestamp: string; action: string }>>([]);
  
  // Seal confirmation modal
  const [showSealConfirm, setShowSealConfirm] = useState(false);
  
  // Client panel visibility (in Studio view)
  const [showClientPanel, setShowClientPanel] = useState(true);

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

  // Fetch order data
  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await api.get(`/expert/orders/${orderId}`);
      setOrder(data);
      
      // Set content if exists
      if (data.generatedContent) {
        setEditorContent(oracleResponseToHtml(data.generatedContent));
      }
      
      // Simplified step determination
      if (data.status === 'COMPLETED') {
        setCurrentStep('delivery');
      } else {
        setCurrentStep('studio');
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

  // Determine step states
  const getStepState = (stepId: WorkflowStep) => {
    const stepIndex = WORKFLOW_STEPS.findIndex(s => s.id === stepId);
    const currentIndex = WORKFLOW_STEPS.findIndex(s => s.id === currentStep);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

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
          TOP BAR - Order Info + Back
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
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          WORKFLOW TIMELINE - Horizontal Steps
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-shrink-0 px-6 py-4 bg-slate-900/40 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            {WORKFLOW_STEPS.map((step, index) => {
              const state = getStepState(step.id);
              const isLast = index === WORKFLOW_STEPS.length - 1;
              
              return (
                <div key={step.id} className="flex items-center flex-1">
                  {/* Step circle + label */}
                  <button
                    onClick={() => {
                      // Only allow going back or to completed steps
                      if (state === 'completed' || state === 'active') {
                        setCurrentStep(step.id);
                      }
                    }}
                    disabled={state === 'pending'}
                    className={`flex flex-col items-center gap-2 group transition-all ${
                      state === 'pending' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {/* Circle */}
                    <div className={`
                      relative w-12 h-12 rounded-xl flex items-center justify-center transition-all
                      ${state === 'completed' 
                        ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50' 
                        : state === 'active'
                          ? 'bg-amber-500/20 text-amber-400 border-2 border-amber-500 shadow-lg shadow-amber-500/20'
                          : 'bg-slate-800/50 text-slate-500 border-2 border-slate-700'
                      }
                      ${state !== 'pending' ? 'group-hover:scale-105' : ''}
                    `}>
                      {state === 'completed' ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        step.icon
                      )}
                      
                      {/* Pulse for active */}
                      {state === 'active' && (
                        <div className="absolute inset-0 rounded-xl bg-amber-500/20 animate-ping" />
                      )}
                    </div>

                    {/* Label */}
                    <div className="text-center">
                      <p className={`text-sm font-medium ${
                        state === 'active' ? 'text-amber-400' : 
                        state === 'completed' ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {step.shortLabel}
                      </p>
                    </div>
                  </button>

                  {/* Connector line */}
                  {!isLast && (
                    <div className="flex-1 mx-4">
                      <div className={`h-1 rounded-full transition-colors ${
                        getStepState(WORKFLOW_STEPS[index + 1].id) !== 'pending'
                          ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                          : 'bg-slate-800'
                      }`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT - Simplified 2-step workflow
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* STUDIO VIEW - Profile + Editor + AI in one unified view */}
          {currentStep === 'studio' && (
            <motion.div
              key="studio"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="h-full flex"
            >
              {/* Left Panel - Client Profile (collapsible) */}
              <div className={`flex-shrink-0 overflow-y-auto border-r border-white/5 transition-all duration-300 ${
                showClientPanel ? 'w-80' : 'w-0'
              }`}>
                {showClientPanel && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-white">Profil client</h3>
                      <button
                        onClick={() => setShowClientPanel(false)}
                        title="Masquer le profil"
                        className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <ClientPanel order={order} compact />
                  </div>
                )}
              </div>

              {/* Center - Main Editor Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Sub-header with actions */}
                <div className="flex-shrink-0 px-4 py-3 bg-slate-900/50 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {!showClientPanel && (
                        <button
                          onClick={() => setShowClientPanel(true)}
                          title="Afficher le profil client"
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                                     bg-slate-800 border border-white/10 text-sm text-slate-400 hover:text-white"
                        >
                          <User className="w-4 h-4" />
                          <span>Profil</span>
                        </button>
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-white">
                          {editorContent ? 'Éditeur de lecture' : 'Nouvelle lecture'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {editorContent ? 'Affinez le contenu généré' : 'Lancez la génération pour commencer'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {!editorContent && !isGenerating && (
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
                      
                      {editorContent && (
                        <>
                          <button
                            onClick={handleRegenerate}
                            disabled={isRegenerating || isGenerating}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                                       bg-slate-800 border border-white/10 text-sm
                                       text-slate-400 hover:text-white transition-colors
                                       disabled:opacity-50"
                          >
                            {isRegenerating ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            <span>Régénérer</span>
                          </button>
                          
                          <button
                            onClick={() => setShowVersions(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                                       bg-slate-800 border border-white/10 text-sm
                                       text-slate-400 hover:text-white transition-colors"
                          >
                            <History className="w-4 h-4" />
                            <span>Historique</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Editor content or Generation State */}
                <div className="flex-1 overflow-y-auto">
                  {isGenerating ? (
                    // Generation in progress
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
                    // Editor with content
                    <div className="p-4">
                      <TiptapEditor
                        orderId={orderId}
                        initialContent={editorContent}
                        onContentChange={setEditorContent}
                      />
                    </div>
                  ) : (
                    // Empty state - no content yet
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

                {/* Bottom action - only show when content exists */}
                {editorContent && !isGenerating && (
                  <div className="flex-shrink-0 p-4 bg-slate-900/50 border-t border-white/5">
                    <button
                      onClick={() => setCurrentStep('delivery')}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                                 bg-gradient-to-r from-emerald-500 to-emerald-600
                                 text-white font-semibold
                                 hover:from-emerald-400 hover:to-emerald-500 transition-all"
                    >
                      <FileCheck className="w-5 h-5" />
                      <span>Prêt à livrer</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right Panel - AI Assistant */}
              <div className="w-80 flex-shrink-0 overflow-hidden border-l border-white/5">
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
            </motion.div>
          )}

          {/* DELIVERY VIEW - Final confirmation */}
          {currentStep === 'delivery' && (
            <motion.div
              key="delivery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full overflow-y-auto"
            >
              <div className="max-w-2xl mx-auto p-6">
                <div className="text-center mb-8">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600
                                  flex items-center justify-center mx-auto mb-4
                                  shadow-xl shadow-emerald-500/20">
                    <Send className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-playfair text-white mb-2">
                    Prêt pour la livraison
                  </h2>
                  <p className="text-slate-400">
                    Vérifiez une dernière fois le contenu avant de l&apos;envoyer au client.
                  </p>
                </div>

                {/* Preview card */}
                <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-slate-400">Aperçu de la lecture</h3>
                    <button
                      onClick={() => setCurrentStep('studio')}
                      className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Modifier
                    </button>
                  </div>
                  <div 
                    className="prose prose-invert prose-sm max-w-none max-h-64 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: truncateHtml(editorContent, 1500) }}
                  />
                </div>

                {/* Recipient info */}
                <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 
                                    flex items-center justify-center text-sm font-bold text-white">
                      {order.user.firstName?.[0]}{order.user.lastName?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">
                        {order.user.firstName} {order.user.lastName}
                      </p>
                      <p className="text-sm text-slate-400">{order.user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Commande</p>
                      <p className="font-mono text-amber-400">{order.orderNumber}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setShowSealConfirm(true)}
                    disabled={isSealing}
                    className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl
                               bg-gradient-to-r from-emerald-500 to-emerald-600
                               text-white font-semibold text-lg
                               hover:from-emerald-400 hover:to-emerald-500
                               hover:shadow-xl hover:shadow-emerald-500/20
                               transition-all disabled:opacity-50"
                  >
                    {isSealing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Send className="w-6 h-6" />
                    )}
                    <span>{isSealing ? 'Envoi en cours...' : 'Sceller et envoyer'}</span>
                  </button>
                  
                  <button
                    onClick={() => setCurrentStep('studio')}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl
                               bg-slate-800 text-slate-300 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Retourner à l&apos;éditeur</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
                    <div className="text-sm text-amber-200/80">
                      <p className="font-medium mb-1">Attention</p>
                      <p>Une fois scellée, la lecture ne pourra plus être modifiée et sera immédiatement envoyée au client par email.</p>
                    </div>
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

/**
 * Safely truncate HTML content without breaking tags
 * Preserves complete HTML structure up to maxLength characters of text
 */
function truncateHtml(html: string, maxLength: number): string {
  if (!html) return '';
  
  // Strip tags to count actual text length
  const textContent = html.replace(/<[^>]*>/g, '');
  if (textContent.length <= maxLength) return html;

  let textCount = 0;
  let result = '';
  const tagStack: string[] = [];
  let i = 0;

  while (i < html.length && textCount < maxLength) {
    if (html[i] === '<') {
      // Find end of tag
      const tagEnd = html.indexOf('>', i);
      if (tagEnd === -1) break;
      
      const tag = html.substring(i, tagEnd + 1);
      
      // Check if it's a closing tag
      if (tag.startsWith('</')) {
        const tagName = tag.substring(2, tag.length - 1).toLowerCase().trim();
        if (tagStack.length && tagStack[tagStack.length - 1] === tagName) {
          tagStack.pop();
        }
        result += tag;
      }
      // Self-closing tags
      else if (tag.endsWith('/>') || /^<(br|hr|img|input|meta|link)[\s/>]/i.test(tag)) {
        result += tag;
      }
      // Opening tag
      else {
        const tagMatch = tag.match(/^<(\w+)/);
        if (tagMatch) {
          tagStack.push(tagMatch[1].toLowerCase());
        }
        result += tag;
      }
      i = tagEnd + 1;
    } else {
      result += html[i];
      textCount++;
      i++;
    }
  }

  // Close any remaining open tags
  while (tagStack.length > 0) {
    result += `</${tagStack.pop()}>`;
  }

  // Add ellipsis if truncated
  if (textCount >= maxLength) {
    result += '...';
  }

  return result;
}

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
