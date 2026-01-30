'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { TiptapEditor } from './TiptapEditor';
import { AIAssistant } from './AIAssistant';
import { ClientPanel } from './ClientPanel';
import { useSocket } from '../hooks/useSocket';
import { Order, OracleResponse } from '../types';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  PanelLeftClose,
  PanelRightClose,
  PanelLeft,
  PanelRight,
} from 'lucide-react';

interface StudioEditorProps {
  orderId: string;
}

export function StudioEditor({ orderId }: StudioEditorProps) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSealing, setIsSealing] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Socket for real-time updates
  const { focusOrder, blurOrder } = useSocket({
    onGenerationComplete: (data) => {
      if (data.orderId === orderId) {
        if (data.success) {
          toast.success('Génération terminée !');
          fetchOrder();
        } else {
          toast.error('Échec de la génération', { description: data.error });
        }
        setIsGenerating(false);
      }
    },
  });

  // Fetch order data
  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await api.get(`/expert/orders/${orderId}`);
      setOrder(data);
      
      // Convert generated content to editor format
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

  useEffect(() => {
    fetchOrder();
    focusOrder(orderId);

    return () => {
      blurOrder(orderId);
    };
  }, [orderId, fetchOrder, focusOrder, blurOrder]);

  // Generate content
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await api.post(`/expert/orders/${orderId}/generate`);
      toast.info('Génération lancée...', { 
        description: 'L\'Oracle travaille sur votre lecture' 
      });
    } catch (_err) {
      toast.error('Erreur lors du lancement de la génération');
      setIsGenerating(false);
    }
  };

  // Seal order
  const handleSeal = async () => {
    if (!confirm('Êtes-vous sûr de vouloir sceller cette lecture ? Cette action est irréversible.')) {
      return;
    }

    setIsSealing(true);
    try {
      await api.post(`/expert/orders/${orderId}/finalize`, {
        content: editorContent,
      });
      toast.success('Lecture scellée avec succès !');
      router.push('/admin/board');
    } catch (_err) {
      toast.error('Erreur lors du scellement');
    } finally {
      setIsSealing(false);
    }
  };

  // Insert text from AI assistant
  const handleInsertText = (text: string) => {
    setEditorContent(prev => prev + '\n\n' + text);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-slate-400">{error || 'Commande introuvable'}</p>
        <button
          onClick={() => router.push('/admin/board')}
          className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
          Retour au board
        </button>
      </div>
    );
  }

  const hasContent = !!order.generatedContent || editorContent.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-900/50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/board')}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-amber-400">{order.orderNumber}</span>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-sm text-slate-400">
              {order.user.firstName} {order.user.lastName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Panel toggles */}
          <button
            onClick={() => setShowLeftPanel(!showLeftPanel)}
            className={`p-2 rounded-lg transition-colors ${
              showLeftPanel ? 'bg-white/5 text-white' : 'text-slate-500 hover:text-white'
            }`}
            title={showLeftPanel ? 'Masquer profil' : 'Afficher profil'}
          >
            {showLeftPanel ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setShowRightPanel(!showRightPanel)}
            className={`p-2 rounded-lg transition-colors ${
              showRightPanel ? 'bg-white/5 text-white' : 'text-slate-500 hover:text-white'
            }`}
            title={showRightPanel ? 'Masquer assistant' : 'Afficher assistant'}
          >
            {showRightPanel ? <PanelRightClose className="w-5 h-5" /> : <PanelRight className="w-5 h-5" />}
          </button>

          {/* Generate button */}
          {!hasContent && (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg
                         bg-gradient-to-r from-amber-500 to-amber-600
                         text-slate-900 font-medium
                         hover:from-amber-400 hover:to-amber-500 transition-all
                         disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{isGenerating ? 'Génération...' : 'Générer la lecture'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main content - 3 panels */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Client info */}
        {showLeftPanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex-shrink-0 border-r border-white/5 overflow-hidden"
          >
            <ClientPanel order={order} />
          </motion.div>
        )}

        {/* Center - Editor */}
        <div className="flex-1 min-w-0 p-4">
          {hasContent ? (
            <TiptapEditor
              orderId={orderId}
              initialContent={editorContent}
              onContentChange={setEditorContent}
              onSeal={order.status === 'AWAITING_VALIDATION' ? handleSeal : undefined}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-6">
              <div className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-amber-400/50" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Prêt à créer la lecture
                </h3>
                <p className="text-sm text-slate-400 max-w-md">
                  Cliquez sur &quot;Générer la lecture&quot; pour que l&apos;Oracle 
                  crée une lecture personnalisée basée sur le profil du client.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right panel - AI Assistant */}
        {showRightPanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 360, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex-shrink-0 border-l border-white/5 overflow-hidden"
          >
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
          </motion.div>
        )}
      </div>

      {/* Generating overlay */}
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-amber-400 animate-pulse" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-1">
                L&apos;Oracle crée la lecture...
              </h3>
              <p className="text-sm text-slate-400">
                Cela peut prendre quelques minutes
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    PAID: { label: 'Payée', color: 'bg-amber-500/20 text-amber-400' },
    PROCESSING: { label: 'En cours', color: 'bg-blue-500/20 text-blue-400' },
    AWAITING_VALIDATION: { label: 'Validation', color: 'bg-purple-500/20 text-purple-400' },
    COMPLETED: { label: 'Terminée', color: 'bg-emerald-500/20 text-emerald-400' },
  }[status] || { label: status, color: 'bg-slate-500/20 text-slate-400' };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}

function oracleResponseToHtml(response: OracleResponse): string {
  const parts: string[] = [];

  if (response.pdf_content) {
    const { pdf_content } = response;

    if (pdf_content.introduction) {
      parts.push(`<h1>Introduction</h1>\n<p>${pdf_content.introduction}</p>`);
    }

    if (pdf_content.archetype_reveal) {
      parts.push(`<h2>Révélation de l'Archétype</h2>\n<p>${pdf_content.archetype_reveal}</p>`);
    }

    if (pdf_content.sections) {
      pdf_content.sections.forEach(section => {
        parts.push(`<h2>${section.title}</h2>\n<p>${section.content}</p>`);
      });
    }

    if (pdf_content.karmic_insights?.length) {
      parts.push(`<h2>Insights Karmiques</h2>\n<ul>${pdf_content.karmic_insights.map(i => `<li>${i}</li>`).join('')}</ul>`);
    }

    if (pdf_content.life_mission) {
      parts.push(`<h2>Mission de Vie</h2>\n<p>${pdf_content.life_mission}</p>`);
    }

    if (pdf_content.rituals?.length) {
      parts.push(`<h2>Rituels Recommandés</h2>`);
      pdf_content.rituals.forEach(ritual => {
        parts.push(`<h3>${ritual.name}</h3>\n<p>${ritual.description}</p>\n<p><em>Fréquence: ${ritual.frequency}</em></p>`);
      });
    }

    if (pdf_content.conclusion) {
      parts.push(`<h2>Conclusion</h2>\n<p>${pdf_content.conclusion}</p>`);
    }
  }

  // Fallback to lecture if available
  if (parts.length === 0 && response.lecture) {
    return `<p>${response.lecture}</p>`;
  }

  return parts.join('\n\n');
}
