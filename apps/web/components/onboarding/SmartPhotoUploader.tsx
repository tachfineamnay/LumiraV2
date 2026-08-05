'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import Image from 'next/image';
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { uploadOriginalOnboardingPhoto } from '../../lib/onboarding-upload';

export type PhotoUploadState = 'idle' | 'preparing' | 'uploading' | 'saved' | 'error';

type PhotoKind = 'FACE' | 'PALM';

interface SmartPhotoUploaderProps {
  label: string;
  description: string;
  value?: string;
  onChange: (storageRefOrPreview: string | null) => void;
  /** Legacy fallback for generic usages that cannot be inferred as face or palm. */
  uploadPhoto?: (previewDataUrl: string) => Promise<string>;
  onUploadStateChange?: (state: PhotoUploadState) => void;
  captureFacingMode?: 'user' | 'environment';
  className?: string;
  compact?: boolean;
  /** Same-origin preview endpoint for an already persisted private reference. */
  privatePreviewUrl?: string;
  privatePreviewNode?: React.ReactNode;
}

const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const ACCEPTED_PHOTO_FORMATS = 'image/*,.heic,.heif,.tif,.tiff,.avif,.bmp,.gif';

function inferPhotoKind(label: string, facingMode: 'user' | 'environment'): PhotoKind | null {
  const normalized = label.toLocaleLowerCase('fr-FR');
  if (normalized.includes('visage') || normalized.includes('face')) return 'FACE';
  if (
    normalized.includes('paume') ||
    normalized.includes('palm') ||
    normalized.includes('main')
  ) {
    return 'PALM';
  }
  if (facingMode === 'user') return 'FACE';
  return null;
}

function prefersNativeCameraInput(): boolean {
  if (typeof navigator === 'undefined') return true;
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const isIpadOs = navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.userAgent);
  return isMobileUa || isIpadOs || !navigator.mediaDevices?.getUserMedia;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("La photo n'a pas pu être lue."));
    reader.readAsDataURL(file);
  });
}

function responseMessage(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { message?: string | string[] } } })
    ?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  if (response?.status === 413) return 'La photo source dépasse 30 Mo.';
  if (error instanceof Error && error.message) return error.message;
  return "Cette image n'a pas pu être préparée. Elle est peut-être corrompue.";
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
  const sectionRef = useRef<HTMLElement>(null);
  const requiredInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef(0);
  const retryFileRef = useRef<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const uploadStateCallbackRef = useRef(onUploadStateChange);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [uploadState, setUploadState] = useState<PhotoUploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [requiredError, setRequiredError] = useState<string | null>(null);
  const [requiredByReadingIntake, setRequiredByReadingIntake] = useState(false);
  const [privatePreviewFailed, setPrivatePreviewFailed] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const inferredKind = inferPhotoKind(label, captureFacingMode);
  const isPrivateStorageReference = Boolean(value?.startsWith('s3://onboarding/'));

  useEffect(() => {
    setRequiredByReadingIntake(Boolean(sectionRef.current?.closest('#dossier-preparation')));
  }, []);

  useEffect(() => {
    const input = requiredInputRef.current;
    if (!input) return;
    if (!requiredByReadingIntake || isPrivateStorageReference) {
      input.setCustomValidity('');
      setRequiredError(null);
      return;
    }
    input.setCustomValidity(
      inferredKind === 'FACE'
        ? 'Ajoutez et enregistrez une photo du visage avant de continuer.'
        : 'Ajoutez et enregistrez une photo de la paume avant de continuer.',
    );
  }, [inferredKind, isPrivateStorageReference, requiredByReadingIntake]);

  useEffect(() => {
    uploadStateCallbackRef.current = onUploadStateChange;
  }, [onUploadStateChange]);

  useEffect(() => {
    uploadStateCallbackRef.current?.(uploadState);
  }, [uploadState]);

  useEffect(() => {
    setPrivatePreviewFailed(false);
  }, [privatePreviewUrl, value]);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const setFilePreview = useCallback(
    (file: File) => {
      revokeObjectUrl();
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setLocalPreview(url);
      setPreviewFailed(false);
    },
    [revokeObjectUrl],
  );

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const attempt = ++attemptRef.current;
      retryFileRef.current = file;
      setUploadState('preparing');
      setError(null);
      setRequiredError(null);
      setFilePreview(file);

      try {
        if (!file.size) throw new Error('Le fichier image est vide.');
        if (file.size > MAX_SOURCE_BYTES) {
          throw new Error('Cette photo dépasse 30 Mo.');
        }

        const photoKind = inferPhotoKind(label, captureFacingMode);
        if (photoKind) {
          setUploadState('uploading');
          const storageRef = await uploadOriginalOnboardingPhoto(file, photoKind);
          if (attempt !== attemptRef.current) return;
          onChange(storageRef);
          retryFileRef.current = null;
          setUploadState('saved');
          return;
        }

        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          fileType: 'image/jpeg',
          initialQuality: 0.9,
        });
        const preview = await readAsDataUrl(compressed);
        if (attempt !== attemptRef.current) return;

        revokeObjectUrl();
        setLocalPreview(preview);
        setPreviewFailed(false);

        if (uploadPhoto) {
          setUploadState('uploading');
          const storageRef = await uploadPhoto(preview);
          if (attempt !== attemptRef.current) return;
          onChange(storageRef);
        } else {
          onChange(preview);
        }
        retryFileRef.current = null;
        setUploadState('saved');
      } catch (processingError) {
        if (attempt !== attemptRef.current) return;
        setUploadState('error');
        setError(responseMessage(processingError));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
      }
    },
    [captureFacingMode, label, onChange, revokeObjectUrl, setFilePreview, uploadPhoto],
  );

  const retry = useCallback(() => {
    if (retryFileRef.current) void processFile(retryFileRef.current);
  }, [processFile]);

  const handleRemove = useCallback(() => {
    attemptRef.current += 1;
    retryFileRef.current = null;
    revokeObjectUrl();
    setLocalPreview(null);
    setPreviewFailed(false);
    setError(null);
    setUploadState('idle');
    onChange(null);
  }, [onChange, revokeObjectUrl]);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const closeWebcam = useCallback(() => {
    stopWebcam();
    setIsCameraOpen(false);
    setIsCameraStarting(false);
    setCameraError(null);
  }, [stopWebcam]);

  useEffect(() => {
    return () => {
      stopWebcam();
      revokeObjectUrl();
    };
  }, [revokeObjectUrl, stopWebcam]);

  useEffect(() => {
    if (!isCameraOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeWebcam();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeWebcam, isCameraOpen]);

  const openCamera = useCallback(async () => {
    if (prefersNativeCameraInput()) {
      cameraInputRef.current?.click();
      return;
    }

    setCameraError(null);
    setIsCameraOpen(true);
    setIsCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: captureFacingMode,
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (cameraOpenError) {
      stopWebcam();
      const denied =
        cameraOpenError instanceof DOMException &&
        (cameraOpenError.name === 'NotAllowedError' ||
          cameraOpenError.name === 'PermissionDeniedError');
      setCameraError(
        denied
          ? 'L’accès à la caméra a été refusé. Autorisez-la ou choisissez une photo.'
          : 'La caméra n’est pas disponible. Choisissez une photo existante.',
      );
    } finally {
      setIsCameraStarting(false);
    }
  }, [captureFacingMode, stopWebcam]);

  const captureFromWebcam = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    closeWebcam();
    if (!blob) {
      setError("La photo n'a pas pu être capturée. Réessayez.");
      setUploadState('error');
      return;
    }
    await processFile(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  }, [closeWebcam, processFile]);

  const isBusy = uploadState === 'preparing' || uploadState === 'uploading';
  const hasPhoto = Boolean(localPreview || value);
  const statusText =
    uploadState === 'preparing'
      ? 'Analyse du format…'
      : uploadState === 'uploading'
        ? 'Conversion et enregistrement privé…'
        : uploadState === 'saved'
          ? 'Photo convertie et enregistrée en privé'
          : isPrivateStorageReference
            ? 'Photo présente dans votre dossier privé'
            : null;

  const previewContent = localPreview && !previewFailed ? (
    <Image
      src={localPreview}
      alt={`Aperçu — ${label}`}
      fill
      unoptimized
      sizes="(max-width: 640px) 100vw, 360px"
      className="h-full w-full object-cover"
      onError={() => setPreviewFailed(true)}
    />
  ) : isPrivateStorageReference && privatePreviewNode ? (
    privatePreviewNode
  ) : isPrivateStorageReference && privatePreviewUrl && !privatePreviewFailed ? (
    <Image
      src={privatePreviewUrl}
      alt={`Aperçu privé — ${label}`}
      fill
      unoptimized
      sizes="(max-width: 640px) 100vw, 360px"
      className="h-full w-full object-cover"
      onError={() => setPrivatePreviewFailed(true)}
    />
  ) : value && !isPrivateStorageReference && !previewFailed ? (
    <Image
      src={value}
      alt={`Aperçu — ${label}`}
      fill
      unoptimized
      sizes="(max-width: 640px) 100vw, 360px"
      className="h-full w-full object-cover"
      onError={() => setPreviewFailed(true)}
    />
  ) : (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-emerald-300">
      <Check className="h-7 w-7" />
      <span className="text-xs font-medium">
        {isBusy ? 'Préparation en cours' : 'Photo enregistrée de façon privée'}
      </span>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      className={`rounded-2xl border bg-white/[0.025] p-3 sm:p-4 ${
        requiredError ? 'border-rose-400/50' : 'border-white/[0.08]'
      } ${className}`}
      aria-label={label}
    >
      {requiredByReadingIntake && (
        <input
          ref={requiredInputRef}
          type="text"
          required
          readOnly
          value={isPrivateStorageReference ? value : ''}
          name={`required-${(inferredKind ?? label).toLowerCase()}`}
          aria-label={`${label} obligatoire`}
          aria-describedby={requiredError ? `${label}-required-error` : undefined}
          className="sr-only"
          onInvalid={(event) => {
            event.preventDefault();
            const message =
              inferredKind === 'FACE'
                ? 'Ajoutez et enregistrez une photo du visage avant de continuer.'
                : 'Ajoutez et enregistrez une photo de la paume avant de continuer.';
            setRequiredError(message);
            window.requestAnimationFrame(() => {
              sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              requiredInputRef.current?.focus({ preventScroll: true });
            });
          }}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        tabIndex={-1}
        accept={ACCEPTED_PHOTO_FORMATS}
        onChange={(event) => void processFile(event.target.files?.[0])}
        aria-label={`Choisir une photo pour ${label.toLowerCase()}`}
        className="sr-only"
      />
      <input
        ref={cameraInputRef}
        type="file"
        tabIndex={-1}
        accept={ACCEPTED_PHOTO_FORMATS}
        capture={captureFacingMode}
        onChange={(event) => void processFile(event.target.files?.[0])}
        aria-label={`Prendre une photo pour ${label.toLowerCase()}`}
        className="sr-only"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-stellar-100">
            {label}
            {requiredByReadingIntake && <span className="ml-1 text-horizon-300">*</span>}
          </h3>
          <p className="mt-1 text-xs leading-5 text-stellar-500">{description}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" /> Privée
        </span>
      </div>

      {hasPhoto ? (
        <div className="mt-3">
          <div
            className={`relative overflow-hidden rounded-xl border border-horizon-400/25 bg-abyss-700/70 ${compact ? 'aspect-square' : 'aspect-[4/3]'}`}
          >
            {previewContent}
            {isBusy && (
              <div className="absolute inset-0 grid place-items-center bg-abyss-900/75 p-3 backdrop-blur-sm">
                <span className="inline-flex items-center gap-2 rounded-full bg-abyss-700 px-3 py-2 text-center text-xs text-stellar-200">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> {statusText}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] px-2 py-2 text-xs font-medium text-stellar-200 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" /> Remplacer
            </button>
            <button
              type="button"
              onClick={() => void openCamera()}
              disabled={isBusy}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-horizon-400/25 px-2 py-2 text-xs font-medium text-horizon-200 hover:bg-horizon-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" /> Reprendre
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isBusy}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-rose-400/20 px-2 py-2 text-xs font-medium text-rose-200 hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-50"
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
            Tous formats photo courants · HEIC, HEIF, TIFF, AVIF, GIF, BMP, PNG, WebP, JPEG · 30 Mo max
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
              onClick={() => void openCamera()}
              disabled={isBusy}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-horizon-400/12 px-3 py-2 text-xs font-medium text-horizon-200 hover:bg-horizon-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" /> Prendre
            </button>
          </div>
        </div>
      )}

      {requiredError && (
        <p
          id={`${label}-required-error`}
          className="mt-3 text-xs leading-5 text-rose-200"
          role="alert"
        >
          {requiredError}
        </p>
      )}

      {statusText && !isBusy && !error && (
        <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300" role="status">
          <Check className="h-4 w-4" /> {statusText}
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3" role="alert">
          <p className="text-xs leading-5 text-rose-100">{error}</p>
          {retryFileRef.current && (
            <button
              type="button"
              onClick={retry}
              className="mt-2 inline-flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-xs font-semibold text-rose-100 hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            >
              <RefreshCw className="h-4 w-4" /> Réessayer
            </button>
          )}
        </div>
      )}

      {isCameraOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-abyss-900/95 p-3 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Caméra — ${label}`}
        >
          <div className="w-full max-w-lg rounded-3xl border border-white/[0.1] bg-abyss-700 p-4 shadow-abyss sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-stellar-100">
                <Camera className="mr-2 inline h-4 w-4 text-horizon-300" /> {label}
              </h4>
              <button
                type="button"
                onClick={closeWebcam}
                aria-label="Fermer la caméra"
                className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.1] text-stellar-300 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-3 h-[min(52dvh,22rem)] overflow-hidden rounded-2xl border border-white/[0.08] bg-abyss-900">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${captureFacingMode === 'user' ? '-scale-x-100' : ''}`}
              />
              {isCameraStarting && (
                <div className="absolute inset-0 grid place-items-center bg-abyss-900/80">
                  <span className="inline-flex items-center gap-2 rounded-full bg-abyss-700 px-3 py-2 text-xs text-stellar-200">
                    <Loader2 className="h-4 w-4 animate-spin" /> Ouverture de la caméra…
                  </span>
                </div>
              )}
              {cameraError && (
                <div className="absolute inset-0 grid place-items-center bg-abyss-900/90 p-4">
                  <p className="max-w-sm text-center text-xs leading-5 text-rose-100" role="alert">
                    {cameraError}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {cameraError ? (
                <button
                  type="button"
                  onClick={() => {
                    closeWebcam();
                    fileInputRef.current?.click();
                  }}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-horizon-400 px-4 py-3 text-sm font-semibold text-abyss-900"
                >
                  <ImagePlus className="h-4 w-4" /> Choisir
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void captureFromWebcam()}
                  disabled={isCameraStarting}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-horizon-400 px-4 py-3 text-sm font-semibold text-abyss-900 disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" /> Capturer
                </button>
              )}
              <button
                type="button"
                onClick={closeWebcam}
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/[0.1] px-4 py-3 text-sm font-medium text-stellar-200"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};