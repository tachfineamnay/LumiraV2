'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen,
  Eye,
  Sparkles,
  MessageCircle,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { ClientFullData, INSIGHT_CATEGORIES, InsightCategory } from './types';

interface AkashicSummaryProps {
  client: ClientFullData;
}

export function AkashicSummary({ client }: AkashicSummaryProps) {
  const { insights, akashicRecord, chatSessions, spiritualPath } = client;
  const [activeTab, setActiveTab] = useState<'insights' | 'akashic' | 'chats'>('insights');
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  // Group insights by category
  const insightsByCategory = insights.reduce((acc, insight) => {
    acc[insight.category] = insight;
    return acc;
  }, {} as Record<InsightCategory, typeof insights[0]>);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden min-h-[600px]"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-stellar-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-400" />
          Les Annales Akashiques
        </h3>
        <p className="text-xs text-stellar-400 mt-1">Mémoire spirituelle et insights de l'âme</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <TabButton 
          active={activeTab === 'insights'} 
          onClick={() => setActiveTab('insights')}
          icon={<Sparkles className="w-4 h-4" />}
          label="Insights"
          count={insights.length}
        />
        <TabButton 
          active={activeTab === 'akashic'} 
          onClick={() => setActiveTab('akashic')}
          icon={<Eye className="w-4 h-4" />}
          label="Mémoire"
        />
        <TabButton 
          active={activeTab === 'chats'} 
          onClick={() => setActiveTab('chats')}
          icon={<MessageCircle className="w-4 h-4" />}
          label="Conversations"
          count={chatSessions.length}
        />
      </div>

      {/* Tab Content */}
      <div className="p-4 overflow-y-auto max-h-[500px]">
        <AnimatePresence mode="wait">
          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {insights.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(Object.keys(INSIGHT_CATEGORIES) as InsightCategory[]).map((cat) => {
                    const insight = insightsByCategory[cat];
                    const config = INSIGHT_CATEGORIES[cat];
                    
                    return (
                      <InsightCard
                        key={cat}
                        config={config}
                        insight={insight}
                        isExpanded={expandedInsight === cat}
                        onToggle={() => setExpandedInsight(
                          expandedInsight === cat ? null : cat
                        )}
                      />
                    );
                  })}
                </div>
              ) : (
                <EmptyAkashic message="Les insights seront révélés après la première lecture..." />
              )}
            </motion.div>
          )}

          {activeTab === 'akashic' && (
            <motion.div
              key="akashic"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {akashicRecord ? (
                <>
                  {/* Archetype */}
                  {akashicRecord.archetype && (
                    <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                      <p className="text-xs text-purple-400/70 mb-1">Archétype Identifié</p>
                      <p className="text-xl font-semibold text-purple-300">{akashicRecord.archetype}</p>
                    </div>
                  )}

                  {/* Domain Data */}
                  {akashicRecord.domainData && Object.keys(akashicRecord.domainData).length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-stellar-100">Données des Domaines</p>
                      <div className="p-4 bg-white/5 rounded-lg">
                        <pre className="text-xs text-stellar-300 whitespace-pre-wrap overflow-x-auto">
                          {JSON.stringify(akashicRecord.domainData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Interaction History */}
                  {akashicRecord.interactionHistory && akashicRecord.interactionHistory.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-stellar-100">Historique des Interactions</p>
                      <div className="space-y-2">
                        {akashicRecord.interactionHistory.slice(0, 5).map((interaction, i) => (
                          <div key={i} className="p-3 bg-white/5 rounded-lg flex items-start gap-3">
                            <div className="p-1.5 bg-amber-500/20 rounded">
                              <Clock className="w-3 h-3 text-amber-400" />
                            </div>
                            <div>
                              <p className="text-xs text-stellar-400">{interaction.date}</p>
                              <p className="text-sm text-stellar-100">{interaction.summary}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Spiritual Path */}
                  {spiritualPath && (
                    <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <p className="text-sm font-medium text-amber-400 mb-2">Parcours Spirituel</p>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-xs text-stellar-400">Progression</p>
                          <p className="text-lg font-bold text-stellar-100">
                            {spiritualPath.steps.filter(s => s.isCompleted).length}/{spiritualPath.steps.length} étapes
                          </p>
                        </div>
                        {spiritualPath.keyBlockage && (
                          <div className="flex-1 border-l border-white/10 pl-4">
                            <p className="text-xs text-stellar-400">Blocage clé</p>
                            <p className="text-sm text-stellar-100">{spiritualPath.keyBlockage}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <EmptyAkashic message="Le dossier akashique sera créé lors de la première lecture..." />
              )}
            </motion.div>
          )}

          {activeTab === 'chats' && (
            <motion.div
              key="chats"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {chatSessions.length > 0 ? (
                <div className="space-y-2">
                  {chatSessions.map((session) => (
                    <div 
                      key={session.id}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-stellar-100">
                            {session.title || 'Conversation'}
                          </p>
                          <p className="text-xs text-stellar-400">
                            {session.messagesCount} messages
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-stellar-400">
                            {session.lastMessageAt ? formatDate(session.lastMessageAt) : formatDate(session.createdAt)}
                          </p>
                          <ChevronRight className="w-4 h-4 text-stellar-400 ml-auto" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyAkashic message="Aucune conversation avec l'Oracle..." />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Tab Button
function TabButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  count 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors
        ${active 
          ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/5' 
          : 'text-stellar-400 hover:text-stellar-100 hover:bg-white/5'
        }
      `}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`
          px-1.5 py-0.5 text-xs rounded-full
          ${active ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-stellar-400'}
        `}>
          {count}
        </span>
      )}
    </button>
  );
}

// Insight Card
function InsightCard({ 
  config, 
  insight,
  isExpanded,
  onToggle,
}: { 
  config: { label: string; icon: string; color: string };
  insight?: { summary: string; fullText: string; viewedAt?: string | null; createdAt: string };
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colorClasses: Record<string, string> = {
    purple: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40',
    pink: 'bg-pink-500/10 border-pink-500/20 hover:border-pink-500/40',
    amber: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40',
    orange: 'bg-orange-500/10 border-orange-500/20 hover:border-orange-500/40',
    blue: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40',
    green: 'bg-green-500/10 border-green-500/20 hover:border-green-500/40',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 hover:border-yellow-500/40',
  };

  if (!insight) {
    return (
      <div className={`p-3 rounded-lg border opacity-40 ${colorClasses[config.color]}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="text-sm text-stellar-400">{config.label}</span>
        </div>
        <p className="text-xs text-stellar-400/60 mt-1 italic">Non révélé</p>
      </div>
    );
  }

  return (
    <motion.div
      layout
      className={`p-3 rounded-lg border cursor-pointer transition-all ${colorClasses[config.color]}`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="text-sm font-medium text-stellar-100">{config.label}</span>
        </div>
        {!insight.viewedAt && (
          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
            Nouveau
          </span>
        )}
      </div>
      
      <p className="text-xs text-stellar-300 mt-2 line-clamp-2">{insight.summary}</p>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-white/10"
          >
            <p className="text-sm text-stellar-100 whitespace-pre-wrap">{insight.fullText}</p>
            <p className="text-xs text-stellar-400 mt-2">
              Généré le {formatDate(insight.createdAt)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Empty State
function EmptyAkashic({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
        <Eye className="w-8 h-8 text-purple-400/50" />
      </div>
      <p className="text-sm text-stellar-400 italic max-w-xs">{message}</p>
    </div>
  );
}

// Helper function
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
