'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MysticAudioPlayerProps {
    /** S3 audio URL (null = loading state) */
    audioUrl?: string | null;
    /** Compact mode for InsightCards */
    compact?: boolean;
    /** Loading message override */
    loadingText?: string;
    /** Custom class name */
    className?: string;
}

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function MysticAudioPlayer({
    audioUrl,
    compact = false,
    loadingText = 'Matérialisation vocale en cours...',
    className,
}: MysticAudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);

    // Generate stable waveform bars
    const waveformBars = useMemo(
        () => Array.from({ length: compact ? 24 : 40 }, (_, i) => {
            // Deterministic pseudo-random based on index
            const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
            return (x - Math.floor(x)) * 100;
        }),
        [compact],
    );

    const isAvailable = !!audioUrl;

    // Create/destroy audio element
    useEffect(() => {
        if (!audioUrl) {
            audioRef.current = null;
            setIsPlaying(false);
            setProgress(0);
            setDuration(0);
            setCurrentTime(0);
            setIsLoaded(false);
            return;
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        const onLoadedMetadata = () => {
            setDuration(audio.duration);
            setIsLoaded(true);
        };
        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            if (audio.duration > 0) {
                setProgress((audio.currentTime / audio.duration) * 100);
            }
        };
        const onEnded = () => {
            setIsPlaying(false);
            setProgress(0);
            setCurrentTime(0);
        };
        const onError = () => {
            setIsPlaying(false);
            setIsLoaded(false);
        };

        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);
        audio.preload = 'metadata';

        return () => {
            audio.pause();
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audioRef.current = null;
        };
    }, [audioUrl]);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio || !isAvailable) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().then(() => setIsPlaying(true)).catch(() => {});
        }
    }, [isPlaying, isAvailable]);

    const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !isAvailable || !audio.duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = clickX / rect.width;
        audio.currentTime = pct * audio.duration;
    }, [isAvailable]);

    // Loading state: no audioUrl yet
    if (!isAvailable) {
        return (
            <div className={cn(
                'flex items-center gap-3 rounded-xl bg-abyss-800/50 border border-white/5',
                compact ? 'p-2.5' : 'p-4',
                className,
            )}>
                <div className={cn(
                    'flex-shrink-0 rounded-full flex items-center justify-center bg-white/5',
                    compact ? 'w-8 h-8' : 'w-12 h-12',
                )}>
                    <Loader2 className={cn('animate-spin text-horizon-400/50', compact ? 'w-4 h-4' : 'w-5 h-5')} />
                </div>
                <span className={cn('text-stellar-500 italic', compact ? 'text-[11px]' : 'text-xs')}>
                    {loadingText}
                </span>
            </div>
        );
    }

    return (
        <div className={cn(
            'flex items-center gap-3 rounded-xl bg-abyss-800/50 border border-white/5',
            compact ? 'p-2.5' : 'p-4',
            className,
        )}>
            {/* Play/Pause Button */}
            <button
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Lecture'}
                className={cn(
                    'flex-shrink-0 rounded-full flex items-center justify-center transition-all',
                    'bg-horizon-400 text-abyss-900 hover:bg-horizon-300 hover:scale-105',
                    compact ? 'w-8 h-8' : 'w-12 h-12',
                )}
            >
                {isPlaying
                    ? <Pause className={compact ? 'w-3.5 h-3.5' : 'w-5 h-5'} />
                    : <Play className={cn(compact ? 'w-3.5 h-3.5' : 'w-5 h-5', 'ml-0.5')} />
                }
            </button>

            {/* Waveform Visualization */}
            <div
                className={cn('flex-1 flex items-end gap-[2px] cursor-pointer', compact ? 'h-6' : 'h-10')}
                onClick={handleWaveformClick}
                role="slider"
                aria-label="Progression audio"
                aria-valuenow={Math.round(progress)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
            >
                {waveformBars.map((height, i) => {
                    const barProgress = (i / waveformBars.length) * 100;
                    return (
                        <div
                            key={i}
                            className={cn(
                                'flex-1 rounded-full transition-colors',
                                barProgress < progress ? 'bg-horizon-400' : 'bg-white/10',
                            )}
                            style={{ height: `${Math.max(20, height)}%` }}
                        />
                    );
                })}
            </div>

            {/* Time / Duration */}
            <div className={cn('flex-shrink-0 flex items-center gap-1.5', compact ? 'text-[10px]' : 'text-xs', 'text-stellar-400')}>
                <Volume2 className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                <span>
                    {isLoaded ? `${formatTime(currentTime)} / ${formatTime(duration)}` : '--:--'}
                </span>
            </div>
        </div>
    );
}
