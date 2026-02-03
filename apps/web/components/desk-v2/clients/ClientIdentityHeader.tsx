'use client';

import { motion } from 'framer-motion';
import { 
  Mail, 
  Phone, 
  Calendar, 
  Crown,
  Sparkles,
  Star,
} from 'lucide-react';
import { Avatar } from '../shared/Avatar';
import { LevelBadge } from '../shared/LevelBadge';
import { Badge } from '../shared/Badge';
import { ClientFullData } from './types';

interface ClientIdentityHeaderProps {
  client: ClientFullData;
}

export function ClientIdentityHeader({ client }: ClientIdentityHeaderProps) {
  const { stats, akashicRecord } = client;
  const archetype = akashicRecord?.archetype;

  // Format member since date
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
      {/* Background glow effect for VIP */}
      {stats.isVip && (
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-amber-500/5" />
      )}

      <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Avatar & Name Section */}
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
              {stats.highestLevelNumber > 0 && (
                <LevelBadge level={stats.highestLevelNumber} size="sm" />
              )}
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

        {/* Stats Cards */}
        <div className="flex flex-wrap items-center gap-4 lg:gap-6">
          {/* LTV */}
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-400">{stats.totalSpentFormatted}</p>
            <p className="text-xs text-stellar-400">Valeur totale</p>
          </div>

          <div className="w-px h-10 bg-white/10 hidden lg:block" />

          {/* Orders */}
          <div className="text-center">
            <p className="text-2xl font-bold text-stellar-100">{stats.totalOrders}</p>
            <p className="text-xs text-stellar-400">Commandes</p>
          </div>

          <div className="w-px h-10 bg-white/10 hidden lg:block" />

          {/* Member since */}
          <div className="text-center">
            <p className="text-sm font-medium text-stellar-100 flex items-center gap-1">
              <Calendar className="w-4 h-4 text-stellar-400" />
              {memberSince}
            </p>
            <p className="text-xs text-stellar-400">Membre depuis</p>
          </div>
        </div>
      </div>

      {/* CRM Tags */}
      {client.crmTags && client.crmTags.length > 0 && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
          <span className="text-xs text-stellar-400">Tags:</span>
          {client.crmTags.map((tag, i) => (
            <Badge key={i} variant="info" size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
}
