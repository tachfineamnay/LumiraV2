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
  CheckCircle,
  Pencil,
  Save,
  Loader2,
} from 'lucide-react';
import expertApi from '@/lib/expertApi';
import { toast } from 'sonner';
import { ExpertPrivatePhoto } from '@/components/private-media/ExpertPrivatePhoto';
import { ClientFullData } from './types';

interface TabProfilProps {
  client: ClientFullData;
  onRefresh?: () => void;
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
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
        <ChevronDown
          className={`w-4 h-4 text-desk-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
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
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
}) {
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

const LIFE_AREA_DISPLAY: Record<string, string> = {
  relations: 'Relations & famille',
  travail: 'Travail & argent',
  corps: 'Corps & énergie',
  creativite: 'Créativité & élans',
  interieur: 'Vie intérieure',
  direction: 'Direction de vie',
};

const LIFE_AREA_STATE_DISPLAY: Record<string, { label: string; className: string }> = {
  FLUIDE: {
    label: 'Fluide',
    className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  },
  TENDU: { label: 'Tendu', className: 'bg-red-500/10 text-red-700 border-red-500/30' },
  EN_QUESTION: {
    label: 'En question',
    className: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
  },
};

export function LifeAreaRow({
  areaKey,
  entry,
}: {
  areaKey: string;
  entry: { state: string; note?: string };
}) {
  const state = LIFE_AREA_STATE_DISPLAY[entry.state] ?? {
    label: entry.state,
    className: 'bg-desk-hover text-desk-muted border-desk-border',
  };
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-desk-muted">{LIFE_AREA_DISPLAY[areaKey] ?? areaKey}</span>
        <span
          className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${state.className}`}
        >
          {state.label}
        </span>
      </div>
      {entry.note && <p className="mt-0.5 text-xs italic text-desk-subtle">« {entry.note} »</p>}
    </div>
  );
}

export function TabProfil({ client, onRefresh }: TabProfilProps) {
  const { profile, stats, crmNotes } = client;

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
  const hasProblems = profile?.ailments || profile?.fears;
  const hasDesires = profile?.objective || profile?.specificQuestion;
  const hasPersonality =
    profile?.strongSide || profile?.weakSide || profile?.highs || profile?.lows;
  const lifeAreaEntries = Object.entries(profile?.lifeAreas ?? {});
  const hasLifeContext = lifeAreaEntries.length > 0 || profile?.lifeEvents;

  return (
    <>
      {/* Profile Completeness Bar */}
      <div className="mb-5 p-4 bg-desk-hover rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-desk-text font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Complétude du profil
          </span>
          <span
            className={`text-sm font-bold ${stats.profileCompleteness >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}
          >
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
          <CollapsibleSection
            title="Carte Natale"
            icon={<Calendar className="w-4 h-4 text-purple-600" />}
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
                <InfoRow
                  icon={<User className="w-3.5 h-3.5" />}
                  label="Prénom d'usage"
                  value={profile?.usageName}
                />
              </div>
            ) : (
              <EmptyState message="Les astres attendent d'être révélés..." />
            )}
          </CollapsibleSection>

          {/* Météo de vie & période marquante */}
          <CollapsibleSection
            title="Météo de vie"
            icon={<Sparkles className="w-4 h-4 text-sky-600" />}
          >
            {hasLifeContext ? (
              <div className="space-y-3">
                {lifeAreaEntries.length > 0 && (
                  <div className="space-y-2">
                    {lifeAreaEntries.map(([key, entry]) => (
                      <LifeAreaRow key={key} areaKey={key} entry={entry} />
                    ))}
                  </div>
                )}
                {profile?.lifeEvents && (
                  <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
                    <p className="text-xs text-purple-600/70 font-medium mb-1">Période marquante</p>
                    <p className="text-sm text-desk-text">{profile.lifeEvents}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState message="Aucune météo de vie déclarée..." />
            )}
          </CollapsibleSection>

          {/* Question & Objectif */}
          <CollapsibleSection
            title="Désirs & Aspirations"
            icon={<Target className="w-4 h-4 text-emerald-600" />}
          >
            {hasDesires ? (
              <div className="space-y-3">
                {profile?.specificQuestion && (
                  <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                    <p className="text-xs text-blue-600/70 font-medium mb-1 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> Question posée
                    </p>
                    <p className="text-sm text-desk-text italic">
                      &ldquo;{profile.specificQuestion}&rdquo;
                    </p>
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
          <CollapsibleSection
            title="Notes CRM"
            icon={<User className="w-4 h-4 text-blue-600" />}
            defaultOpen={!!crmNotes}
          >
            <EditableNotes clientId={client.id} initialNotes={crmNotes || ''} onSaved={onRefresh} />
          </CollapsibleSection>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Personnalité */}
          <CollapsibleSection
            title="Personnalité"
            icon={<Sparkles className="w-4 h-4 text-amber-600" />}
          >
            {hasPersonality ? (
              <div className="space-y-3">
                {(profile?.strongSide || profile?.highs) && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs text-emerald-600 font-medium mb-1">Forces</p>
                    <p className="text-sm text-desk-text">
                      {profile?.strongSide || profile?.highs}
                    </p>
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
          <CollapsibleSection
            title="Douleurs & Blocages"
            icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
            defaultOpen={false}
          >
            {hasProblems ? (
              <div className="space-y-3">
                {profile?.fears && (
                  <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                    <p className="text-xs text-red-600/70 font-medium mb-1">Peurs & Blocages</p>
                    <p className="text-sm text-desk-text">{profile.fears}</p>
                  </div>
                )}
                {profile?.ailments && (
                  <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-lg">
                    <p className="text-xs text-orange-600/70 font-medium mb-1">
                      Contexte corporel déclaré
                    </p>
                    <p className="text-sm text-desk-text">{profile.ailments}</p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState message="Aucune ombre déclarée..." />
            )}
          </CollapsibleSection>

          {/* Rituels */}
          {profile?.rituals && (
            <CollapsibleSection
              title="Pratiques actuelles"
              icon={<Heart className="w-4 h-4 text-pink-600" />}
              defaultOpen={false}
            >
              <div className="p-3 bg-pink-500/5 border border-pink-500/10 rounded-lg">
                <p className="text-sm text-desk-text">{profile.rituals}</p>
              </div>
            </CollapsibleSection>
          )}

          {/* Photos */}
          <CollapsibleSection
            title="Galerie Biométrique"
            icon={<Camera className="w-4 h-4 text-serenity-600" />}
          >
            {hasPhotos ? (
              <div className="grid grid-cols-2 gap-3">
                {profile?.facePhotoUrl && (
                  <div>
                    <ExpertPrivatePhoto clientId={client.id} kind="face" alt="Visage" />
                    <p className="mt-1 text-xs text-desk-muted flex items-center gap-1">
                      <User className="w-3 h-3" /> Visage
                    </p>
                  </div>
                )}
                {profile?.palmPhotoUrl && (
                  <div>
                    <ExpertPrivatePhoto clientId={client.id} kind="palm" alt="Paume de la main" />
                    <p className="mt-1 text-xs text-desk-muted flex items-center gap-1">
                      <Hand className="w-3 h-3" /> Paume
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState message="Aucune empreinte physique capturée..." />
            )}
          </CollapsibleSection>
        </div>
      </div>
    </>
  );
}

// Editable CRM Notes Component
function EditableNotes({
  clientId,
  initialNotes,
  onSaved,
}: {
  clientId: string;
  initialNotes: string;
  onSaved?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await expertApi.patch(`/expert/clients/${clientId}`, { notes });
      toast.success('Notes mises à jour');
      setIsEditing(false);
      onSaved?.();
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Ajoutez vos notes sur ce client..."
          className="w-full px-3 py-2 bg-desk-input border border-desk-border rounded-lg text-sm text-desk-text placeholder:text-desk-subtle focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-y"
          autoFocus
        />
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => {
              setNotes(initialNotes);
              setIsEditing(false);
            }}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs text-desk-muted hover:text-desk-text hover:bg-desk-hover rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Sauvegarder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      {notes ? (
        <div className="p-3 bg-desk-hover rounded-lg">
          <p className="text-sm text-desk-text whitespace-pre-wrap">{notes}</p>
        </div>
      ) : (
        <div className="p-3 bg-desk-hover rounded-lg text-center">
          <p className="text-sm text-desk-subtle italic">Aucune note de l&apos;expert...</p>
        </div>
      )}
      <button
        onClick={() => setIsEditing(true)}
        className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-desk-card text-desk-muted hover:text-amber-600 transition-all"
        title="Modifier les notes"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
