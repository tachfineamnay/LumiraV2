'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import Image from 'next/image';
import { Camera, Check, ImagePlus, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';

export type PhotoUploadState = 'idle' | 'preparing' | 'uploading' | 'saved' | 'error';

interface SmartPhotoUploaderProps {
  label: string;
  description: string;
  value?: string;
  onChange: (storageRefOrPreview: string | null) => void;
  /** Uploads a compressed browser preview and returns its private storage reference. */
  uploadPhoto?: (previewDataUrl: string) => Promise<string>;
  onUploadStateChange?: (state: PhotoUploadState) => void;
  captureFacingMode?: 'user' | 'environment';
  className?: string;
  compact?: boolean;
  /** Same-origin preview endpoint for an already persisted private reference. */
  privatePreviewUrl?: string;
  privatePreviewNode?: React.ReactNode;
}

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("La photo n'a pas pu être lue."));
    reader.readAsDataURL(file);
  });
}

async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choisissez un fichier image.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Cette image est trop volumineuse. Choisissez une photo de moins de 20 Mo.');
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.9,
  });
  return readAsDataUrl(compressed);
}

export const SmartPhotoUploader = ({
  label,
  description,
  value,
  onChange,
  uploadPhoto,
  onUploadStateChange,
  captureFacingMode = 'environment',
  className = '',
  compact = false,
  privatePreviewUrl,
  privatePreviewNode,
}: SmartPhotoUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef(0);
  const uploadStateCallbackRef = useRef(onUploadStateChange);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [retryPreview, setRetryPreview] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<PhotoUploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [privatePreviewFailed, setPrivatePreviewFailed] = useState(false);

  useEffect(() => {
    uploadStateCallbackRef.current = onUploadStateChange;
  }, [onUploadStateChange]);

  useEffect(() => {
    uploadStateCallbackRef.current?.(uploadState);
  }, [uploadState]);

  useEffect(() => {
    setPrivatePreviewFailed(false);
  }, [privatePreviewUrl, value]);

  const persistPreview = useCallback(
    async (preview: string, existingAttempt?: number) => {
      const attempt = existingAttempt ?? ++attemptRef.current;
      setLocalPreview(preview);
      setRetryPreview(preview);
      setError(null);

      if (!uploadPhoto) {
        onChange(preview);
        setUploadState('saved');
        return;
      }

      setUploadState('uploading');
      try {
        const storageRef = await uploadPhoto(preview);
        if (attempt !== attemptRef.current) return;
        onChange(storageRef);
        setRetryPreview(null);
        setUploadState('saved');
      } catch (uploadError) {
        if (attempt !== attemptRef.current) return;
        setUploadState('error');
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "L'envoi privé de la photo a échoué. Réessayez.",
        );
      }
    },
    [onChange, uploadPhoto],
  );

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const attempt = ++attemptRef.current;
      setUploadState('preparing');
      setError(null);
      try {
        const preview = await preparePhoto(file);
        if (attempt !== attemptRef.current) return;
        await persistPreview(preview, attempt);
      } catch (preparationError) {
        if (attempt !== attemptRef.current) return;
        setUploadState('error');
        setError(
          preparationError instanceof Error
            ? preparationError.message
            : "Cette photo n'a pas pu être préparée.",
        );
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
      }
    },
    [persistPreview],
  );

  const handleRemove = useCallback(() => {
    attemptRef.current += 1;
    setLocalPreview(null);
    setRetryPreview(null);
    setError(null);
    setUploadState('idle');
    onChange(null);
  }, [onChange]);

  const retry = useCallback(() => {
    if (retryPreview) void persistPreview(retryPreview);
  }, [persistPreview, retryPreview]);

  const isBusy = uploadState === 'preparing' || uploadState === 'uploading';
  const isPrivateStorageReference = Boolean(value?.startsWith('s3://onboarding/'));
  const hasPhoto = Boolean(localPreview || value);
  const statusText =
    uploadState === 'preparing'
      ? 'Préparation de la photo…'
      : uploadState === 'uploading'
        ? 'Enregistrement privé…'
        : uploadState === 'saved'
          ? 'Photo enregistrée dans votre brouillon privé'
          : isPrivateStorageReference
            ? 'Photo présente dans votre brouillon privé'
            : null;

  return (
    <section
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 sm:p-4 ${className}`}
      aria-label={label}
    >
      <input
        ref={fileInputRef}
        type="file"
        tabIndex={-1}
        accept="image/*"
        onChange={(event) => void processFile(event.target.files?.[0])}
        aria-label={`Choisir une photo pour ${label.toLowerCase()}`}
        className="sr-only"
      />
      <input
        ref={cameraInputRef}
        type="file"
        tabIndex={-1}
        accept="image/*"
        capture={captureFacingMode}
        onChange={(event) => void processFile(event.target.files?.[0])}
        aria-label={`Prendre une photo pour ${label.toLowerCase()}`}
        className="sr-only"
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stellar-100">{label}</h3>
          <p className="mt-1 text-xs leading-5 text-stellar-500">{description}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" /> Privée
        </span>
      </div>

      {hasPhoto ? (
        <div className="mt-3">
          <div
            className={`relative overflow-hidden rounded-xl border border-horizon-400/25 bg-abyss-700/70 ${
              compact ? 'aspect-square' : 'aspect-[4/3]'
            }`}
          >
            {localPreview ? (
              <Image
                src={localPreview}
                alt={`Aperçu — ${label}`}
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, 360px"
                className="h-full w-full object-cover"
              />
            ) : isPrivateStorageReference ? (
              privatePreviewNode ? (
                privatePreviewNode
              ) : privatePreviewUrl && !privatePreviewFailed ? (
                <Image
                  src={privatePreviewUrl}
                  alt={`Aperçu privé — ${label}`}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 360px"
                  className="h-full w-full object-cover"
                  onError={() => setPrivatePreviewFailed(true)}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-emerald-300">
                  <Check className="h-7 w-7" />
                  <span className="text-xs font-medium">Photo enregistrée de façon privée</span>
                </div>
              )
            ) : (
              <Image
                src={value || ''}
                alt={`Aperçu — ${label}`}
                fill
                unoptimized
                sizes="(max-width: 640px) 100vw, 360px"
                className="h-full w-full object-cover"
              />
            )}

            {isBusy && (
              <div className="absolute inset-0 grid place-items-center bg-abyss-900/75 backdrop-blur-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-abyss-700 px-3 py-2 text-xs text-stellar-200">
                  <Loader2 className="h-4 w-4 animate-spin" /> {statusText}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-3 py-2 text-xs font-medium text-stellar-200 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" /> Remplacer
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isBusy}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-rose-400/20 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Retirer
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-white/[0.12] bg-abyss-700/35 p-4 text-center">
          <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-horizon-400/10 text-horizon-300">
            <Camera className="h-5 w-5" />
          </span>
          <p className="mt-3 text-xs leading-5 text-stellar-500">
            JPEG, PNG ou WebP · compression automatique · 1,2 Mo maximum après préparation
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-3 py-2 text-xs font-medium text-stellar-200 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:opacity-50"
            >
              {uploadState === 'preparing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              Choisir
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isBusy}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-horizon-400/12 px-3 py-2 text-xs font-medium text-horizon-200 hover:bg-horizon-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" /> Prendre
            </button>
          </div>
        </div>
      )}

      {statusText && !isBusy && !error && (
        <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300" role="status">
          <Check className="h-4 w-4" /> {statusText}
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3" role="alert">
          <p className="text-xs leading-5 text-rose-100">{error}</p>
          {retryPreview && (
            <button
              type="button"
              onClick={retry}
              className="mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-xs font-semibold text-rose-100 hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            >
              <RefreshCw className="h-4 w-4" /> Réessayer l’envoi
            </button>
          )}
        </div>
      )}
    </section>
  );
};
