'use client';

import Image from 'next/image';
import { Order, LEVEL_CONFIG } from '../types';
import {
  Calendar,
  MapPin,
  Clock,
  MessageSquare,
  Target,
  Heart,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Image as ImageIcon,
  User,
} from 'lucide-react';

interface StepDossierProps {
  order: Order;
  onContinue: () => void;
}

export function StepDossier({ order, onContinue }: StepDossierProps) {
  const { user } = order;
  const profile = user.profile;
  const levelConfig = LEVEL_CONFIG[order.level as keyof typeof LEVEL_CONFIG] || LEVEL_CONFIG[1];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Hero card */}
          <div className="bg-gradient-to-br from-amber-500/10 via-desk-surface/60 to-desk-surface/80 
                          border border-desk-border rounded-2xl p-6">
            <div className="flex items-start gap-5">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 
                              flex items-center justify-center text-2xl font-bold text-white shrink-0">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-desk-text">
                  {user.firstName} {user.lastName}
                </h1>
                <p className="text-desk-muted mt-1">{user.email}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xl">{levelConfig.icon}</span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-500/20 text-amber-600 border border-amber-500/30">
                    {levelConfig.name}
                  </span>
                  <span className="font-mono text-sm text-desk-subtle">{order.orderNumber}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column — Identity & Context */}
            <div className="space-y-4">
              {/* Birth data card */}
              <DossierCard
                icon={<User className="w-5 h-5" />}
                title="Données de naissance"
                accent="amber"
              >
                <div className="space-y-3">
                  {profile?.birthDate && (
                    <InfoLine icon={<Calendar className="w-4 h-4" />} label="Date" value={formatDate(profile.birthDate)} />
                  )}
                  {profile?.birthTime && (
                    <InfoLine icon={<Clock className="w-4 h-4" />} label="Heure" value={profile.birthTime} />
                  )}
                  {profile?.birthPlace && (
                    <InfoLine icon={<MapPin className="w-4 h-4" />} label="Lieu" value={profile.birthPlace} />
                  )}
                  {!profile?.birthDate && !profile?.birthTime && !profile?.birthPlace && (
                    <p className="text-sm text-desk-subtle italic">Aucune donnée de naissance renseignée</p>
                  )}
                </div>
              </DossierCard>

              {/* Question card */}
              {profile?.specificQuestion && (
                <DossierCard
                  icon={<MessageSquare className="w-5 h-5" />}
                  title="Question du client"
                  accent="purple"
                >
                  <p className="text-desk-text italic leading-relaxed">
                    &quot;{profile.specificQuestion}&quot;
                  </p>
                </DossierCard>
              )}

              {/* Objective card */}
              {profile?.objective && (
                <DossierCard
                  icon={<Target className="w-5 h-5" />}
                  title="Objectif"
                  accent="blue"
                >
                  <p className="text-desk-text leading-relaxed">{profile.objective}</p>
                </DossierCard>
              )}
            </div>

            {/* Right column — Emotional & Spiritual */}
            <div className="space-y-4">
              {/* Emotional state card */}
              {(profile?.highs || profile?.lows) && (
                <DossierCard
                  icon={<Heart className="w-5 h-5" />}
                  title="État émotionnel"
                  accent="rose"
                >
                  <div className="space-y-4">
                    {profile?.highs && (
                      <div>
                        <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Points forts</span>
                        <p className="text-desk-text mt-1 leading-relaxed">{profile.highs}</p>
                      </div>
                    )}
                    {profile?.lows && (
                      <div>
                        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Défis</span>
                        <p className="text-desk-text mt-1 leading-relaxed">{profile.lows}</p>
                      </div>
                    )}
                  </div>
                </DossierCard>
              )}

              {/* Fears card */}
              {profile?.fears && (
                <DossierCard
                  icon={<AlertTriangle className="w-5 h-5" />}
                  title="Peurs & Blocages"
                  accent="red"
                >
                  <p className="text-desk-muted leading-relaxed">{profile.fears}</p>
                </DossierCard>
              )}

              {/* Rituals card */}
              {profile?.rituals && (
                <DossierCard
                  icon={<Sparkles className="w-5 h-5" />}
                  title="Rituels actuels"
                  accent="teal"
                >
                  <p className="text-desk-muted leading-relaxed">{profile.rituals}</p>
                </DossierCard>
              )}

              {/* Photos card */}
              {(profile?.facePhotoUrl || profile?.palmPhotoUrl || order.files.length > 0) && (
                <DossierCard
                  icon={<ImageIcon className="w-5 h-5" />}
                  title="Photos"
                  accent="slate"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {profile?.facePhotoUrl && (
                      <PhotoCard url={profile.facePhotoUrl} label="Visage" />
                    )}
                    {profile?.palmPhotoUrl && (
                      <PhotoCard url={profile.palmPhotoUrl} label="Paume" />
                    )}
                    {order.files.map(file => (
                      <PhotoCard key={file.id} url={file.url} label={file.type === 'FACE_PHOTO' ? 'Visage' : 'Paume'} />
                    ))}
                  </div>
                </DossierCard>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex-shrink-0 px-6 py-4 bg-desk-surface border-t border-desk-border">
        <div className="max-w-6xl mx-auto flex justify-end">
          <button
            onClick={onContinue}
            className="flex items-center gap-2 px-6 py-3 rounded-xl
                       bg-gradient-to-r from-amber-500 to-amber-600
                       text-slate-900 font-semibold
                       hover:from-amber-400 hover:to-amber-500
                       hover:shadow-lg hover:shadow-amber-500/20 transition-all"
          >
            <span>Continuer vers le briefing</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const ACCENT_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-600' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-600' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-600' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: 'text-rose-600' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-600' },
  teal: { bg: 'bg-teal-500/10', border: 'border-teal-500/20', icon: 'text-teal-600' },
  slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: 'text-slate-600' },
};

function DossierCard({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  const colors = ACCENT_COLORS[accent] || ACCENT_COLORS.slate;

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={colors.icon}>{icon}</span>
        <h3 className="text-sm font-semibold text-desk-text">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-desk-subtle">{icon}</span>
      <span className="text-xs text-desk-subtle w-16 shrink-0">{label}</span>
      <span className="text-sm text-desk-text">{value}</span>
    </div>
  );
}

function PhotoCard({ url, label }: { url: string; label: string }) {
  return (
    <div className="group relative aspect-square rounded-lg overflow-hidden bg-desk-card border border-desk-border">
      <Image
        src={url}
        alt={label}
        fill
        className="object-cover group-hover:scale-105 transition-transform duration-300"
      />
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <span className="text-xs text-white/80">{label}</span>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
