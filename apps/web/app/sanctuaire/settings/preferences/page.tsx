'use client';

export const dynamic = 'force-dynamic';

import React, { useCallback, useEffect, useState } from 'react';
import { Volume2, Check, Loader2 } from 'lucide-react';
import { GlassCard } from '../../../../components/ui/GlassCard';
import sanctuaireApi from '../../../../lib/sanctuaireApi';

type VoiceOption = 'FEMININE' | 'MASCULINE';

export default function PreferencesPage() {
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>('FEMININE');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load current preference
  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await sanctuaireApi.get('/client/profile');
        const voice = res.data?.profile?.preferredVoice;
        if (voice === 'MASCULINE' || voice === 'FEMININE') {
          setSelectedVoice(voice);
        }
    } catch {
      setLoadError('Les préférences ne peuvent pas être chargées pour le moment.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const handleVoiceChange = async (voice: VoiceOption) => {
    const previousVoice = selectedVoice;
    setSelectedVoice(voice);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await sanctuaireApi.patch('/client/voice-preference', { voice });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSelectedVoice(previousVoice);
      setError('La préférence n’a pas pu être enregistrée. Votre choix précédent est conservé.');
    } finally {
      setSaving(false);
    }
  };

  const voices: { value: VoiceOption; label: string; description: string }[] = [
    {
      value: 'FEMININE',
      label: 'Voix Féminine',
      description: 'Douce et enveloppante, idéale pour la méditation',
    },
    {
      value: 'MASCULINE',
      label: 'Voix Masculine',
      description: 'Grave et apaisante, pour une écoute profonde',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-playfair italic text-ivoire-100">Préférences</h2>
        <p className="text-brume-200 text-sm">Personnalisez votre expérience spirituelle.</p>
      </div>

      {/* VOICE PREFERENCE */}
      <GlassCard className="p-8">
        <h3 className="text-lg font-playfair text-ivoire-100 mb-2 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-serenity-400" /> La Voix du Guide
        </h3>
        <p className="text-brume-200 text-sm mb-6">
          Choisissez la voix qui accompagnera vos lectures audio et méditations.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-brume-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Chargement...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            {voices.map((voice) => {
              const isSelected = selectedVoice === voice.value;
              return (
                <button
                  key={voice.value}
                  onClick={() => handleVoiceChange(voice.value)}
                  disabled={saving}
                  aria-pressed={isSelected}
                  className={`relative min-h-[96px] p-5 rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-serenity-300 ${
                    isSelected
                      ? 'bg-serenity-500/10 border-serenity-400/40 ring-1 ring-serenity-400/20'
                      : 'bg-brume-800/20 border-ivoire-500/[0.08] hover:border-ivoire-500/[0.12] hover:bg-brume-800/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span
                        className={`text-sm font-medium ${isSelected ? 'text-serenity-300' : 'text-ivoire-200'}`}
                      >
                        {voice.label}
                      </span>
                      <p className="text-xs text-brume-300 mt-1">{voice.description}</p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-serenity-400/20 flex items-center justify-center flex-shrink-0 ml-2">
                        {saving ? (
                          <Loader2 className="w-3 h-3 text-serenity-400 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3 text-serenity-400" />
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100"
          >
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => void loadPreferences()}
              className="inline-flex min-h-[40px] items-center rounded-lg px-3 text-sm font-semibold text-rose-100 hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            >
              Réessayer
            </button>
          </div>
        )}

        {saved && (
          <p role="status" className="text-serenity-400 text-xs mt-4 flex items-center gap-1">
            <Check className="w-3 h-3" /> Préférence enregistrée
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm text-rose-100"
          >
            {error}
          </p>
        )}

        <p className="text-brume-400 text-xs mt-4">
          Ce choix s&apos;appliquera à vos prochaines lectures générées.
        </p>
      </GlassCard>
    </div>
  );
}
