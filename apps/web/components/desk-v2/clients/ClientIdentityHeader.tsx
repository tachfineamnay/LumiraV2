'use client';

import { useState, useRef, useEffect } from 'react';
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
  MoreVertical,
  ShieldBan,
  Pause,
  Play,
  Trash2,
  Plus,
  X,
  Pencil,
  Loader2,
} from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Avatar } from '../shared/Avatar';
import { LevelBadge } from '../shared/LevelBadge';
import { Badge } from '../shared/Badge';
import { ClientFullData } from './types';

interface ClientIdentityHeaderProps {
  client: ClientFullData;
  onStatusChange?: (status: string, reason?: string) => void;
  onDelete?: () => void;
  onRefresh?: () => void;
}

function KpiCard({ icon, value, label, color = 'stellar' }: { icon: React.ReactNode; value: string | number; label: string; color?: string }) {
  const colorMap: Record<string, string> = {
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    purple: 'text-purple-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    stellar: 'text-desk-text',
  };
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-desk-hover rounded-lg min-w-[120px]">
      <span className={colorMap[color] || colorMap.stellar}>{icon}</span>
      <div>
        <p className={`text-lg font-bold ${colorMap[color] || colorMap.stellar}`}>{value}</p>
        <p className="text-[10px] text-desk-muted leading-tight">{label}</p>
      </div>
    </div>
  );
}

function SubscriptionPill({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    active: { label: 'Abonné Actif', bg: 'bg-emerald-500/20 border-emerald-500/30', text: 'text-emerald-600' },
    canceling: { label: 'Résiliation en cours', bg: 'bg-amber-500/20 border-amber-500/30', text: 'text-amber-600' },
    expired: { label: 'Expiré', bg: 'bg-red-500/20 border-red-500/30', text: 'text-red-600' },
    none: { label: 'Non abonné', bg: 'bg-desk-hover border-desk-border', text: 'text-desk-muted' },
  };
  const c = config[status] || config.none;
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

export function ClientIdentityHeader({ client, onStatusChange, onDelete, onRefresh }: ClientIdentityHeaderProps) {
  const { stats, akashicRecord } = client;
  const archetype = stats.archetype || akashicRecord?.archetype;
  const [showActions, setShowActions] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const memberSince = new Date(stats.memberSince).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-desk-card to-desk-surface border border-desk-border p-6 shadow-sm"
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
                <h2 className="text-2xl font-bold text-desk-text">
                  {client.firstName} {client.lastName}
                </h2>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="p-1 rounded hover:bg-desk-hover text-desk-subtle hover:text-amber-600 transition-colors"
                  title="Modifier les informations"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {stats.isVip && (
                  <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/30 rounded-full text-xs font-medium text-amber-600 flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    VIP
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-1 text-sm text-desk-muted">
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
                  <span className="px-2 py-0.5 bg-desk-hover rounded text-xs text-desk-muted font-mono">
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
              <Sparkles className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-xs text-purple-600/70">Archétype Dominant</p>
                <p className="text-lg font-semibold text-purple-600">{archetype}</p>
              </div>
            </div>
          )}

          {/* Actions dropdown */}
          {(onStatusChange || onDelete) && (
            <div ref={actionsRef} className="relative lg:ml-0">
              <button
                onClick={() => setShowActions(!showActions)}
                className="p-2 rounded-lg hover:bg-desk-hover text-desk-muted transition-colors"
                title="Actions client"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showActions && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-desk-surface border border-desk-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  {onStatusChange && client.status !== 'BANNED' && (
                    <button
                      onClick={() => { setShowActions(false); onStatusChange('BANNED'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-500/10 transition-colors"
                    >
                      <ShieldBan className="w-4 h-4" />
                      Bannir le client
                    </button>
                  )}
                  {onStatusChange && client.status !== 'SUSPENDED' && client.status !== 'BANNED' && (
                    <button
                      onClick={() => { setShowActions(false); onStatusChange('SUSPENDED'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-500/10 transition-colors"
                    >
                      <Pause className="w-4 h-4" />
                      Suspendre le client
                    </button>
                  )}
                  {onStatusChange && (client.status === 'BANNED' || client.status === 'SUSPENDED') && (
                    <button
                      onClick={() => { setShowActions(false); onStatusChange('ACTIVE'); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      Réactiver le client
                    </button>
                  )}
                  {onDelete && (
                    <>
                      <div className="border-t border-desk-border my-1" />
                      <button
                        onClick={() => { setShowActions(false); onDelete(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Supprimer le client
                      </button>
                    </>
                  )}
                </div>
              )}
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
        <EditableTags clientId={client.id} tags={client.crmTags || []} onRefresh={onRefresh} />
      </div>

      {/* Edit Client Modal */}
      {showEditModal && (
        <EditClientModal
          client={client}
          onClose={() => setShowEditModal(false)}
          onSaved={() => { setShowEditModal(false); onRefresh?.(); }}
        />
      )}
    </motion.div>
  );
}

// Edit Client Info Modal
function EditClientModal({ client, onClose, onSaved }: { client: ClientFullData; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.patch(`/expert/clients/${client.id}`, form);
      toast.success('Informations mises à jour');
      onSaved();
    } catch (err) {
      toast.error('Erreur lors de la mise à jour');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isSaving && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-desk-surface border border-desk-border rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-desk-border">
          <h2 className="text-lg font-semibold text-desk-text">Modifier le client</h2>
          <button onClick={onClose} disabled={isSaving} className="p-1.5 rounded-lg hover:bg-desk-hover text-desk-muted" title="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-desk-muted mb-1">Prénom</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))}
                placeholder="Prénom"
                className="w-full px-3 py-2 bg-desk-input border border-desk-border rounded-lg text-sm text-desk-text focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-desk-muted mb-1">Nom</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))}
                placeholder="Nom"
                className="w-full px-3 py-2 bg-desk-input border border-desk-border rounded-lg text-sm text-desk-text focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-desk-muted mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email"
              className="w-full px-3 py-2 bg-desk-input border border-desk-border rounded-lg text-sm text-desk-text focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-desk-muted mb-1">Téléphone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="Optionnel"
              className="w-full px-3 py-2 bg-desk-input border border-desk-border rounded-lg text-sm text-desk-text placeholder:text-desk-subtle focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-desk-border bg-desk-card">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 rounded-xl border border-desk-border text-desk-muted hover:bg-desk-hover transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Enregistrer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Editable Tags Component
function EditableTags({ clientId, tags, onRefresh }: { clientId: string; tags: string[]; onRefresh?: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) inputRef.current.focus();
  }, [isAdding]);

  const saveTags = async (updatedTags: string[]) => {
    try {
      await api.patch(`/expert/clients/${clientId}`, { tags: updatedTags });
      onRefresh?.();
    } catch (err) {
      toast.error('Erreur lors de la mise à jour des tags');
      console.error(err);
    }
  };

  const handleAdd = () => {
    const tag = newTag.trim();
    if (!tag || tags.includes(tag)) { setNewTag(''); return; }
    saveTags([...tags, tag]);
    setNewTag('');
    setIsAdding(false);
  };

  const handleRemove = (index: number) => {
    saveTags(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="flex items-center gap-2 pt-3 border-t border-desk-border-subtle flex-wrap">
      <span className="text-xs text-desk-muted">Tags:</span>
      {tags.map((tag, i) => (
        <span key={i} className="group/tag inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-medium text-blue-600">
          {tag}
          <button
            onClick={() => handleRemove(i)}
            className="opacity-0 group-hover/tag:opacity-100 hover:text-red-500 transition-opacity -mr-0.5"
            title="Supprimer le tag"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      {isAdding ? (
        <input
          ref={inputRef}
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
            if (e.key === 'Escape') { setIsAdding(false); setNewTag(''); }
          }}
          onBlur={() => { if (newTag.trim()) handleAdd(); else setIsAdding(false); }}
          placeholder="Nouveau tag..."
          className="px-2 py-0.5 text-xs bg-desk-input border border-desk-border rounded-full w-24 focus:outline-none focus:ring-1 focus:ring-amber-500/30 text-desk-text"
        />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs text-desk-muted hover:text-amber-600 hover:bg-amber-500/10 border border-dashed border-desk-border-subtle rounded-full transition-colors"
          title="Ajouter un tag"
        >
          <Plus className="w-3 h-3" />
          Tag
        </button>
      )}
    </div>
  );
}
