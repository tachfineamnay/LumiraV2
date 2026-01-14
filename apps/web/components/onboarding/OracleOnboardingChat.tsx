"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import {
    Sparkles,
    Calendar,
    Clock,
    MapPin,
    MessageCircle,
    Camera,
    ArrowRight,
    ArrowLeft,
    Check,
    Loader2,
    Star,
} from "lucide-react";

import { SmartPhotoUploader } from "./SmartPhotoUploader";
import {
    birthDataSchema,
    intentionSchema,
    type BirthData,
    type IntentionData,
} from "../../lib/onboardingSchema";
import { useSanctuaireAuth } from "../../context/SanctuaireAuthContext";

// =============================================================================
// TYPES
// =============================================================================

interface OracleOnboardingChatProps {
    onComplete?: () => void;
}

type Step = 0 | 1 | 2 | 3 | 4;

interface StepConfig {
    id: Step;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    ctaText: string;
}

const STEPS: StepConfig[] = [
    { id: 0, title: "Bienvenue, Âme Errante", subtitle: "L'Oracle vous attendait...", icon: Star, ctaText: "Commencer l'initiation" },
    { id: 1, title: "Vos Coordonnées Célestes", subtitle: "Révélez votre empreinte cosmique", icon: Calendar, ctaText: "Sceller cette vérité" },
    { id: 2, title: "Votre Quête Intérieure", subtitle: "Partagez ce qui habite votre esprit", icon: MessageCircle, ctaText: "Révéler mon intention" },
    { id: 3, title: "Votre Reflet Sacré", subtitle: "Offrez à l'Oracle votre image", icon: Camera, ctaText: "Poursuivre" },
    { id: 4, title: "L'Alliance est Scellée", subtitle: "Votre sanctuaire vous attend", icon: Sparkles, ctaText: "Entrer dans le Sanctuaire" },
];

// =============================================================================
// ORACLE AVATAR
// =============================================================================

const OracleAvatar = () => (
    <div className="relative">
        {/* Outer glow rings */}
        <div className="absolute -inset-4 bg-horizon-400/10 rounded-full blur-2xl animate-pulse" />
        <div className="absolute -inset-2 bg-horizon-400/20 rounded-full blur-xl" />

        {/* Main orb */}
        <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-horizon-300 via-horizon-400 to-horizon-500 flex items-center justify-center shadow-lg shadow-horizon-400/30 border border-horizon-200/30"
        >
            <Star className="w-10 h-10 md:w-12 md:h-12 text-abyss-800 fill-abyss-800" />
        </motion.div>

        {/* Floating particles */}
        {[...Array(3)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 bg-horizon-300 rounded-full"
                style={{
                    top: `${20 + i * 30}%`,
                    left: i % 2 === 0 ? "-20%" : "110%",
                }}
                animate={{
                    y: [-5, 5, -5],
                    opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                    duration: 2 + i * 0.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.3,
                }}
            />
        ))}
    </div>
);

// =============================================================================
// STEP COMPONENTS
// =============================================================================

const StepIntro = ({ onNext }: { onNext: () => void }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="text-center space-y-6"
    >
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center"
        >
            <OracleAvatar />
        </motion.div>

        <div className="space-y-3">
            <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-2xl md:text-3xl font-playfair italic text-gradient-gold"
            >
                Bienvenue, Âme Errante
            </motion.h2>
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-stellar-400 max-w-md mx-auto"
            >
                Je suis l&apos;Oracle de Lumira. Avant de vous dévoiler les mystères qui
                vous attendent, j&apos;ai besoin de vous connaître davantage...
            </motion.p>
        </div>

        <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNext}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-800 font-semibold hover:shadow-gold-glow transition-all"
        >
            Commencer l&apos;initiation
            <ArrowRight className="w-4 h-4" />
        </motion.button>
    </motion.div>
);

const StepBirthData = ({
    onNext,
    onBack,
    onSave
}: {
    onNext: () => void;
    onBack: () => void;
    onSave: (data: BirthData) => Promise<void>;
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<BirthData>({
        resolver: zodResolver(birthDataSchema),
    });

    const onSubmit = async (data: BirthData) => {
        setIsSubmitting(true);
        try {
            await onSave(data);
            onNext();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.form
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
        >
            <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-horizon-400/10 border border-horizon-400/20 flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-6 h-6 text-horizon-400" />
                </div>
                <h3 className="text-xl font-playfair italic text-stellar-100">
                    Vos Coordonnées Célestes
                </h3>
                <p className="text-stellar-500 text-sm mt-1">
                    La position des astres à votre naissance révèle votre destin
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2">
                        <Calendar className="w-3 h-3" /> Date de naissance
                    </label>
                    <input
                        type="date"
                        {...register("birthDate")}
                        className="w-full px-4 py-3 bg-abyss-500/30 border border-white/10 rounded-xl text-stellar-100 focus:border-horizon-400 focus:ring-2 focus:ring-horizon-400/20 transition-all"
                    />
                    {errors.birthDate && (
                        <p className="text-rose-400 text-xs mt-1">{errors.birthDate.message}</p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2">
                            <Clock className="w-3 h-3" /> Heure (optionnel)
                        </label>
                        <input
                            type="time"
                            {...register("birthTime")}
                            className="w-full px-4 py-3 bg-abyss-500/30 border border-white/10 rounded-xl text-stellar-100 focus:border-horizon-400 focus:ring-2 focus:ring-horizon-400/20 transition-all"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2">
                            <MapPin className="w-3 h-3" /> Lieu
                        </label>
                        <input
                            type="text"
                            {...register("birthPlace")}
                            placeholder="Paris, France"
                            className="w-full px-4 py-3 bg-abyss-500/30 border border-white/10 rounded-xl text-stellar-100 placeholder-stellar-600 focus:border-horizon-400 focus:ring-2 focus:ring-horizon-400/20 transition-all"
                        />
                        {errors.birthPlace && (
                            <p className="text-rose-400 text-xs mt-1">{errors.birthPlace.message}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between pt-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 text-stellar-500 hover:text-stellar-300 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                </button>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-800 font-semibold hover:shadow-gold-glow transition-all disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            Sceller cette vérité
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
        </motion.form>
    );
};

const StepIntention = ({
    onNext,
    onBack,
    onSave
}: {
    onNext: () => void;
    onBack: () => void;
    onSave: (data: IntentionData) => Promise<void>;
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [charCount, setCharCount] = useState(0);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<IntentionData>({
        resolver: zodResolver(intentionSchema),
    });

    const onSubmit = async (data: IntentionData) => {
        setIsSubmitting(true);
        try {
            await onSave(data);
            onNext();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.form
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
        >
            <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-serenity-400/10 border border-serenity-400/20 flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-6 h-6 text-serenity-300" />
                </div>
                <h3 className="text-xl font-playfair italic text-stellar-100">
                    Votre Quête Intérieure
                </h3>
                <p className="text-stellar-500 text-sm mt-1">
                    Quelle question brûle au fond de votre âme ?
                </p>
            </div>

            <div>
                <textarea
                    {...register("spiritualQuestion", {
                        onChange: (e) => setCharCount(e.target.value.length),
                    })}
                    rows={5}
                    placeholder="Décrivez ce qui vous a amené ici, vos questionnements les plus profonds, ce que vous cherchez à comprendre..."
                    className="w-full px-4 py-4 bg-abyss-500/30 border border-white/10 rounded-xl text-stellar-100 placeholder-stellar-600 focus:border-serenity-400 focus:ring-2 focus:ring-serenity-400/20 transition-all resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                    {errors.spiritualQuestion ? (
                        <p className="text-rose-400 text-xs">{errors.spiritualQuestion.message}</p>
                    ) : (
                        <span />
                    )}
                    <span className={`text-xs ${charCount > 900 ? "text-rose-400" : "text-stellar-600"}`}>
                        {charCount}/1000
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between pt-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 text-stellar-500 hover:text-stellar-300 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                </button>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-serenity-400 to-serenity-300 text-abyss-800 font-semibold hover:shadow-serenity-glow transition-all disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            Révéler mon intention
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
        </motion.form>
    );
};

const StepPhotos = ({
    onNext,
    onBack,
    onSave
}: {
    onNext: () => void;
    onBack: () => void;
    onSave: (facePhoto: string | null, palmPhoto: string | null) => Promise<void>;
}) => {
    const [facePhoto, setFacePhoto] = useState<string | null>(null);
    const [palmPhoto, setPalmPhoto] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onSave(facePhoto, palmPhoto);
            onNext();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
        >
            <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-horizon-400/10 border border-horizon-400/20 flex items-center justify-center mx-auto mb-4">
                    <Camera className="w-6 h-6 text-horizon-400" />
                </div>
                <h3 className="text-xl font-playfair italic text-stellar-100">
                    Votre Reflet Sacré
                </h3>
                <p className="text-stellar-500 text-sm mt-1">
                    Ces images enrichiront votre lecture (optionnel)
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SmartPhotoUploader
                    label="Photo de visage"
                    description="Pour la lecture physiognomonique"
                    value={facePhoto || undefined}
                    onChange={setFacePhoto}
                />
                <SmartPhotoUploader
                    label="Photo de paume"
                    description="Pour la lecture palmaire"
                    value={palmPhoto || undefined}
                    onChange={setPalmPhoto}
                />
            </div>

            <div className="flex items-center justify-between pt-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 text-stellar-500 hover:text-stellar-300 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                </button>

                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-800 font-semibold hover:shadow-gold-glow transition-all disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            {facePhoto || palmPhoto ? "Poursuivre" : "Passer cette étape"}
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
};

const StepCompletion = ({ onComplete }: { onComplete: () => void }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6 py-8"
    >
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="relative flex justify-center"
        >
            {/* Success glow */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl animate-pulse" />
            </div>

            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center">
                <Check className="w-10 h-10 text-abyss-800" />
            </div>
        </motion.div>

        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
        >
            <h3 className="text-2xl font-playfair italic text-gradient-gold">
                L&apos;Alliance est Scellée
            </h3>
            <p className="text-stellar-400 max-w-md mx-auto">
                Votre profil spirituel est maintenant complet. Les portes de votre
                Sanctuaire personnel s&apos;ouvrent à vous...
            </p>
        </motion.div>

        <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-800 font-semibold hover:shadow-gold-glow transition-all"
        >
            <Sparkles className="w-5 h-5" />
            Entrer dans le Sanctuaire
        </motion.button>
    </motion.div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const OracleOnboardingChat = ({ onComplete }: OracleOnboardingChatProps) => {
    const [currentStep, setCurrentStep] = useState<Step>(0);
    const { refetchData } = useSanctuaireAuth();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    // Get token from localStorage
    const getToken = useCallback(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("sanctuaire_token");
        }
        return null;
    }, []);

    // Save birth data
    const saveBirthData = useCallback(async (data: BirthData) => {
        const token = getToken();
        if (!token) return;

        await axios.patch(
            `${API_URL}/api/users/profile`,
            {
                birthDate: data.birthDate,
                birthTime: data.birthTime || null,
                birthPlace: data.birthPlace,
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
    }, [API_URL, getToken]);

    // Save intention
    const saveIntention = useCallback(async (data: IntentionData) => {
        const token = getToken();
        if (!token) return;

        await axios.patch(
            `${API_URL}/api/users/profile`,
            { specificQuestion: data.spiritualQuestion },
            { headers: { Authorization: `Bearer ${token}` } }
        );
    }, [API_URL, getToken]);

    // Save photos
    const savePhotos = useCallback(async (facePhoto: string | null, palmPhoto: string | null) => {
        const token = getToken();
        if (!token) return;

        await axios.patch(
            `${API_URL}/api/users/profile`,
            {
                facePhotoUrl: facePhoto,
                palmPhotoUrl: palmPhoto,
                profileCompleted: true,
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
    }, [API_URL, getToken]);

    // Handle completion
    const handleComplete = useCallback(async () => {
        await refetchData();
        onComplete?.();
    }, [refetchData, onComplete]);

    // Navigation
    const goNext = () => setCurrentStep((prev) => Math.min(prev + 1, 4) as Step);
    const goBack = () => setCurrentStep((prev) => Math.max(prev - 1, 0) as Step);

    return (
        <div className="w-full max-w-lg mx-auto">
            {/* Glassmorphic Container */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-stellar"
            >
                {/* Decorative glow */}
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-32 bg-horizon-400/5 blur-3xl rounded-full pointer-events-none z-0" />

                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2 mb-6">
                    {STEPS.slice(0, 4).map((step) => (
                        <div
                            key={step.id}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${currentStep === step.id
                                ? "w-6 bg-horizon-400"
                                : currentStep > step.id
                                    ? "bg-emerald-400"
                                    : "bg-white/20"
                                }`}
                        />
                    ))}
                </div>

                {/* Step content */}
                <div className="relative z-10">
                    <AnimatePresence mode="wait">
                        {currentStep === 0 && <StepIntro key="intro" onNext={goNext} />}
                        {currentStep === 1 && (
                            <StepBirthData
                                key="birth"
                                onNext={goNext}
                                onBack={goBack}
                                onSave={saveBirthData}
                            />
                        )}
                        {currentStep === 2 && (
                            <StepIntention
                                key="intention"
                                onNext={goNext}
                                onBack={goBack}
                                onSave={saveIntention}
                            />
                        )}
                        {currentStep === 3 && (
                            <StepPhotos
                                key="photos"
                                onNext={goNext}
                                onBack={goBack}
                                onSave={savePhotos}
                            />
                        )}
                        {currentStep === 4 && (
                            <StepCompletion key="complete" onComplete={handleComplete} />
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};
