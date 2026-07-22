'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Pause, Play, Volume2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MysticAudioPlayerProps {
  /** Authenticated same-origin or short-lived audio URL. */
  audioUrl?: string | null;
  compact?: boolean;
  loadingText?: string;
  className?: string;
  /** `paper` adapts chrome for Sanctuaire dual-mode stages. */
  variant?: 'shell' | 'paper';
}

const SPEEDS = [0.8, 1, 1.25, 1.5] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

function resumeKey(audioUrl: string): string {
  return `lumira:audio-resume:${audioUrl}`;
}

export function MysticAudioPlayer({
  audioUrl,
  compact = false,
  loadingText = 'Audio indisponible pour le moment.',
  className,
  variant = 'shell',
}: MysticAudioPlayerProps) {
  const isPaper = variant === 'paper';
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPersistedSecond = useRef(-1);
  const volumeRef = useRef(1);
  const speedRef = useRef<(typeof SPEEDS)[number]>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [error, setError] = useState<string | null>(null);

  const isAvailable = Boolean(audioUrl);
  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  useEffect(() => {
    if (!audioUrl) {
      audioRef.current = null;
      setIsPlaying(false);
      setDuration(0);
      setCurrentTime(0);
      setError(null);
      return;
    }

    const audio = new Audio(audioUrl);
    audio.preload = 'metadata';
    audio.volume = volumeRef.current;
    audio.playbackRate = speedRef.current;
    audioRef.current = audio;
    lastPersistedSecond.current = -1;

    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      const saved = Number(window.localStorage.getItem(resumeKey(audioUrl)) || 0);
      if (Number.isFinite(saved) && saved > 0 && saved < audio.duration - 2) {
        audio.currentTime = saved;
        setCurrentTime(saved);
      }
    };
    const onTimeUpdate = () => {
      const second = Math.floor(audio.currentTime);
      setCurrentTime(audio.currentTime);
      if (second !== lastPersistedSecond.current) {
        lastPersistedSecond.current = second;
        window.localStorage.setItem(resumeKey(audioUrl), String(audio.currentTime));
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      window.localStorage.removeItem(resumeKey(audioUrl));
    };
    const onError = () => {
      setIsPlaying(false);
      setError('La lecture audio a rencontré un problème. Réessayez dans quelques instants.');
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      if (audio.currentTime > 0 && !audio.ended) {
        window.localStorage.setItem(resumeKey(audioUrl), String(audio.currentTime));
      }
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [audioUrl]);

  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    speedRef.current = speed;
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !isAvailable) return;
    setError(null);
    if (audio.paused) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
        setError('La lecture a été bloquée. Touchez à nouveau Lecture pour réessayer.');
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [isAvailable]);

  const seek = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const value = Math.min(Math.max(nextTime, 0), duration);
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const waveform = useMemo(
    () => Array.from({ length: compact ? 18 : 32 }, (_, index) => 30 + ((index * 37) % 60)),
    [compact],
  );

  if (!isAvailable) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border text-sm',
          isPaper
            ? 'border-paper-line bg-paper-muted text-paper-subtle'
            : 'border-white/[0.06] bg-abyss-800/50 text-stellar-500',
          compact ? 'p-2.5 text-[11px]' : 'p-4',
          className,
        )}
      >
        <Volume2 className={compact ? 'h-4 w-4' : 'h-5 w-5'} aria-hidden />
        <span>{loadingText}</span>
      </div>
    );
  }

  return (
    <div
      id="audio"
      className={cn(
        'rounded-xl border',
        isPaper
          ? 'border-paper-line bg-paper-elevated shadow-paper-soft'
          : 'border-white/[0.07] bg-abyss-800/60',
        compact ? 'p-2.5' : 'p-4',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Mettre l’audio en pause' : 'Lire l’audio'}
          className={cn(
            'grid shrink-0 place-items-center rounded-full bg-horizon-400 text-abyss-900 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-200',
            compact ? 'h-9 w-9' : 'h-12 w-12',
          )}
        >
          {isPlaying ? (
            <Pause className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
          ) : (
            <Play className={cn(compact ? 'ml-0.5 h-4 w-4' : 'ml-0.5 h-5 w-5')} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={currentTime}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Progression audio"
            className="h-2 w-full cursor-pointer accent-horizon-400"
          />
          {!compact && (
            <div className="mt-2 flex h-4 items-end gap-0.5" aria-hidden>
              {waveform.map((height, index) => (
                <span
                  key={index}
                  className={cn(
                    'flex-1 rounded-full',
                    (index / waveform.length) * 100 < progress
                      ? 'bg-horizon-400'
                      : isPaper
                        ? 'bg-paper-ink/10'
                        : 'bg-white/10',
                  )}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          )}
        </div>

        <span
          className={cn(
            'shrink-0 tabular-nums',
            isPaper ? 'text-paper-subtle' : 'text-stellar-400',
            compact ? 'text-[10px]' : 'text-xs',
          )}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {!compact && (
        <div
          className={cn(
            'mt-4 flex flex-wrap items-center gap-4 border-t pt-3',
            isPaper ? 'border-paper-line' : 'border-white/[0.05]',
          )}
        >
          <label
            className={cn(
              'flex items-center gap-2 text-xs',
              isPaper ? 'text-paper-subtle' : 'text-stellar-400',
            )}
          >
            <Volume2 className="h-4 w-4" aria-hidden />
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="Volume"
              className="w-24 accent-horizon-400"
            />
          </label>
          <label
            className={cn(
              'flex items-center gap-2 text-xs',
              isPaper ? 'text-paper-subtle' : 'text-stellar-400',
            )}
          >
            Vitesse
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value) as (typeof SPEEDS)[number])}
              className={cn(
                'rounded-lg border px-2 py-1',
                isPaper
                  ? 'border-paper-line bg-paper-muted text-paper-ink'
                  : 'border-white/10 bg-abyss-700 text-stellar-200',
              )}
            >
              {SPEEDS.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>
          <span className={cn('text-xs', isPaper ? 'text-paper-subtle' : 'text-stellar-600')}>
            La reprise est mémorisée sur cet appareil.
          </span>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className={cn(
            'mt-3 flex items-center gap-2 text-xs',
            isPaper ? 'text-rose-700' : 'text-rose-300',
          )}
        >
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
    </div>
  );
}
