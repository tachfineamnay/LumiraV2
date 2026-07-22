'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Volume2, Check, Loader2 } from 'lucide-react';
import { PaperPanel } from '../../../../components/sanctuary/SanctuaireStage';
import sanctuaireApi from '../../../../lib/sanctuaireApi';

type VoiceOption = 'FEMININE' | 'MASCULINE';

export default function PreferencesPage() {
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>('FEMININE');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sanctuaireApi
      .get('/client/profile')
      .then((res) => {
        const voice = res.data?.profile?.preferredVoice;
        if (voice === 'MASCULINE' || voice === 'FEMININE') {
          setSelectedVoice(voice);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleVoiceChange = async (voice: VoiceOption) => {
    setSelectedVoice(voice);
    setSaving(true);
    setSaved(false);
    try {
      await sanctuaireApi.patch('/client/voice-preference', { voice });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSelectedVoice(selectedVoice);
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
    <div className="space-y-6">
      <div>
        <h2 className="font-playfair text-2xl italic text-paper-ink">Préférences</h2>
        <p className="mt-1 text-sm text-paper-subtle">
          Personnalisez votre expérience spirituelle.
        </p>
      </div>

      <PaperPanel>
        <h3 className="mb-2 flex items-center gap-2 font-playfair text-lg text-paper-ink">
          <Volume2 className="h-5 w-5 text-serenity-500" /> La Voix du Guide
        </h3>
        <p className="mb-6 text-sm text-paper-subtle">
          Choisissez la voix qui accompagnera vos lectures audio et méditations.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-paper-subtle">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Chargement...</span>
          </div>
        ) : (
          <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            {voices.map((voice) => {
              const isSelected = selectedVoice === voice.value;
              return (
                <button
                  key={voice.value}
                  type="button"
                  onClick={() => void handleVoiceChange(voice.value)}
                  disabled={saving}
                  className={`relative rounded-xl border p-5 text-left transition-all ${
                    isSelected
                      ? 'border-serenity-400/50 bg-serenity-200/20 ring-1 ring-serenity-400/25'
                      : 'border-paper-line bg-paper-elevated hover:border-horizon-500/30 hover:bg-paper-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span
                        className={`text-sm font-medium ${
                          isSelected ? 'text-serenity-600' : 'text-paper-ink'
                        }`}
                      >
                        {voice.label}
                      </span>
                      <p className="mt-1 text-xs leading-5 text-paper-subtle">
                        {voice.description}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-serenity-500 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {(saving || saved) && (
          <p className="mt-4 text-xs text-paper-subtle">
            {saving ? 'Enregistrement…' : 'Préférence enregistrée.'}
          </p>
        )}
      </PaperPanel>
    </div>
  );
}
