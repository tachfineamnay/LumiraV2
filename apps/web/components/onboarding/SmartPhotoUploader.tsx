"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Camera, Smartphone, X, Check, Loader2, RefreshCw } from "lucide-react";
import imageCompression from "browser-image-compression";

// =============================================================================
// TYPES
// =============================================================================

interface SmartPhotoUploaderProps {
    label: string;
    description: string;
    value?: string;
    onChange: (dataUrl: string | null) => void;
    className?: string;
}

type UploadMode = "idle" | "file" | "webcam" | "mobile";

// =============================================================================
// COMPONENT
// =============================================================================

export const SmartPhotoUploader = ({
    label,
    description,
    value,
    onChange,
    className = "",
}: SmartPhotoUploaderProps) => {
    const [mode, setMode] = useState<UploadMode>("idle");
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // =========================================================================
    // FILE UPLOAD
    // =========================================================================

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setError("Veuillez sélectionner une image");
            return;
        }

        try {
            const options = {
                maxSizeMB: 1,
                maxWidthOrHeight: 800,
                useWebWorker: true
            };

            const compressedFile = await imageCompression(file, options);
            const reader = new FileReader();

            reader.onload = () => {
                onChange(reader.result as string);
                setMode("idle");
                setError(null);
            };
            reader.onerror = () => setError("Erreur lors de la lecture du fichier");
            reader.readAsDataURL(compressedFile);
        } catch (error) {
            console.error(error);
            setError("Erreur lors de la compression de l'image");
        }
    }, [onChange]);

    // =========================================================================
    // WEBCAM
    // =========================================================================

    const startWebcam = useCallback(async () => {
        setMode("webcam");
        setError(null);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
        } catch {
            setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
            setMode("idle");
        }
    }, []);

    const stopWebcam = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const capturePhoto = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsCapturing(true);
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);

            canvas.toBlob(async (blob) => {
                if (blob) {
                    try {
                        const file = new File([blob], "webcam-capture.jpg", { type: "image/jpeg" });
                        const options = {
                            maxSizeMB: 1,
                            maxWidthOrHeight: 800,
                            useWebWorker: true
                        };
                        const compressedFile = await imageCompression(file, options);

                        const reader = new FileReader();
                        reader.onload = () => {
                            onChange(reader.result as string);
                            // Cleanup after successful read
                            stopWebcam();
                            setIsCapturing(false);
                            setMode("idle");
                        };
                        reader.onerror = () => {
                            setError("Erreur lors de la lecture du fichier capturé");
                            setIsCapturing(false);
                            setMode("idle");
                            stopWebcam();
                        };
                        reader.readAsDataURL(compressedFile);
                    } catch (err) {
                        console.error(err);
                        setError("Erreur compression webcam");
                        setIsCapturing(false);
                        setMode("idle");
                        stopWebcam();
                    }
                } else {
                    setError("Erreur lors de la création du blob d'image");
                    setIsCapturing(false);
                    setMode("idle");
                    stopWebcam();
                }
            }, "image/jpeg", 0.9);
        }
    }, [onChange, stopWebcam]);

    // =========================================================================
    // REMOVE PHOTO
    // =========================================================================

    const handleRemove = useCallback(() => {
        onChange(null);
        stopWebcam();
        setMode("idle");
    }, [onChange, stopWebcam]);

    // =========================================================================
    // RENDER
    // =========================================================================

    // If photo already captured
    if (value) {
        return (
            <div className={`relative group ${className}`}>
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-horizon-400/30">
                    <img src={value} alt={label} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-abyss-800/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <Check className="w-4 h-4" />
                            <span className="text-xs font-medium">{label}</span>
                        </div>
                        <button
                            onClick={handleRemove}
                            aria-label="Supprimer la photo"
                            className="p-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Webcam mode
    if (mode === "webcam") {
        return (
            <div className={`relative ${className}`}>
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-abyss-600 border border-white/10">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
                        <button
                            onClick={() => { stopWebcam(); setMode("idle"); }}
                            aria-label="Annuler la capture"
                            className="p-3 rounded-full bg-abyss-700/80 backdrop-blur-sm text-stellar-400 hover:text-stellar-200 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <button
                            onClick={capturePhoto}
                            disabled={isCapturing}
                            className="p-4 rounded-full bg-horizon-400 text-abyss-800 hover:bg-horizon-300 transition-colors disabled:opacity-50"
                        >
                            {isCapturing ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <Camera className="w-6 h-6" />
                            )}
                        </button>

                        <button
                            onClick={() => { stopWebcam(); startWebcam(); }}
                            aria-label="Réinitialiser la caméra"
                            className="p-3 rounded-full bg-abyss-700/80 backdrop-blur-sm text-stellar-400 hover:text-stellar-200 transition-colors"
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Mobile QR mode
    if (mode === "mobile") {
        return (
            <div className={`relative ${className}`}>
                <div className="aspect-[4/3] rounded-2xl bg-abyss-600/50 border border-white/10 flex flex-col items-center justify-center p-6">
                    <div className="w-32 h-32 bg-white rounded-lg mb-4 flex items-center justify-center">
                        <span className="text-abyss-800 text-xs text-center">QR Code<br />(Coming Soon)</span>
                    </div>
                    <p className="text-stellar-400 text-sm text-center mb-4">
                        Scannez ce code avec votre téléphone
                    </p>
                    <button
                        onClick={() => setMode("idle")}
                        className="text-stellar-500 text-xs hover:text-stellar-300 transition-colors"
                    >
                        Retour
                    </button>
                </div>
            </div>
        );
    }

    // Idle mode - show options
    return (
        <div className={className}>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                aria-label="Sélectionner une photo"
                className="hidden"
            />

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm"
                >
                    {error}
                </motion.div>
            )}

            <div className="aspect-[4/3] rounded-2xl bg-abyss-500/30 border-2 border-dashed border-white/10 hover:border-horizon-400/30 transition-all overflow-hidden">
                <div className="h-full flex flex-col items-center justify-center p-4">
                    <div className="relative mb-4">
                        <div className="absolute inset-0 bg-horizon-400/20 blur-xl rounded-full" />
                        <div className="relative w-12 h-12 rounded-full bg-abyss-600 border border-white/10 flex items-center justify-center">
                            <Camera className="w-6 h-6 text-horizon-400" />
                        </div>
                    </div>

                    <p className="text-stellar-200 font-medium mb-1">{label}</p>
                    <p className="text-stellar-500 text-xs text-center mb-4">{description}</p>

                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-abyss-500/50 hover:bg-abyss-400/50 text-stellar-300 text-xs transition-colors border border-white/5"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            Fichier
                        </button>

                        <button
                            onClick={startWebcam}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-horizon-400/10 hover:bg-horizon-400/20 text-horizon-300 text-xs transition-colors border border-horizon-400/20"
                        >
                            <Camera className="w-3.5 h-3.5" />
                            Webcam
                        </button>

                        <button
                            onClick={() => setMode("mobile")}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-abyss-500/50 hover:bg-abyss-400/50 text-stellar-300 text-xs transition-colors border border-white/5"
                        >
                            <Smartphone className="w-3.5 h-3.5" />
                            Mobile
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
