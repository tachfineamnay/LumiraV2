'use client';

import { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Calendar,
  MapPin,
  Clock,
  MessageSquare,
  Target,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Sparkles,
  Heart,
  AlertTriangle,
} from 'lucide-react';
import { Order, LEVEL_CONFIG } from '../types';

interface ClientPanelProps {
  order: Order;
  compact?: boolean;
}

export function ClientPanel({ order, compact = false }: ClientPanelProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(['profile', 'question']);
  const { user } = order;
  const profile = user.profile;
  const levelConfig = LEVEL_CONFIG[order.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG[1];

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-desk-surface">
      {/* Header with client avatar */}
      <div className="p-3 border-b border-desk-border">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-amber-500 
                          flex items-center justify-center text-sm font-bold text-white">
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-desk-text truncate">
              {user.firstName} {user.lastName}
            </h2>
            <p className="text-xs text-desk-muted truncate">{user.email}</p>
          </div>
        </div>

        {/* Order info */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-lg">{levelConfig.icon}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLevelColor(order.level)}`}>
            {levelConfig.name}
          </span>
          <span className="text-sm text-desk-subtle">•</span>
          <span className="font-mono text-sm text-desk-muted">{order.orderNumber}</span>
        </div>
      </div>

      {/* Sections */}
      <div className="p-2 space-y-1">
        {/* Profile Section */}
        <CollapsibleSection
          title="Profil"
          icon={<User className="w-4 h-4" />}
          isExpanded={expandedSections.includes('profile')}
          onToggle={() => toggleSection('profile')}
        >
          <div className="space-y-3">
            {profile?.birthDate && (
              <InfoRow
                icon={<Calendar className="w-3.5 h-3.5" />}
                label="Naissance"
                value={formatDate(profile.birthDate)}
              />
            )}
            {profile?.birthTime && (
              <InfoRow
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Heure"
                value={profile.birthTime}
              />
            )}
            {profile?.birthPlace && (
              <InfoRow
                icon={<MapPin className="w-3.5 h-3.5" />}
                label="Lieu"
                value={profile.birthPlace}
              />
            )}
          </div>
        </CollapsibleSection>

        {/* Question Section */}
        {profile?.specificQuestion && (
          <CollapsibleSection
            title="Question"
            icon={<MessageSquare className="w-4 h-4" />}
            isExpanded={expandedSections.includes('question')}
            onToggle={() => toggleSection('question')}
            highlight
          >
            <p className="text-sm text-desk-muted italic leading-relaxed">
              &quot;{profile.specificQuestion}&quot;
            </p>
          </CollapsibleSection>
        )}

        {/* Objective Section */}
        {profile?.objective && (
          <CollapsibleSection
            title="Objectif"
            icon={<Target className="w-4 h-4" />}
            isExpanded={expandedSections.includes('objective')}
            onToggle={() => toggleSection('objective')}
          >
            <p className="text-sm text-desk-muted">{profile.objective}</p>
          </CollapsibleSection>
        )}

        {/* Emotional State */}
        {(profile?.highs || profile?.lows) && (
          <CollapsibleSection
            title="État émotionnel"
            icon={<Heart className="w-4 h-4" />}
            isExpanded={expandedSections.includes('emotional')}
            onToggle={() => toggleSection('emotional')}
          >
            <div className="space-y-3">
              {profile?.highs && (
                <div>
                  <span className="text-xs text-emerald-600 font-medium">Points forts</span>
                  <p className="text-sm text-desk-muted mt-1">{profile.highs}</p>
                </div>
              )}
              {profile?.lows && (
                <div>
                  <span className="text-xs text-amber-600 font-medium">Défis</span>
                  <p className="text-sm text-desk-muted mt-1">{profile.lows}</p>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Fears */}
        {profile?.fears && (
          <CollapsibleSection
            title="Peurs & Blocages"
            icon={<AlertTriangle className="w-4 h-4" />}
            isExpanded={expandedSections.includes('fears')}
            onToggle={() => toggleSection('fears')}
          >
            <p className="text-sm text-desk-muted">{profile.fears}</p>
          </CollapsibleSection>
        )}

        {/* Rituals */}
        {profile?.rituals && (
          <CollapsibleSection
            title="Rituels actuels"
            icon={<Sparkles className="w-4 h-4" />}
            isExpanded={expandedSections.includes('rituals')}
            onToggle={() => toggleSection('rituals')}
          >
            <p className="text-sm text-desk-muted">{profile.rituals}</p>
          </CollapsibleSection>
        )}

        {/* Photos */}
        {(profile?.facePhotoUrl || profile?.palmPhotoUrl || order.files.length > 0) && (
          <CollapsibleSection
            title="Photos"
            icon={<ImageIcon className="w-4 h-4" />}
            isExpanded={expandedSections.includes('photos')}
            onToggle={() => toggleSection('photos')}
          >
            <div className="grid grid-cols-2 gap-2">
              {profile?.facePhotoUrl && (
                <PhotoThumbnail url={profile.facePhotoUrl} label="Visage" />
              )}
              {profile?.palmPhotoUrl && (
                <PhotoThumbnail url={profile.palmPhotoUrl} label="Paume" />
              )}
              {order.files.map(file => (
                <PhotoThumbnail key={file.id} url={file.url} label={file.type} />
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  highlight?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  highlight,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className={`rounded-lg overflow-hidden ${highlight ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-desk-card'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-desk-hover transition-colors"
      >
        <span className={highlight ? 'text-amber-600' : 'text-desk-subtle'}>{icon}</span>
        <span className="flex-1 text-sm font-medium text-desk-text">{title}</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-desk-subtle" />
        ) : (
          <ChevronDown className="w-4 h-4 text-desk-subtle" />
        )}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-desk-subtle">{icon}</span>
      <span className="text-xs text-desk-subtle">{label}:</span>
      <span className="text-sm text-desk-text">{value}</span>
    </div>
  );
}

function PhotoThumbnail({ url, label }: { url: string; label: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="aspect-square rounded-lg overflow-hidden bg-desk-card 
                   hover:ring-2 hover:ring-amber-500/50 transition-all"
      >
        <img src={url} alt={label} className="w-full h-full object-cover" />
      </button>

      {/* Lightbox */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
            onClick={() => setIsOpen(false)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={url}
              alt={label}
              className="max-w-[90vw] max-h-[90vh] rounded-lg"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getLevelColor(level: number): string {
  switch (level) {
    case 1: return 'bg-emerald-500/20 text-emerald-600';
    case 2: return 'bg-blue-500/20 text-blue-600';
    case 3: return 'bg-purple-500/20 text-purple-600';
    case 4: return 'bg-amber-500/20 text-amber-600';
    default: return 'bg-slate-500/20 text-desk-muted';
  }
}
