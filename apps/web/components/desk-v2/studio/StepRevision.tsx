'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TiptapEditor } from './TiptapEditor';
import { AIAssistant } from './AIAssistant';
import { ClientPanel } from './ClientPanel';
import { Order } from '../types';
import {
  RefreshCw,
  Lock,
  Loader2,
  History,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  User,
  Sparkles,
  X,
} from 'lucide-react';

interface StepRevisionProps {
  order: Order;
  orderId: string;
  editorContent: string;
  onContentChange: (content: string) => void;
  onInsertText: (text: string) => void;
  onSeal: () => void;
  onRegenerate: () => void;
  onBackToBriefing: () => void;
  isReadOnly: boolean;
  isRegenerating: boolean;
  isSealing: boolean;
  versions: Array<{ content: string; timestamp: string; action: string }>;
  onShowVersions: () => void;
}

function useIsXl() {
  const [isXl, setIsXl] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const update = () => setIsXl(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isXl;
}

export function StepRevision({
  order,
  orderId,
  editorContent,
  onContentChange,
  onInsertText,
  onSeal,
  onRegenerate,
  onBackToBriefing,
  isReadOnly,
  isRegenerating,
  isSealing,
  versions,
  onShowVersions,
}: StepRevisionProps) {
  const isXl = useIsXl();
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [mobileClientOpen, setMobileClientOpen] = useState(false);
  const [mobileAiOpen, setMobileAiOpen] = useState(false);

  // Desktop panels: open by default on xl; closed when shrinking below xl
  useEffect(() => {
    if (isXl) {
      setShowLeftPanel(true);
      setShowRightPanel(true);
      setMobileClientOpen(false);
      setMobileAiOpen(false);
    } else {
      setShowLeftPanel(false);
      setShowRightPanel(false);
    }
  }, [isXl]);

  // Lock scroll when mobile drawers open; Escape closes them
  useEffect(() => {
    if (!mobileClientOpen && !mobileAiOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileClientOpen(false);
        setMobileAiOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileClientOpen, mobileAiOpen]);

  const aiAssistant = (
    <AIAssistant
      orderId={orderId}
      clientContext={{
        firstName: order.user.firstName,
        birthDate: order.user.profile?.birthDate,
        question: order.user.profile?.specificQuestion,
        objective: order.user.profile?.objective,
      }}
      onInsertText={(text) => {
        onInsertText(text);
        setMobileAiOpen(false);
      }}
    />
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Completed banner */}
      {isReadOnly && order.deliveredAt && (
        <div className="flex-shrink-0 px-3 sm:px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-emerald-600 text-center">
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Scellée le{' '}
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

      {/* Mobile panel toggles */}
      <div className="xl:hidden flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-desk-border bg-desk-surface">
        <button
          onClick={() => setMobileClientOpen(true)}
          className="flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-lg bg-desk-card border border-desk-border
                     text-desk-muted hover:text-desk-text text-sm transition-colors"
        >
          <User className="w-4 h-4" />
          <span>Client</span>
        </button>
        <button
          onClick={() => setMobileAiOpen(true)}
          className="flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-lg bg-desk-card border border-desk-border
                     text-desk-muted hover:text-desk-text text-sm transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          <span>Assistant IA</span>
        </button>
      </div>

      {/* Layout: editor only below xl; 3-col on xl+ */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT PANEL — desktop only */}
        <div
          className={`hidden xl:flex flex-shrink-0 border-r border-desk-border transition-all duration-300 ${
            showLeftPanel ? 'w-72' : 'w-12'
          }`}
        >
          {showLeftPanel ? (
            <div className="h-full w-full flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-desk-border">
                <h3 className="text-sm font-semibold text-desk-text">Profil client</h3>
                <button
                  onClick={() => setShowLeftPanel(false)}
                  title="Réduire le panneau"
                  className="p-1.5 rounded-lg hover:bg-desk-hover text-desk-muted hover:text-desk-text transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <ClientPanel order={order} compact />
              </div>
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center py-3 gap-2">
              <button
                onClick={() => setShowLeftPanel(true)}
                title="Afficher le profil client"
                className="p-2 rounded-lg hover:bg-desk-hover text-desk-muted hover:text-desk-text transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* CENTER — Editor */}
        <div
          className={`flex-1 flex flex-col overflow-hidden min-w-0 ${
            isReadOnly ? 'border-2 border-emerald-500/30 rounded-lg m-1 sm:m-2' : ''
          }`}
        >
          <div className="flex-1 overflow-y-auto p-2 sm:p-4 min-h-0">
            <TiptapEditor
              orderId={orderId}
              initialContent={editorContent}
              onContentChange={isReadOnly ? undefined : onContentChange}
              readOnly={isReadOnly}
            />
          </div>
        </div>

        {/* RIGHT PANEL — desktop only */}
        <div
          className={`hidden xl:flex flex-shrink-0 border-l border-desk-border transition-all duration-300 ${
            showRightPanel ? 'w-80' : 'w-12'
          }`}
        >
          {showRightPanel ? (
            <div className="h-full w-full flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-desk-border">
                <span className="text-xs font-medium text-desk-muted uppercase tracking-wide">
                  Assistant IA
                </span>
                <button
                  onClick={() => setShowRightPanel(false)}
                  title="Réduire l'assistant"
                  className="p-1.5 rounded-lg hover:bg-desk-hover text-desk-muted hover:text-desk-text transition-colors"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">{aiAssistant}</div>
            </div>
          ) : (
            <div className="h-full w-full flex flex-col items-center py-3 gap-2">
              <button
                onClick={() => setShowRightPanel(true)}
                title="Afficher l'assistant IA"
                className="p-2 rounded-lg hover:bg-desk-hover text-desk-muted hover:text-desk-text transition-colors"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      {!isReadOnly && (
        <div className="flex-shrink-0 px-2 sm:px-4 py-2.5 sm:py-3 bg-desk-surface border-t border-desk-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 sm:gap-2 min-w-0 overflow-x-auto">
              <button
                onClick={onBackToBriefing}
                title="Retour au briefing"
                className="flex items-center gap-2 px-2.5 sm:px-3 py-2 min-h-[40px] rounded-lg
                           text-desk-muted hover:text-desk-text hover:bg-desk-hover transition-colors text-sm flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Briefing</span>
              </button>

              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                title="Régénérer"
                className="flex items-center gap-2 px-2.5 sm:px-3 py-2 min-h-[40px] rounded-lg
                           bg-desk-card text-desk-muted hover:text-desk-text
                           hover:bg-desk-hover transition-colors disabled:opacity-50 text-sm flex-shrink-0"
              >
                {isRegenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Régénérer</span>
              </button>

              {versions.length > 0 && (
                <button
                  onClick={onShowVersions}
                  title="Historique des versions"
                  className="flex items-center gap-2 px-2.5 sm:px-3 py-2 min-h-[40px] rounded-lg bg-desk-card
                             text-desk-muted hover:text-desk-text hover:bg-desk-hover transition-colors text-sm flex-shrink-0"
                >
                  <History className="w-4 h-4" />
                  <span>{versions.length}</span>
                </button>
              )}
            </div>

            <button
              onClick={onSeal}
              disabled={isSealing || editorContent.length === 0}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[40px] rounded-lg
                         bg-emerald-500 text-white font-semibold text-sm
                         hover:bg-emerald-400 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Sceller et envoyer</span>
              <span className="sm:hidden">Sceller</span>
            </button>
          </div>
        </div>
      )}

      {/* Mobile Client drawer */}
      <AnimatePresence>
        {mobileClientOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 xl:hidden"
            onClick={() => setMobileClientOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Profil client"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute left-0 top-0 h-full w-full max-w-sm bg-desk-surface border-r border-desk-border shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-desk-border">
                <h3 className="text-sm font-semibold text-desk-text">Profil client</h3>
                <button
                  onClick={() => setMobileClientOpen(false)}
                  aria-label="Fermer"
                  className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-desk-hover text-desk-muted flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <ClientPanel order={order} compact />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile AI drawer */}
      <AnimatePresence>
        {mobileAiOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 xl:hidden"
            onClick={() => setMobileAiOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Assistant IA"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="absolute right-0 top-0 h-full w-full max-w-md bg-desk-surface border-l border-desk-border shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-desk-border">
                <span className="text-sm font-semibold text-desk-text">Assistant IA</span>
                <button
                  onClick={() => setMobileAiOpen(false)}
                  aria-label="Fermer"
                  className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-desk-hover text-desk-muted flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">{aiAssistant}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
