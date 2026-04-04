'use client';

import { useState } from 'react';
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
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Completed banner */}
      {isReadOnly && order.deliveredAt && (
        <div className="flex-shrink-0 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20">
          <div className="flex items-center justify-center gap-2 text-sm text-emerald-600">
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

      {/* 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL — Client Profile (collapsible) */}
        <div className={`flex-shrink-0 border-r border-desk-border transition-all duration-300 ${
          showLeftPanel ? 'w-72' : 'w-12'
        }`}>
          {showLeftPanel ? (
            <div className="h-full flex flex-col overflow-hidden">
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
            <div className="h-full flex flex-col items-center py-3 gap-2">
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
        <div className={`flex-1 flex flex-col overflow-hidden ${
          isReadOnly ? 'border-2 border-emerald-500/30 rounded-lg m-2' : ''
        }`}>
          <div className="flex-1 overflow-y-auto p-4">
            <TiptapEditor
              orderId={orderId}
              initialContent={editorContent}
              onContentChange={isReadOnly ? undefined : onContentChange}
              readOnly={isReadOnly}
            />
          </div>
        </div>

        {/* RIGHT PANEL — AI Assistant (collapsible) */}
        <div className={`flex-shrink-0 border-l border-desk-border transition-all duration-300 ${
          showRightPanel ? 'w-80' : 'w-12'
        }`}>
          {showRightPanel ? (
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-desk-border">
                <span className="text-xs font-medium text-desk-muted uppercase tracking-wide">Assistant IA</span>
                <button
                  onClick={() => setShowRightPanel(false)}
                  title="Réduire l'assistant"
                  className="p-1.5 rounded-lg hover:bg-desk-hover text-desk-muted hover:text-desk-text transition-colors"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <AIAssistant
                  orderId={orderId}
                  clientContext={{
                    firstName: order.user.firstName,
                    birthDate: order.user.profile?.birthDate,
                    question: order.user.profile?.specificQuestion,
                    objective: order.user.profile?.objective,
                  }}
                  onInsertText={onInsertText}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center py-3 gap-2">
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
        <div className="flex-shrink-0 px-4 py-3 bg-desk-surface border-t border-desk-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={onBackToBriefing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg
                           text-desk-muted hover:text-desk-text hover:bg-desk-hover transition-colors text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Briefing</span>
              </button>

              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-3 py-2 rounded-lg
                           bg-desk-card text-desk-muted hover:text-desk-text
                           hover:bg-desk-hover transition-colors disabled:opacity-50 text-sm"
              >
                {isRegenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>Régénérer</span>
              </button>

              {versions.length > 0 && (
                <button
                  onClick={onShowVersions}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-desk-card 
                             text-desk-muted hover:text-desk-text hover:bg-desk-hover transition-colors text-sm"
                >
                  <History className="w-4 h-4" />
                  <span>{versions.length}</span>
                </button>
              )}
            </div>

            <button
              onClick={onSeal}
              disabled={isSealing || editorContent.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg
                         bg-emerald-500 text-white font-semibold text-sm
                         hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>Sceller et envoyer</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
