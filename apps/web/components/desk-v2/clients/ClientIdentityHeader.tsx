'use client';

import { motion } from 'framer-motion';
import { 
  Mail, 
  Phone, 
  Calendar, 
  Crown,
  Sparkles,
  Star,
  Activity,
  UserCheck,
  Clock,
  CreditCard,
} from 'lucide-react';
import { Avatar } from '../shared/Avatar';
import { LevelBadge } from '../shared/LevelBadge';
import { Badge } from '../shared/Badge';
import { ClientFullData } from './types';

interface ClientIdentityHeaderProps {
  client: ClientFullData;
}

function KpiCard({ icon, value, label, color = 'stellar' }: { icon: React.ReactNode; value: string | number; label: string; color?: string }) {
  const colorMap: Record<string, string> = {
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    stellar: 'text-stellar-100',
  };
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg min-w-[120px]">
      <span className={colorMap[color] || colorMap.stellar}>{icon}</span>
      <div>
        <p className={`text-lg font-bold ${colorMap[color] || colorMap.stellar}`}>{value}</p>
        <p className="text-[10px] text-stellar-400 leading-tight">{label}</p>
      </div>
    </div>
  );
}

function SubscriptionPill({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    active: { label: 'Abonné Actif', bg: 'bg-emerald-500/20 border-emerald-500/30', text: 'text-emerald-400' },
    canceling: { label: 'Résiliation en cours', bg: 'bg-amber-500/20 border-amber-500/30', text: 'text-amber-400' },
    expired: { label: 'Expiré', bg: 'bg-red-500/20 border-red-500/30', text: 'text-red-400' },
    none: { label: 'Non abonné', bg: 'bg-white/5 border-white/10', text: 'text-stellar-400' },
  };
  const c = config[status] || config.none;
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

export function ClientIdentityHeader({ client }: ClientIdentityHeaderProps) {
  const { stats, akashicRecord } = client;
  const archetype = stats.archetype || akashicRecord?.archetype;

  const memberSince = new Date(stats.memberSince).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800/80 to-slate-900/80 border border-white/10 p-6"
    >
      {stats.isVip && (
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5" />
      )}

      <div className="relative flex flex-col gap-5">
        {/* Top row: Identity + Archetype + Subscription */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar 
                name={`${client.firstName} ${client.lastName}`}
                src={client.profile?.facePhotoUrl || undefined}
                size="xl"
              />
              {stats.isVip && (
                <div className="absolute -top-1 -right-1 p-1 bg-amber-500 rounded-full">
                  <Crown className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-stellar-100">
                  {client.firstName} {client.lastName}
                </h2>
                {stats.isVip && (
                  <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/30 rounded-full text-xs font-medium text-amber-400 flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    VIP
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-1 text-sm text-stellar-400">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {client.email}
                </span>
                {client.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {client.phone}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                {client.refId && (
                  <span className="px-2 py-0.5 bg-white/5 rounded text-xs text-stellar-400 font-mono">
                    {client.refId}
                  </span>
                )}
                <SubscriptionPill status={stats.subscriptionStatus} />
              </div>
            </div>
          </div>

          {/* Archetype Badge */}
          {archetype && (
            <div className="lg:ml-auto flex items-center gap-3 px-4 py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-xs text-purple-400/70">Archétype Dominant</p>
                <p className="text-lg font-semibold text-purple-300">{archetype}</p>
              </div>
            </div>
          )}
        </div>

        {/* KPI Cards Row */}
        <div className="flex flex-wrap gap-3">
          <KpiCard
            icon={<CreditCard className="w-4 h-4" />}
            value={stats.totalSpentFormatted}
            label="Valeur totale"
            color="amber"
          />
          <KpiCard
            icon={<Calendar className="w-4 h-4" />}
            value={stats.totalOrders}
            label="Commandes"
            color="stellar"
          />
          <KpiCard
            icon={<Clock className="w-4 h-4" />}
            value={memberSince}
            label="Membre depuis"
            color="stellar"
          />
          <KpiCard
            icon={<Activity className="w-4 h-4" />}
            value={`${stats.engagementScore}/100`}
            label="Engagement"
            color={stats.engagementScore >= 60 ? 'emerald' : stats.engagementScore >= 30 ? 'amber' : 'red'}
          />
          <KpiCard
            icon={<UserCheck className="w-4 h-4" />}
            value={`${stats.profileCompleteness}%`}
            label="Profil complété"
            color={stats.profileCompleteness >= 70 ? 'emerald' : 'amber'}
          />
          <KpiCard
            icon={<Clock className="w-4 h-4" />}
            value={stats.daysSinceLastActivity !== null ? `${stats.daysSinceLastActivity}j` : '—'}
            label="Dernière activité"
            color={stats.daysSinceLastActivity !== null && stats.daysSinceLastActivity <= 7 ? 'emerald' : stats.daysSinceLastActivity !== null && stats.daysSinceLastActivity <= 30 ? 'amber' : 'red'}
          />
        </div>

        {/* CRM Tags */}
        {client.crmTags && client.crmTags.length > 0 && (
          <div className="flex items-center gap-2 pt-3 border-t border-white/5">
            <span className="text-xs text-stellar-400">Tags:</span>
            {client.crmTags.map((tag, i) => (
              <Badge key={i} variant="info" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
