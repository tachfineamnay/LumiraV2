'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Loader2, RefreshCw, Shield } from 'lucide-react';
import { PrivatePhotoLightbox } from './PrivatePhotoLightbox';

export type PrivatePhotoKind = 'face' | 'palm';

interface SanctuairePrivatePhotoProps {
  kind: PrivatePhotoKind;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  /** Bump to force a reload after a photo replacement. */
  refreshKey?: string | number;
  onClick?: () => void;
}

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

export function SanctuairePrivatePhoto({
  kind,
  alt,
  className = '',
  fallback,
  refreshKey,
  onClick,
}: SanctuairePrivatePhotoProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const src = `/api/bff/users/profile/photos/${kind}?v=${encodeURIComponent(String(refreshKey ?? 0))}&r=${retryCount}`;

  useEffect(() => {
    setState('loading');
  }, [kind, refreshKey, retryCount]);

  const handleLoad = useCallback(() => setState('ready'), []);
  const handleError = useCallback(() => {
    // <img> does not expose HTTP status; probe once with credentials.
    void fetch(`/api/bff/users/profile/photos/${kind}`, { credentials: 'include' })
      .then((response) => {
        if (response.status === 404) setState('missing');
        else setState('error');
      })
      .catch(() => setState('error'));
  }, [kind]);

  const retry = () => setRetryCount((value) => value + 1);

  if (state === 'missing') {
    return (
      <div className={className}>
        {fallback ?? (
          <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-horizon-400/30 bg-abyss-500/30">
            <Camera className="mb-3 h-10 w-10 text-horizon-400/50" />
            <span className="text-sm text-stellar-500">Aucune photo</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {(state === 'loading' || state === 'error') && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-abyss-600/80">
          {state === 'loading' ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-horizon-300" />
              <span className="text-xs text-stellar-400">Chargement…</span>
            </>
          ) : (
            <>
              <Shield className="h-6 w-6 text-rose-300" />
              <span className="text-xs text-stellar-300">Photo indisponible</span>
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-xs text-stellar-200 hover:bg-white/5"
              >
                <RefreshCw className="h-3 w-3" /> Réessayer
              </button>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl"
        onClick={() => {
          if (state !== 'ready') return;
          onClick?.();
          setLightboxOpen(true);
        }}
        disabled={state !== 'ready'}
        aria-label={alt}
      >
        {/* Cookie-authenticated same-origin stream — never an s3:// reference. */}
        <img
          src={src}
          alt={alt}
          className={`h-full w-full object-cover transition-opacity ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          onError={handleError}
        />
        {state === 'ready' && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-abyss-800/70 to-transparent pb-4 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
            <span className="text-xs text-stellar-200">Appuyez pour agrandir</span>
          </div>
        )}
      </button>

      <PrivatePhotoLightbox
        open={lightboxOpen}
        src={state === 'ready' ? src : null}
        alt={alt}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
