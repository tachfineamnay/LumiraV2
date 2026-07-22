'use client';

import { useState } from 'react';
import { Order } from '../types';
import { resolveDeskReadingSource } from '@/lib/desk-reading-source';
import {
  ArrowLeft,
  Sparkles,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Target,
  CloudSun,
  History,
  SlidersHorizontal,
} from 'lucide-react';

interface StepBriefingProps {
  order: Order;
  isGenerating: boolean;
  onLaunch: (expertPrompt: string, expertInstructions?: string) => void;
  onBack: () => void;
  onGoToBoard?: () => void;
}

const QUICK_TAGS = [
  {
    label: 'Approfondir le karmique',
    value: 'Approfondir particulièrement les aspects karmiques et les vies antérieures.',
  },
  {
    label: 'Focus mission de vie',
    value: "Mettre l'accent sur la mission de vie et le chemin d'âme.",
  },
  { label: 'Ton chaleureux', value: 'Adopter un ton particulièrement chaleureux et bienveillant.' },
  { label: 'Ton direct', value: "Être direct et sans détour, aller à l'essentiel." },
  { label: 'Focus relations', value: 'Approfondir les dynamiques relationnelles et affectives.' },
  {
    label: 'Focus carrière',
    value: "Mettre l'accent sur le parcours professionnel et la vocation.",
  },
  {
    label: 'Blocages émotionnels',
    value: 'Explorer en profondeur les blocages émotionnels et les peurs.',
  },
  {
    label: 'Rituels pratiques',
    value: 'Proposer des rituels très concrets et pratiques au quotidien.',
  },
];

const FOCUS_DOMAINS = [
  'Amour & Relations',
  'Carrière & Vocation',
  'Santé & Énergie',
  'Spiritualité',
  'Finances',
  'Famille',
  'Développement personnel',
  'Créativité',
];

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

const DELIVERY_STYLE_DISPLAY: Record<string, string> = {
  DOUX_ET_CLAIR: 'Doux et clair',
  DIRECT_ET_CONCRET: 'Direct et concret',
  SYMBOLIQUE_ET_PROFOND: 'Symbolique et profond',
};

export function StepBriefing({
  order,
  isGenerating,
  onLaunch,
  onBack,
  onGoToBoard,
}: StepBriefingProps) {
  const [expertPrompt, setExpertPrompt] = useState(order.expertPrompt || '');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const { user } = order;
  const readingSource = resolveDeskReadingSource(order);
  const profile = readingSource.profile;

  const toggleDomain = (domain: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain],
    );
  };

  const insertTag = (value: string) => {
    setExpertPrompt((prev) => {
      const separator = prev.trim() ? '\n' : '';
      return prev + separator + value;
    });
  };

  const handleLaunch = () => {
    let instructions: string | undefined;
    if (selectedDomains.length > 0) {
      instructions = `Domaines prioritaires : ${selectedDomains.join(', ')}`;
    }
    onLaunch(expertPrompt, instructions);
  };

  const canLaunch = expertPrompt.trim().length >= 10 && !isGenerating;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {isGenerating && (
        <div className="flex-shrink-0 border-b border-blue-500/30 bg-blue-500/5 px-4 py-3">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-desk-text">
                Production en cours pour {user.firstName}
              </p>
              <p className="mt-0.5 text-xs text-desk-muted">
                <Clock className="mr-1 inline h-3 w-3" />
                Estimation : 2 à 5 minutes — vous pouvez quitter, le job continue côté serveur.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onGoToBoard?.()}
                className="inline-flex min-h-10 items-center rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                Retour au board
              </button>
              <span className="inline-flex min-h-10 items-center rounded-lg border border-desk-border px-3 py-2 text-sm text-desk-muted">
                Rester sur la commande
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-3 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left column — Client summary (compact) */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-sm font-semibold text-desk-subtle uppercase tracking-wider mb-3">
                Résumé client
              </h3>

              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700">
                Source de lecture : {readingSource.source}
              </p>

              {/* Client card */}
              <div className="bg-desk-card border border-desk-border rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 
                                  flex items-center justify-center text-lg font-bold text-white"
                  >
                    {user.firstName?.[0]}
                    {user.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-desk-text">
                      {user.firstName} {user.lastName}
                    </p>
                    {profile?.usageName && (
                      <p className="text-xs text-amber-600">Appelé(e) « {profile.usageName} »</p>
                    )}
                    <p className="text-xs text-desk-subtle">{order.orderNumber}</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm">
                  {profile?.birthDate && (
                    <div className="flex items-center gap-2 text-desk-muted">
                      <Calendar className="w-3.5 h-3.5 text-desk-subtle" />
                      <span>{formatDate(profile.birthDate)}</span>
                      {profile?.birthTime && (
                        <span className="text-desk-subtle">à {profile.birthTime}</span>
                      )}
                    </div>
                  )}
                  {profile?.birthPlace && (
                    <div className="flex items-center gap-2 text-desk-muted">
                      <User className="w-3.5 h-3.5 text-desk-subtle" />
                      <span>{profile.birthPlace}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Question */}
              {profile?.specificQuestion && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                      Question
                    </span>
                  </div>
                  <p className="text-sm text-desk-muted italic leading-relaxed">
                    &quot;{profile.specificQuestion}&quot;
                  </p>
                </div>
              )}

              {/* Objective */}
              {profile?.objective && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      Objectif
                    </span>
                  </div>
                  <p className="text-sm text-desk-muted leading-relaxed">{profile.objective}</p>
                </div>
              )}

              {/* Emotional highlights */}
              {(profile?.highs || profile?.lows) && (
                <div className="bg-desk-card border border-desk-border rounded-xl p-4 space-y-3">
                  {profile?.highs && (
                    <div>
                      <span className="text-xs font-semibold text-emerald-600">✦ Points forts</span>
                      <p className="text-sm text-desk-muted mt-1 line-clamp-2">{profile.highs}</p>
                    </div>
                  )}
                  {profile?.lows && (
                    <div>
                      <span className="text-xs font-semibold text-amber-600">✦ Défis</span>
                      <p className="text-sm text-desk-muted mt-1 line-clamp-2">{profile.lows}</p>
                    </div>
                  )}
                </div>
              )}

              {profile?.fears && (
                <div className="bg-desk-card border border-desk-border rounded-xl p-4">
                  <span className="text-xs font-semibold text-red-500">✦ Peurs & Blocages</span>
                  <p className="text-sm text-desk-muted mt-1 line-clamp-3">{profile.fears}</p>
                </div>
              )}

              {/* Life weather declared by the client */}
              {profile?.lifeAreas && Object.keys(profile.lifeAreas).length > 0 && (
                <div className="bg-desk-card border border-desk-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CloudSun className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-semibold text-sky-600 uppercase tracking-wider">
                      Météo de vie
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(profile.lifeAreas).map(([key, entry]) => {
                      const state = LIFE_AREA_STATE_DISPLAY[entry.state] ?? {
                        label: entry.state,
                        className: 'bg-desk-hover text-desk-muted border-desk-border',
                      };
                      return (
                        <div key={key} className="text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-desk-muted">{LIFE_AREA_DISPLAY[key] ?? key}</span>
                            <span
                              className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${state.className}`}
                            >
                              {state.label}
                            </span>
                          </div>
                          {entry.note && (
                            <p className="mt-0.5 text-xs italic text-desk-subtle">
                              « {entry.note} »
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Marking life period */}
              {profile?.lifeEvents && (
                <div className="bg-desk-card border border-desk-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <History className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
                      Période marquante
                    </span>
                  </div>
                  <p className="text-sm text-desk-muted leading-relaxed line-clamp-4">
                    {profile.lifeEvents}
                  </p>
                </div>
              )}

              {/* Requested tone */}
              {(profile?.deliveryStyle || typeof profile?.pace === 'number') && (
                <div className="bg-desk-card border border-desk-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <SlidersHorizontal className="w-4 h-4 text-desk-muted" />
                    <span className="text-xs font-semibold text-desk-muted uppercase tracking-wider">
                      Restitution souhaitée
                    </span>
                  </div>
                  <p className="text-sm text-desk-muted">
                    {profile?.deliveryStyle
                      ? (DELIVERY_STYLE_DISPLAY[profile.deliveryStyle] ?? profile.deliveryStyle)
                      : 'Style non précisé'}
                    {typeof profile?.pace === 'number' && ` · Détail ${profile.pace}/100`}
                  </p>
                </div>
              )}
            </div>

            {/* Right column — Briefing area (2/3) */}
            <div className="lg:col-span-2 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-desk-text mb-1">Briefing Oracle</h2>
                <p className="text-sm text-desk-muted">
                  Guidez l&apos;Oracle avec vos instructions. Plus vous êtes précis, meilleure sera
                  la lecture.
                </p>
              </div>

              {/* Expert prompt textarea */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-desk-text">
                  Instructions pour l&apos;Oracle
                </label>
                <textarea
                  value={expertPrompt}
                  onChange={(e) => setExpertPrompt(e.target.value)}
                  placeholder="Ex: Ce client traverse une période de transition professionnelle importante. Insistez sur la mission de vie et les opportunités de transformation. Adoptez un ton encourageant mais lucide..."
                  rows={6}
                  className="w-full bg-desk-input border border-desk-border rounded-xl px-4 py-3
                             text-desk-text placeholder-desk-subtle text-sm leading-relaxed resize-none
                             focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50
                             transition-all"
                />
                <div className="flex justify-between text-xs">
                  <span
                    className={expertPrompt.length < 10 ? 'text-desk-subtle' : 'text-emerald-600'}
                  >
                    {expertPrompt.length < 10
                      ? `${10 - expertPrompt.length} caractères minimum restants`
                      : '✓ Prêt'}
                  </span>
                  <span className="text-desk-subtle">{expertPrompt.length} caractères</span>
                </div>
              </div>

              {/* Quick tags */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-desk-text">Tags rapides</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag.label}
                      onClick={() => insertTag(tag.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium
                                 bg-desk-card border border-desk-border text-desk-muted
                                 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-600
                                 transition-all"
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus domains */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-desk-text">Domaines prioritaires</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FOCUS_DOMAINS.map((domain) => (
                    <button
                      key={domain}
                      onClick={() => toggleDomain(domain)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                        selectedDomains.includes(domain)
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-600'
                          : 'bg-desk-card border border-desk-border text-desk-muted hover:bg-desk-hover hover:text-desk-text'
                      }`}
                    >
                      {domain}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex-shrink-0 px-3 sm:px-6 py-3 sm:py-4 bg-desk-surface border-t border-desk-border">
        <div className="max-w-6xl mx-auto flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl
                       text-desk-muted hover:text-desk-text hover:bg-desk-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Retour au dossier</span>
          </button>

          <button
            onClick={handleLaunch}
            disabled={!canLaunch}
            className="flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl
                       bg-gradient-to-r from-amber-500 to-amber-600
                       text-slate-900 font-semibold
                       hover:from-amber-400 hover:to-amber-500
                       hover:shadow-lg hover:shadow-amber-500/20
                       transition-all disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            <Sparkles className="w-5 h-5" />
            <span>Lancer l&apos;Oracle</span>
          </button>
        </div>
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
