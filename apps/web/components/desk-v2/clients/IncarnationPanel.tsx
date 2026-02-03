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
} from 'lucide-react';
import { ClientFullData } from './types';

interface IncarnationPanelProps {
  client: ClientFullData;
}

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({ title, icon, children, defaultOpen = true }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 text-stellar-100">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        <ChevronDown 
          className={`w-4 h-4 text-stellar-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {children}
            </div>
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
      <span className="text-stellar-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-stellar-400">{label}</p>
        <p className="text-sm text-stellar-100">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-4">
      <p className="text-sm text-stellar-400 italic">{message}</p>
    </div>
  );
}

export function IncarnationPanel({ client }: IncarnationPanelProps) {
  const { profile } = client;
  const [lightboxImage, setLightboxImage] = useState<{ url: string; label: string } | null>(null);

  // Format birth date
  const formatBirthDate = (date?: string | null) => {
    if (!date) return null;
    try {
      return new Date(date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
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
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden"
      >
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-stellar-100 flex items-center gap-2">
            <User className="w-5 h-5 text-amber-400" />
            L'Incarnation
          </h3>
          <p className="text-xs text-stellar-400 mt-1">Données physiques et terrestres</p>
        </div>

        {/* Natal Chart */}
        <CollapsibleSection 
          title="Carte Natale" 
          icon={<Calendar className="w-4 h-4 text-purple-400" />}
        >
          {hasNatalData ? (
            <div className="space-y-1">
              <InfoRow 
                icon={<Calendar className="w-3.5 h-3.5" />}
                label="Date de naissance"
                value={formatBirthDate(profile?.birthDate)}
              />
              <InfoRow 
                icon={<Clock className="w-3.5 h-3.5" />}
                label="Heure de naissance"
                value={profile?.birthTime}
              />
              <InfoRow 
                icon={<MapPin className="w-3.5 h-3.5" />}
                label="Lieu de naissance"
                value={profile?.birthPlace}
              />
            </div>
          ) : (
            <EmptyState message="Les astres attendent d'être révélés..." />
          )}
        </CollapsibleSection>

        {/* Biometric Gallery */}
        <CollapsibleSection 
          title="Galerie Biométrique" 
          icon={<Camera className="w-4 h-4 text-serenity-400" />}
        >
          {hasPhotos ? (
            <div className="grid grid-cols-2 gap-3">
              {profile?.facePhotoUrl && (
                <PhotoThumbnail
                  url={profile.facePhotoUrl}
                  label="Visage"
                  icon={<User className="w-4 h-4" />}
                  onClick={() => setLightboxImage({ url: profile.facePhotoUrl!, label: 'Visage' })}
                />
              )}
              {profile?.palmPhotoUrl && (
                <PhotoThumbnail
                  url={profile.palmPhotoUrl}
                  label="Paume"
                  icon={<Hand className="w-4 h-4" />}
                  onClick={() => setLightboxImage({ url: profile.palmPhotoUrl!, label: 'Paume de la main' })}
                />
              )}
            </div>
          ) : (
            <EmptyState message="Aucune empreinte physique capturée..." />
          )}
        </CollapsibleSection>

        {/* Personality Traits */}
        <CollapsibleSection 
          title="Personnalité" 
          icon={<Sparkles className="w-4 h-4 text-amber-400" />}
          defaultOpen={false}
        >
          {hasPersonality ? (
            <div className="space-y-3">
              {(profile?.strongSide || profile?.highs) && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs text-emerald-400 font-medium mb-1">Forces</p>
                  <p className="text-sm text-stellar-100">{profile?.strongSide || profile?.highs}</p>
                </div>
              )}
              {(profile?.weakSide || profile?.lows) && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs text-red-400 font-medium mb-1">Zones de croissance</p>
                  <p className="text-sm text-stellar-100">{profile?.weakSide || profile?.lows}</p>
                </div>
              )}
            </div>
          ) : (
            <EmptyState message="La personnalité reste un mystère..." />
          )}
        </CollapsibleSection>

        {/* Problems - Fears & Health */}
        <CollapsibleSection 
          title="Douleurs & Blocages" 
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          defaultOpen={false}
        >
          {hasProblems ? (
            <div className="space-y-3">
              {profile?.fears && (
                <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                  <p className="text-xs text-red-400/70 font-medium mb-1">Peurs & Blocages</p>
                  <p className="text-sm text-stellar-300">{profile.fears}</p>
                </div>
              )}
              {profile?.healthConcerns && (
                <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-lg">
                  <p className="text-xs text-orange-400/70 font-medium mb-1">Préoccupations santé</p>
                  <p className="text-sm text-stellar-300">{profile.healthConcerns}</p>
                </div>
              )}
            </div>
          ) : (
            <EmptyState message="Aucune ombre déclarée..." />
          )}
        </CollapsibleSection>

        {/* Desires - Questions & Objectives */}
        <CollapsibleSection 
          title="Désirs & Aspirations" 
          icon={<Target className="w-4 h-4 text-emerald-400" />}
          defaultOpen={false}
        >
          {hasDesires ? (
            <div className="space-y-3">
              {profile?.specificQuestion && (
                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                  <p className="text-xs text-blue-400/70 font-medium mb-1 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    Question posée
                  </p>
                  <p className="text-sm text-stellar-300 italic">"{profile.specificQuestion}"</p>
                </div>
              )}
              {profile?.objective && (
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                  <p className="text-xs text-emerald-400/70 font-medium mb-1 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Objectif de vie
                  </p>
                  <p className="text-sm text-stellar-300">{profile.objective}</p>
                </div>
              )}
            </div>
          ) : (
            <EmptyState message="Les désirs sont encore voilés..." />
          )}
        </CollapsibleSection>

        {/* Rituals */}
        {profile?.rituals && (
          <CollapsibleSection 
            title="Pratiques actuelles" 
            icon={<Heart className="w-4 h-4 text-pink-400" />}
            defaultOpen={false}
          >
            <div className="p-3 bg-pink-500/5 border border-pink-500/10 rounded-lg">
              <p className="text-sm text-stellar-300">{profile.rituals}</p>
            </div>
          </CollapsibleSection>
        )}
      </motion.div>

      {/* Photo Lightbox with Zoom */}
      <PhotoLightbox
        image={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </>
  );
}

// Photo Thumbnail Component
function PhotoThumbnail({ 
  url, 
  label, 
  icon, 
  onClick 
}: { 
  url: string; 
  label: string; 
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-amber-500/50 transition-all"
    >
      <img
        src={url}
        alt={label}
        className="w-full h-full object-cover transition-transform group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-2 flex items-center justify-between">
          <span className="text-xs text-white flex items-center gap-1">
            {icon}
            {label}
          </span>
          <ZoomIn className="w-4 h-4 text-white" />
        </div>
      </div>
    </button>
  );
}

// Photo Lightbox with Zoom
function PhotoLightbox({ 
  image, 
  onClose 
}: { 
  image: { url: string; label: string } | null;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);

  if (!image) return null;

  const handleZoom = (direction: 'in' | 'out') => {
    setScale(prev => {
      if (direction === 'in') return Math.min(prev + 0.5, 3);
      return Math.max(prev - 0.5, 0.5);
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
          title="Fermer"
          aria-label="Fermer la galerie"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Label */}
        <div className="absolute top-4 left-4 px-4 py-2 bg-white/10 rounded-lg">
          <p className="text-lg font-medium text-white">{image.label}</p>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-white/10 rounded-full">
          <button
            onClick={(e) => { e.stopPropagation(); handleZoom('out'); }}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
            disabled={scale <= 0.5}
            aria-label="Zoom arrière"
          >
            <span className="text-xl font-bold">−</span>
          </button>
          <span className="text-sm text-white min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={(e) => { e.stopPropagation(); handleZoom('in'); }}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
            disabled={scale >= 3}
            aria-label="Zoom avant"
          >
            <span className="text-xl font-bold">+</span>
          </button>
        </div>

        {/* Image */}
        <motion.div
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-[90vw] max-h-[80vh] overflow-auto cursor-move"
          drag
          dragConstraints={{ left: -200, right: 200, top: -200, bottom: 200 }}
        >
          <motion.img
            src={image.url}
            alt={image.label}
            className="rounded-lg shadow-2xl"
            style={{ 
              maxWidth: 'none',
              width: `${scale * 100}%`,
              minWidth: '300px',
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 25 }}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
