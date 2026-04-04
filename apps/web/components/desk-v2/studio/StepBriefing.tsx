'use client';

import { useState } from 'react';
import { Order } from '../types';
import {
  ArrowLeft,
  Sparkles,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Target,
} from 'lucide-react';

interface StepBriefingProps {
  order: Order;
  isGenerating: boolean;
  onLaunch: (expertPrompt: string, expertInstructions?: string) => void;
  onBack: () => void;
}

const QUICK_TAGS = [
  { label: 'Approfondir le karmique', value: 'Approfondir particulièrement les aspects karmiques et les vies antérieures.' },
  { label: 'Focus mission de vie', value: 'Mettre l\'accent sur la mission de vie et le chemin d\'âme.' },
  { label: 'Ton chaleureux', value: 'Adopter un ton particulièrement chaleureux et bienveillant.' },
  { label: 'Ton direct', value: 'Être direct et sans détour, aller à l\'essentiel.' },
  { label: 'Focus relations', value: 'Approfondir les dynamiques relationnelles et affectives.' },
  { label: 'Focus carrière', value: 'Mettre l\'accent sur le parcours professionnel et la vocation.' },
  { label: 'Blocages émotionnels', value: 'Explorer en profondeur les blocages émotionnels et les peurs.' },
  { label: 'Rituels pratiques', value: 'Proposer des rituels très concrets et pratiques au quotidien.' },
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

export function StepBriefing({ order, isGenerating, onLaunch, onBack }: StepBriefingProps) {
  const [expertPrompt, setExpertPrompt] = useState(order.expertPrompt || '');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const { user } = order;
  const profile = user.profile;

  const toggleDomain = (domain: string) => {
    setSelectedDomains(prev =>
      prev.includes(domain) ? prev.filter(d => d !== domain) : [...prev, domain]
    );
  };

  const insertTag = (value: string) => {
    setExpertPrompt(prev => {
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

  const canLaunch = expertPrompt.trim().length >= 10;

  // Generation animation
  if (isGenerating) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="relative w-28 h-28 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-4 border-amber-500/30 animate-ping [animation-delay:200ms]" />
            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 
                            flex items-center justify-center shadow-xl shadow-amber-500/30">
              <Sparkles className="w-10 h-10 text-white animate-pulse" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">
            L&apos;Oracle crée la lecture...
          </h3>
          <p className="text-slate-400 mb-2">
            Analyse du profil de {user.firstName} en cours
          </p>
          <p className="text-xs text-slate-500">
            <Clock className="w-3 h-3 inline mr-1" />
            Estimation : 1 à 3 minutes
          </p>
          {expertPrompt && (
            <div className="mt-6 bg-slate-800/50 border border-white/5 rounded-xl p-4 text-left">
              <p className="text-xs text-amber-400 font-medium mb-1">Vos instructions</p>
              <p className="text-sm text-slate-400 line-clamp-3">{expertPrompt}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column — Client summary (compact) */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Résumé client
              </h3>

              {/* Client card */}
              <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 
                                  flex items-center justify-center text-lg font-bold text-white">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-slate-500">{order.orderNumber}</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-sm">
                  {profile?.birthDate && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDate(profile.birthDate)}</span>
                      {profile?.birthTime && <span className="text-slate-500">à {profile.birthTime}</span>}
                    </div>
                  )}
                  {profile?.birthPlace && (
                    <div className="flex items-center gap-2 text-slate-400">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>{profile.birthPlace}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Question */}
              {profile?.specificQuestion && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Question</span>
                  </div>
                  <p className="text-sm text-slate-300 italic leading-relaxed">
                    &quot;{profile.specificQuestion}&quot;
                  </p>
                </div>
              )}

              {/* Objective */}
              {profile?.objective && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Objectif</span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{profile.objective}</p>
                </div>
              )}

              {/* Emotional highlights */}
              {(profile?.highs || profile?.lows) && (
                <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4 space-y-3">
                  {profile?.highs && (
                    <div>
                      <span className="text-xs font-semibold text-emerald-400">✦ Points forts</span>
                      <p className="text-sm text-slate-400 mt-1 line-clamp-2">{profile.highs}</p>
                    </div>
                  )}
                  {profile?.lows && (
                    <div>
                      <span className="text-xs font-semibold text-amber-400">✦ Défis</span>
                      <p className="text-sm text-slate-400 mt-1 line-clamp-2">{profile.lows}</p>
                    </div>
                  )}
                </div>
              )}

              {profile?.fears && (
                <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                  <span className="text-xs font-semibold text-red-400">✦ Peurs & Blocages</span>
                  <p className="text-sm text-slate-400 mt-1 line-clamp-3">{profile.fears}</p>
                </div>
              )}
            </div>

            {/* Right column — Briefing area (2/3) */}
            <div className="lg:col-span-2 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Briefing Oracle</h2>
                <p className="text-sm text-slate-400">
                  Guidez l&apos;Oracle avec vos instructions. Plus vous êtes précis, meilleure sera la lecture.
                </p>
              </div>

              {/* Expert prompt textarea */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Instructions pour l&apos;Oracle
                </label>
                <textarea
                  value={expertPrompt}
                  onChange={(e) => setExpertPrompt(e.target.value)}
                  placeholder="Ex: Ce client traverse une période de transition professionnelle importante. Insistez sur la mission de vie et les opportunités de transformation. Adoptez un ton encourageant mais lucide..."
                  rows={6}
                  className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3
                             text-white placeholder-slate-500 text-sm leading-relaxed resize-none
                             focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50
                             transition-all"
                />
                <div className="flex justify-between text-xs">
                  <span className={expertPrompt.length < 10 ? 'text-slate-500' : 'text-emerald-400'}>
                    {expertPrompt.length < 10 ? `${10 - expertPrompt.length} caractères minimum restants` : '✓ Prêt'}
                  </span>
                  <span className="text-slate-500">{expertPrompt.length} caractères</span>
                </div>
              </div>

              {/* Quick tags */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Tags rapides</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TAGS.map(tag => (
                    <button
                      key={tag.label}
                      onClick={() => insertTag(tag.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium
                                 bg-slate-800/50 border border-white/10 text-slate-400
                                 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-400
                                 transition-all"
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus domains */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Domaines prioritaires</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FOCUS_DOMAINS.map(domain => (
                    <button
                      key={domain}
                      onClick={() => toggleDomain(domain)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all ${
                        selectedDomains.includes(domain)
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                          : 'bg-slate-800/50 border border-white/5 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
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
      <div className="flex-shrink-0 px-6 py-4 bg-slate-900/80 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl
                       text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Retour au dossier</span>
          </button>

          <button
            onClick={handleLaunch}
            disabled={!canLaunch}
            className="flex items-center gap-2 px-6 py-3 rounded-xl
                       bg-gradient-to-r from-amber-500 to-amber-600
                       text-slate-900 font-semibold
                       hover:from-amber-400 hover:to-amber-500
                       hover:shadow-lg hover:shadow-amber-500/20
                       transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
