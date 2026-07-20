'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, RefreshCw, Shield } from 'lucide-react';
import expertApi from '../../lib/expertApi';
import { PrivatePhotoLightbox } from './PrivatePhotoLightbox';

export type PrivatePhotoKind = 'face' | 'palm';

interface ExpertPrivatePhotoProps {
  clientId: string;
  kind: PrivatePhotoKind;
  alt: string;
  className?: string;
  aspectClassName?: string;
  onClick?: () => void;
}

type LoadState = 'loading' | 'ready' | 'missing' | 'error';

export function ExpertPrivatePhoto({
  clientId,
  kind,
  alt,
  className = '',
  aspectClassName = 'aspect-square',
  onClick,
}: ExpertPrivatePhotoProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const revokeCurrent = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++requestIdRef.current;
    setState('loading');
    revokeCurrent();
    setObjectUrl(null);

    expertApi
      .get(`/expert/clients/${clientId}/photos/${kind}`, { responseType: 'blob' })
      .then((response) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        const blob = response.data as Blob;
        if (!(blob instanceof Blob) || blob.size === 0) {
          setState('missing');
          return;
        }
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setObjectUrl(url);
        setState('ready');
      })
      .catch((error: { response?: { status?: number } }) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        const status = error?.response?.status;
        if (status === 404) setState('missing');
        else setState('error');
      });

    return () => {
      cancelled = true;
      revokeCurrent();
    };
  }, [clientId, kind, retryCount, revokeCurrent]);

  const retry = () => setRetryCount((value) => value + 1);

  if (state === 'missing') {
    return (
      <div
        className={`${aspectClassName} flex flex-col items-center justify-center rounded-lg border border-dashed border-desk-border bg-desk-card ${className}`}
      >
        <Camera className="mb-2 h-6 w-6 text-desk-muted" />
        <span className="text-xs text-desk-muted">Aucune photo</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {(state === 'loading' || state === 'error') && (
        <div
          className={`${aspectClassName} flex flex-col items-center justify-center gap-2 rounded-lg border border-desk-border bg-desk-card`}
        >
          {state === 'loading' ? (
            <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
          ) : (
            <>
              <Shield className="h-5 w-5 text-rose-500" />
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-1 rounded-md border border-desk-border px-2 py-1 text-xs text-desk-text hover:bg-desk-hover"
              >
                <RefreshCw className="h-3 w-3" /> Réessayer
              </button>
            </>
          )}
        </div>
      )}

      {state === 'ready' && objectUrl && (
        <button
          type="button"
          className={`group relative ${aspectClassName} w-full overflow-hidden rounded-lg border border-desk-border`}
          onClick={() => {
            onClick?.();
            setLightboxOpen(true);
          }}
          aria-label={alt}
        >
          <img
            src={objectUrl}
            alt={alt}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        </button>
      )}

      <PrivatePhotoLightbox
        open={lightboxOpen}
        src={objectUrl}
        alt={alt}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
