'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Calendar,
  Clock,
  MapPin,
  User,
  HelpCircle,
  Target,
  Heart,
  AlertTriangle,
  Sparkles,
  Hand,
  Camera,
  X,
  ZoomIn,
  CheckCircle,
} from 'lucide-react';
import { ClientFullData } from './types';

interface TabProfilProps {
  client: ClientFullData;
}

function CollapsibleSection({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-desk-border-subtle rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-desk-hover transition-colors"
      >
        <div className="flex items-center gap-2 text-desk-text">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-desk-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-desk-muted mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-desk-muted">{label}</p>
        <p className="text-sm text-desk-text">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-4">
      <p className="text-sm text-desk-muted italic">{message}</p>
    </div>
  );
}

export function TabProfil({ client }: TabProfilProps) {
  const { profile, stats, crmNotes } = client;
  const [lightboxImage, setLightboxImage] = useState<{ url: string; label: string } | null>(null);

  const formatBirthDate = (date?: string | null) => {
    if (!date) return null;
    try {
      return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return date;
    }
  };

  const hasNatalData = profile?.birthDate || profile?.birthTime || profile?.birthPlace;
  const hasPhotos = profile?.facePhotoUrl || profile?.palmPhotoUrl;
  const hasProblems = profile?.healthConcerns || profile?.fears;
  const hasDesires = profile?.objective || profile?.specificQuestion;
  const hasPersonality = profile?.strongSide || profile?.weakSide || profile?.highs || profile?.lows;

  return (
    <>
      {/* Profile Completeness Bar */}
      <div className="mb-5 p-4 bg-desk-hover rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-desk-text font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Complétude du profil
          </span>
          <span className={`text-sm font-bold ${stats.profileCompleteness >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {stats.profileCompleteness}%
          </span>
        </div>
        <div className="w-full h-2 bg-desk-card rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.profileCompleteness}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full rounded-full ${stats.profileCompleteness >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
          />
        </div>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          {/* Carte Natale */}
          <CollapsibleSection title="Carte Natale" icon={<Calendar className="w-4 h-4 text-purple-600" />}>
            {hasNatalData ? (
              <div className="space-y-1">
                <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Date de naissance" value={formatBirthDate(profile?.birthDate)} />
                <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label="Heure de naissance" value={profile?.birthTime} />
                <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Lieu de naissance" value={profile?.birthPlace} />
              </div>
            ) : (
              <EmptyState message="Les astres attendent d'être révélés..." />
            )}
          </CollapsibleSection>

          {/* Question & Objectif */}
          <CollapsibleSection title="Désirs & Aspirations" icon={<Target className="w-4 h-4 text-emerald-600" />}>
            {hasDesires ? (
              <div className="space-y-3">
                {profile?.specificQuestion && (
                  <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                    <p className="text-xs text-blue-600/70 font-medium mb-1 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> Question posée
                    </p>
                    <p className="text-sm text-desk-text italic">&ldquo;{profile.specificQuestion}&rdquo;</p>
                  </div>
                )}
                {profile?.objective && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                    <p className="text-xs text-emerald-600/70 font-medium mb-1 flex items-center gap-1">
                      <Target className="w-3 h-3" /> Objectif de vie
                    </p>
                    <p className="text-sm text-desk-text">{profile.objective}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState message="Les désirs sont encore voilés..." />
            )}
          </CollapsibleSection>

          {/* CRM Notes */}
          <CollapsibleSection title="Notes CRM" icon={<User className="w-4 h-4 text-blue-600" />} defaultOpen={!!crmNotes}>
            {crmNotes ? (
              <div className="p-3 bg-desk-hover rounded-lg">
                <p className="text-sm text-desk-text whitespace-pre-wrap">{crmNotes}</p>
              </div>
            ) : (
              <EmptyState message="Aucune note de l'expert..." />
            )}
          </CollapsibleSection>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Personnalité */}
          <CollapsibleSection title="Personnalité" icon={<Sparkles className="w-4 h-4 text-amber-600" />}>
            {hasPersonality ? (
              <div className="space-y-3">
                {(profile?.strongSide || profile?.highs) && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs text-emerald-600 font-medium mb-1">Forces</p>
                    <p className="text-sm text-desk-text">{profile?.strongSide || profile?.highs}</p>
                  </div>
                )}
                {(profile?.weakSide || profile?.lows) && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-600 font-medium mb-1">Zones de croissance</p>
                    <p className="text-sm text-desk-text">{profile?.weakSide || profile?.lows}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState message="La personnalité reste un mystère..." />
            )}
          </CollapsibleSection>

          {/* Peurs & Blocages */}
          <CollapsibleSection title="Douleurs & Blocages" icon={<AlertTriangle className="w-4 h-4 text-red-600" />} defaultOpen={false}>
            {hasProblems ? (
              <div className="space-y-3">
                {profile?.fears && (
                  <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                    <p className="text-xs text-red-600/70 font-medium mb-1">Peurs & Blocages</p>
                    <p className="text-sm text-desk-text">{profile.fears}</p>
                  </div>
                )}
                {profile?.healthConcerns && (
                  <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-lg">
                    <p className="text-xs text-orange-600/70 font-medium mb-1">Préoccupations santé</p>
                    <p className="text-sm text-desk-text">{profile.healthConcerns}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState message="Aucune ombre déclarée..." />
            )}
          </CollapsibleSection>

          {/* Rituels */}
          {profile?.rituals && (
            <CollapsibleSection title="Pratiques actuelles" icon={<Heart className="w-4 h-4 text-pink-600" />} defaultOpen={false}>
              <div className="p-3 bg-pink-500/5 border border-pink-500/10 rounded-lg">
                <p className="text-sm text-desk-text">{profile.rituals}</p>
              </div>
            </CollapsibleSection>
          )}

          {/* Photos */}
          <CollapsibleSection title="Galerie Biométrique" icon={<Camera className="w-4 h-4 text-serenity-600" />}>
            {hasPhotos ? (
              <div className="grid grid-cols-2 gap-3">
                {profile?.facePhotoUrl && (
                  <button
                    onClick={() => setLightboxImage({ url: profile.facePhotoUrl!, label: 'Visage' })}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-desk-border hover:border-amber-500/50 transition-all"
                  >
                    <img src={profile.facePhotoUrl} alt="Visage" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center justify-between">
                        <span className="text-xs text-white flex items-center gap-1"><User className="w-4 h-4" /> Visage</span>
                        <ZoomIn className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </button>
                )}
                {profile?.palmPhotoUrl && (
                  <button
                    onClick={() => setLightboxImage({ url: profile.palmPhotoUrl!, label: 'Paume de la main' })}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-desk-border hover:border-amber-500/50 transition-all"
                  >
                    <img src={profile.palmPhotoUrl} alt="Paume" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center justify-between">
                        <span className="text-xs text-white flex items-center gap-1"><Hand className="w-4 h-4" /> Paume</span>
                        <ZoomIn className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </button>
                )}
              </div>
            ) : (
              <EmptyState message="Aucune empreinte physique capturée..." />
            )}
          </CollapsibleSection>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setLightboxImage(null)}>
          <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10" aria-label="Fermer">
            <X className="w-6 h-6 text-white" />
          </button>
          <div className="absolute top-4 left-4 px-4 py-2 bg-white/10 rounded-lg">
            <p className="text-lg font-medium text-white">{lightboxImage.label}</p>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="relative max-w-[90vw] max-h-[80vh]">
            <img src={lightboxImage.url} alt={lightboxImage.label} className="rounded-lg shadow-2xl max-h-[80vh] object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
