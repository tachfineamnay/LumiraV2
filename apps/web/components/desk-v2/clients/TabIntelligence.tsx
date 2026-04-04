'use client';

import {
  Brain,
  Activity,
  CreditCard,
  TrendingUp,
  MessageCircle,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShoppingCart,
} from 'lucide-react';
import { ClientFullData } from './types';

interface TabIntelligenceProps {
  client: ClientFullData;
}

function MetricBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    pink: 'bg-pink-500',
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-stellar-400">{label}</span>
        <span className="text-xs font-medium text-stellar-100">{value}/{max}</span>
      </div>
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorMap[color] || colorMap.amber} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TabIntelligence({ client }: TabIntelligenceProps) {
  const { stats, subscription, chatSessions } = client;

  return (
    <div className="space-y-6">
      {/* Engagement Dashboard */}
      <div>
        <h4 className="text-sm font-medium text-stellar-100 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-400" />
          Métriques d&apos;Engagement
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Score global */}
          <div className="p-4 bg-gradient-to-br from-amber-500/10 to-slate-900/60 border border-amber-500/20 rounded-xl text-center">
            <p className="text-4xl font-bold text-amber-400">{stats.engagementScore}</p>
            <p className="text-xs text-stellar-400 mt-1">Score d&apos;engagement /100</p>
            <p className="text-[10px] text-stellar-400/60 mt-2">
              30% étapes · 25% insights · 25% chat · 20% rêves
            </p>
          </div>

          {/* Dimension breakdown */}
          <div className="p-4 bg-white/5 rounded-xl space-y-3">
            <MetricBar label="Étapes complétées" value={stats.stepsCompleted} max={stats.stepsTotal || 7} color="amber" />
            <MetricBar label="Insights consultés" value={stats.insightsViewed} max={stats.insightsTotal || 8} color="purple" />
            <MetricBar label="Messages chat" value={stats.chatMessagesTotal} max={20} color="blue" />
            <MetricBar label="Rêves enregistrés" value={stats.dreamsCount} max={5} color="pink" />
          </div>
        </div>
      </div>

      {/* Subscription + Recency Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Subscription Card */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
          <h4 className="text-sm font-medium text-stellar-100 mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            Abonnement
          </h4>
          {subscription ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stellar-400">Statut</span>
                <SubscriptionStatusBadge status={stats.subscriptionStatus} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-stellar-400">Expiration</span>
                <span className="text-xs text-stellar-100">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {stats.subscriptionDaysLeft !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stellar-400">Jours restants</span>
                  <span className={`text-xs font-bold ${stats.subscriptionDaysLeft > 7 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {stats.subscriptionDaysLeft}j
                  </span>
                </div>
              )}
              {subscription.cancelAtPeriodEnd && (
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Résiliation programmée à la fin de la période
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-stellar-400">Non abonné</p>
              <p className="text-xs text-stellar-400/60 mt-1">Achat unique uniquement</p>
            </div>
          )}
        </div>

        {/* Recency Card */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
          <h4 className="text-sm font-medium text-stellar-100 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Récence
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stellar-400">Dernière activité</span>
              <span className={`text-sm font-bold ${
                stats.daysSinceLastActivity !== null && stats.daysSinceLastActivity <= 7 ? 'text-emerald-400' :
                stats.daysSinceLastActivity !== null && stats.daysSinceLastActivity <= 30 ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {stats.daysSinceLastActivity !== null ? `Il y a ${stats.daysSinceLastActivity}j` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-stellar-400">Type</span>
              <span className="text-xs text-stellar-100 capitalize">
                {activityTypeLabel(stats.lastActivityType)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-stellar-400">Profil complété</span>
              <span className={`text-xs font-bold ${stats.profileCompleteness >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {stats.profileCompleteness}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-stellar-400">Couverture audio</span>
              <span className="text-xs text-stellar-100">{stats.audioCoverage}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Upsell History */}
      <div>
        <h4 className="text-sm font-medium text-stellar-100 mb-3 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-emerald-400" />
          Historique Upsell
        </h4>
        {stats.upsellHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-stellar-400 border-b border-white/10">
                  <th className="text-left py-2 px-3">Type</th>
                  <th className="text-left py-2 px-3">Proposé le</th>
                  <th className="text-left py-2 px-3">Accepté le</th>
                  <th className="text-left py-2 px-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {stats.upsellHistory.map((item, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 px-3 text-stellar-100 font-mono">{item.type}</td>
                    <td className="py-2 px-3 text-stellar-400">
                      {item.offeredAt ? formatDate(item.offeredAt) : '—'}
                    </td>
                    <td className="py-2 px-3 text-stellar-400">
                      {item.acceptedAt ? formatDate(item.acceptedAt) : '—'}
                    </td>
                    <td className="py-2 px-3">
                      {item.acceptedAt ? (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle className="w-3 h-3" /> Accepté
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-400">
                          <Clock className="w-3 h-3" /> En attente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 bg-white/[0.02] rounded-lg">
            <p className="text-sm text-stellar-400">Aucun upsell proposé</p>
          </div>
        )}
      </div>

      {/* Key Signals */}
      <div>
        <h4 className="text-sm font-medium text-stellar-100 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          Signaux Clés
        </h4>
        <div className="space-y-2">
          {stats.profileCompleteness < 70 && (
            <Signal type="warning" text={`Profil incomplet (${stats.profileCompleteness}%) — données manquantes pour personnalisation`} />
          )}
          {stats.engagementScore < 30 && (
            <Signal type="danger" text="Engagement très faible — risque de churn" />
          )}
          {stats.daysSinceLastActivity !== null && stats.daysSinceLastActivity > 30 && (
            <Signal type="danger" text={`Inactif depuis ${stats.daysSinceLastActivity} jours — relance recommandée`} />
          )}
          {stats.insightsViewed < stats.insightsTotal && stats.insightsTotal > 0 && (
            <Signal type="info" text={`${stats.insightsTotal - stats.insightsViewed} insight(s) non consulté(s)`} />
          )}
          {stats.audioCoverage < 50 && stats.insightsTotal > 0 && (
            <Signal type="info" text={`Couverture audio ${stats.audioCoverage}% — potentiel de contenu additionnel`} />
          )}
          {stats.engagementScore >= 60 && stats.upsellHistory.length === 0 && (
            <Signal type="success" text="Engagement élevé et aucun upsell proposé — opportunité de conversion" />
          )}
          {stats.stepsCompleted === stats.stepsTotal && stats.stepsTotal > 0 && (
            <Signal type="success" text="Parcours 7 jours complété — prêt pour un contenu avancé" />
          )}
        </div>
      </div>

      {/* Chat Sessions */}
      <div>
        <h4 className="text-sm font-medium text-stellar-100 mb-3 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-400" />
          Conversations
          {chatSessions.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">{chatSessions.length}</span>
          )}
        </h4>
        {chatSessions.length > 0 ? (
          <div className="space-y-2">
            {chatSessions.map((session) => (
              <div key={session.id} className="p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-stellar-100">{session.title || 'Conversation'}</p>
                    <p className="text-xs text-stellar-400">{session.messagesCount} messages</p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <p className="text-xs text-stellar-400">
                      {session.lastMessageAt ? formatDate(session.lastMessageAt) : formatDate(session.createdAt)}
                    </p>
                    <ChevronRight className="w-4 h-4 text-stellar-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-white/[0.02] rounded-lg">
            <p className="text-sm text-stellar-400 italic">Aucune conversation avec l&apos;Oracle...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Signal({ type, text }: { type: 'warning' | 'danger' | 'info' | 'success'; text: string }) {
  const styles = {
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    danger: 'bg-red-500/10 border-red-500/20 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  };
  const icons = {
    warning: <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />,
    danger: <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />,
    info: <Brain className="w-3.5 h-3.5 flex-shrink-0" />,
    success: <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />,
  };

  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${styles[type]}`}>
      {icons[type]}
      <span>{text}</span>
    </div>
  );
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    active: { label: 'Actif', cls: 'bg-emerald-500/20 text-emerald-400' },
    canceling: { label: 'Résiliation', cls: 'bg-amber-500/20 text-amber-400' },
    expired: { label: 'Expiré', cls: 'bg-red-500/20 text-red-400' },
    none: { label: 'Aucun', cls: 'bg-white/10 text-stellar-400' },
  };
  const c = config[status] || config.none;
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${c.cls}`}>{c.label}</span>;
}

function activityTypeLabel(type: string): string {
  const map: Record<string, string> = {
    order: 'Commande',
    chat: 'Conversation',
    dream: 'Rêve',
    step: 'Étape complétée',
    none: 'Aucune',
  };
  return map[type] || type;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
