'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Pause, Play, Volume2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MysticAudioPlayerProps {
  /** Authenticated same-origin or short-lived audio URL. */
  audioUrl?: string | null;
  compact?: boolean;
  loadingText?: string;
  className?: string;
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
}: MysticAudioPlayerProps) {
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
  const [isBuffering, setIsBuffering] = useState(false);

  const isAvailable = Boolean(audioUrl);
  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  useEffect(() => {
    if (!audioUrl) {
      audioRef.current = null;
      setIsPlaying(false);
      setDuration(0);
      setCurrentTime(0);
      setError(null);
      setIsBuffering(false);
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
    const onDurationChange = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const onTimeUpdate = () => {
      const second = Math.floor(audio.currentTime);
      setCurrentTime(audio.currentTime);
      if (second !== lastPersistedSecond.current) {
        lastPersistedSecond.current = second;
        window.localStorage.setItem(resumeKey(audioUrl), String(audio.currentTime));
      }
    };
    const onPlay = () => {
      setIsPlaying(true);
      setError(null);
    };
    const onPause = () => {
      if (!audio.ended) setIsPlaying(false);
    };
    const onPlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
      setError(null);
    };
    const onWaiting = () => setIsBuffering(true);
    const onStalled = () => setIsBuffering(true);
    const onSeeking = () => setIsBuffering(true);
    const onSeeked = () => setIsBuffering(false);
    const onRateChange = () => {
      const nextRate = audio.playbackRate;
      if (SPEEDS.includes(nextRate as (typeof SPEEDS)[number])) {
        setSpeed(nextRate as (typeof SPEEDS)[number]);
      }
    };
    const onVolumeChange = () => setVolume(audio.volume);
    const onEnded = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      setCurrentTime(0);
      window.localStorage.removeItem(resumeKey(audioUrl));
    };
    const onError = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      setError('La lecture audio a rencontré un problème. Réessayez dans quelques instants.');
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('seeking', onSeeking);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('ratechange', onRateChange);
    audio.addEventListener('volumechange', onVolumeChange);

    return () => {
      if (audio.currentTime > 0 && !audio.ended) {
        window.localStorage.setItem(resumeKey(audioUrl), String(audio.currentTime));
      }
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('seeking', onSeeking);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('ratechange', onRateChange);
      audio.removeEventListener('volumechange', onVolumeChange);
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
          'flex items-center gap-3 rounded-xl border border-white/[0.06] bg-abyss-800/50 text-stellar-500',
          compact ? 'p-2.5 text-[11px]' : 'p-4 text-sm',
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
      data-testid="audio-player"
      className={cn(
        'max-w-full overflow-hidden rounded-xl border border-white/[0.07] bg-abyss-800/60',
        compact ? 'p-2.5' : 'p-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Mettre l’audio en pause' : 'Lire l’audio'}
            className={cn(
              'grid shrink-0 place-items-center rounded-full bg-horizon-400 text-abyss-900 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-200',
              compact ? 'h-11 w-11' : 'h-12 w-12',
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
              className="h-10 w-full cursor-pointer accent-horizon-400"
            />
            {!compact && (
              <div className="mt-2 flex h-4 items-end gap-0.5" aria-hidden>
                {waveform.map((height, index) => (
                  <span
                    key={index}
                    className={cn(
                      'flex-1 rounded-full',
                      (index / waveform.length) * 100 < progress ? 'bg-horizon-400' : 'bg-white/10',
                    )}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <span
          className={cn(
            'shrink-0 self-end whitespace-nowrap tabular-nums text-stellar-400 min-[380px]:self-auto',
            compact ? 'text-[10px]' : 'text-xs',
          )}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {!compact && (
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 border-t border-white/[0.05] pt-3">
          <label className="flex min-w-0 items-center gap-2 text-xs text-stellar-400">
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
              className="h-10 w-24 max-w-[45vw] cursor-pointer accent-horizon-400"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-stellar-400">
            Vitesse
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value) as (typeof SPEEDS)[number])}
              className="rounded-lg border border-white/10 bg-abyss-700 px-2 py-1 text-base text-stellar-200 sm:text-xs"
            >
              {SPEEDS.map((value) => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>
          <span className="min-w-0 text-xs text-stellar-600">
            La reprise est mémorisée sur cet appareil.
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
      {isBuffering && !error && (
        <p role="status" className="mt-3 flex items-center gap-2 text-xs text-stellar-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement de l&apos;audio…
        </p>
      )}
    </div>
  );
}
