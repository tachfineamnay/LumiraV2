'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Volume2,
  Eye,
} from 'lucide-react';
import { ClientFullData, INSIGHT_CATEGORIES, InsightCategory } from './types';

interface TabInsightsProps {
  client: ClientFullData;
}

export function TabInsights({ client }: TabInsightsProps) {
  const { insights, stats } = client;
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  const insightsByCategory = insights.reduce((acc, insight) => {
    acc[insight.category] = insight;
    return acc;
  }, {} as Record<InsightCategory, (typeof insights)[0]>);

  const insightsWithAudio = insights.filter(i => i.audioUrl).length;

  return (
    <div className="space-y-5">
      {/* Coverage Meters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Insights viewed */}
        <div className="p-4 bg-white/5 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-stellar-100 font-medium flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-400" />
              Insights consultés
            </span>
            <span className="text-sm font-bold text-purple-400">
              {stats.insightsViewed}/{stats.insightsTotal}
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-500"
              style={{ width: `${stats.insightsTotal > 0 ? (stats.insightsViewed / stats.insightsTotal) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Audio coverage */}
        <div className="p-4 bg-white/5 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-stellar-100 font-medium flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-400" />
              Couverture audio
            </span>
            <span className="text-sm font-bold text-amber-400">
              {insightsWithAudio}/{stats.insightsTotal}
            </span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${stats.audioCoverage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Insight Grid */}
      {insights.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(Object.keys(INSIGHT_CATEGORIES) as InsightCategory[]).map((cat) => {
            const insight = insightsByCategory[cat];
            const config = INSIGHT_CATEGORIES[cat];
            const isExpanded = expandedInsight === cat;

            return (
              <InsightCard
                key={cat}
                config={config}
                insight={insight}
                isExpanded={isExpanded}
                onToggle={() => setExpandedInsight(isExpanded ? null : cat)}
              />
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-purple-400/50" />
          </div>
          <p className="text-sm text-stellar-400 italic">Les insights seront révélés après la première lecture...</p>
        </div>
      )}
    </div>
  );
}

function InsightCard({
  config,
  insight,
  isExpanded,
  onToggle,
}: {
  config: { label: string; icon: string; color: string };
  insight?: { summary: string; fullText: string; audioUrl?: string | null; viewedAt?: string | null; createdAt: string };
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
        <div className="flex items-center gap-1">
          {insight.audioUrl && (
            <span className="p-1 bg-amber-500/20 rounded" title="Audio disponible">
              <Volume2 className="w-3 h-3 text-amber-400" />
            </span>
          )}
          {!insight.viewedAt && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
              Nouveau
            </span>
          )}
          {insight.viewedAt && (
            <span className="px-1.5 py-0.5 bg-white/10 text-stellar-400 text-xs rounded-full">
              Vu
            </span>
          )}
        </div>
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
            <div className="flex items-center gap-3 mt-2">
              <p className="text-xs text-stellar-400">
                Généré le {formatDate(insight.createdAt)}
              </p>
              {insight.audioUrl && (
                <a
                  href={insight.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                >
                  <Volume2 className="w-3 h-3" />
                  Écouter
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
