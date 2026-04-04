'use client';

import {
  Compass,
  CheckCircle,
  Lock,
  Play,
  Moon,
  Sparkles,
  Eye,
} from 'lucide-react';
import { ClientFullData, INSIGHT_CATEGORIES, InsightCategory } from './types';

interface TabParcoursProps {
  client: ClientFullData;
}

export function TabParcours({ client }: TabParcoursProps) {
  const { spiritualPath, dreams, akashicRecord, stats } = client;

  return (
    <div className="space-y-6">
      {/* Spiritual Path Section */}
      {spiritualPath ? (
        <div className="space-y-4">
          {/* Archetype + Synthesis Header */}
          <div className="p-5 bg-gradient-to-br from-purple-500/10 via-desk-surface/60 to-desk-surface/80 border border-purple-500/20 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Compass className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                {spiritualPath.archetype && (
                  <p className="text-xl font-semibold text-purple-600 mb-1">{spiritualPath.archetype}</p>
                )}
                {spiritualPath.synthesis && (
                  <p className="text-sm text-desk-text line-clamp-4">{spiritualPath.synthesis}</p>
                )}
                {spiritualPath.keyBlockage && (
                  <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-600 font-medium mb-0.5">Blocage clé identifié</p>
                    <p className="text-sm text-desk-text">{spiritualPath.keyBlockage}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step Progress */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-desk-text">Parcours 7 jours</h4>
              <span className="text-sm text-amber-600 font-semibold">
                {stats.stepsCompleted}/{stats.stepsTotal} étapes
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-desk-card rounded-full overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                style={{ width: `${stats.stepsTotal > 0 ? (stats.stepsCompleted / stats.stepsTotal) * 100 : 0}%` }}
              />
            </div>

            {/* Step Cards */}
            <div className="space-y-2">
              {spiritualPath.steps.map((step, index) => {
                const isPast = step.isCompleted;
                const isCurrent = !step.isCompleted && (index === 0 || spiritualPath.steps[index - 1]?.isCompleted);
                return (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      isPast ? 'bg-emerald-500/5 border border-emerald-500/10' :
                      isCurrent ? 'bg-amber-500/10 border border-amber-500/20' :
                      'bg-desk-bg border border-desk-border-subtle opacity-60'
                    }`}
                  >
                    <div className="mt-0.5">
                      {isPast ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : isCurrent ? (
                        <Play className="w-5 h-5 text-amber-600" />
                      ) : (
                        <Lock className="w-5 h-5 text-desk-subtle/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-desk-muted">Jour {step.dayNumber}</span>
                        <span className="text-sm font-medium text-desk-text">{step.title}</span>
                      </div>
                      {step.description && (
                        <p className="text-xs text-desk-muted mt-0.5 line-clamp-2">{step.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
            <Compass className="w-8 h-8 text-purple-600/50" />
          </div>
          <p className="text-sm text-desk-muted italic">Le parcours spirituel sera créé après la première lecture...</p>
        </div>
      )}

      {/* Akashic Domains */}
      {akashicRecord?.domainData && Object.keys(akashicRecord.domainData).length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-desk-text mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-600" />
            Domaines Akashiques
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(akashicRecord.domainData).map(([domain, data]) => {
              const cat = domain.toUpperCase() as InsightCategory;
              const config = INSIGHT_CATEGORIES[cat];
              return (
                <div
                  key={domain}
                  className="p-3 bg-desk-hover rounded-lg border border-desk-border-subtle"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{config?.icon || '📖'}</span>
                    <span className="text-xs font-medium text-desk-text">{config?.label || domain}</span>
                  </div>
                  <p className="text-xs text-desk-muted line-clamp-2">
                    {typeof data === 'string' ? data : JSON.stringify(data).slice(0, 60)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dreams Journal */}
      <div>
          <h4 className="text-sm font-medium text-desk-text mb-3 flex items-center gap-2">
          <Moon className="w-4 h-4 text-blue-600" />
          Journal des Rêves
          {dreams.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-600 rounded-full">{dreams.length}</span>
          )}
        </h4>

        {dreams.length > 0 ? (
          <div className="space-y-2">
            {dreams.map((dream) => (
              <div
                key={dream.id}
                className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm text-desk-text line-clamp-2">{dream.content}</p>
                  <span className="text-xs text-desk-subtle whitespace-nowrap">
                    {formatDate(dream.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {dream.emotion && (
                    <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 text-xs rounded-full">
                      {dream.emotion}
                    </span>
                  )}
                  {dream.symbols.map((symbol, i) => (
                    <span key={i} className="px-2 py-0.5 bg-desk-hover text-desk-muted text-xs rounded-full">
                      {symbol}
                    </span>
                  ))}
                  {dream.linkedInsightId && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 text-xs rounded-full">
                      <Sparkles className="w-3 h-3" /> Lié à un insight
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-desk-muted italic">Aucun rêve enregistré...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
