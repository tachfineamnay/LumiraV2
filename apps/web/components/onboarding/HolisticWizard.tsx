"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    ArrowRight,
    ArrowLeft,
    Check,
    Loader2,
    Sparkles,
    Brain,
    Heart,
    Activity,
    MapPin,
    X,
    Star,
    Target
} from "lucide-react";
import { SmartPhotoUploader } from "./SmartPhotoUploader";

import {
    holisticDiagnosticSchema,
    type HolisticDiagnosticData,
    DELIVERY_STYLES
} from "../../lib/holisticSchema";

interface HolisticWizardProps {
    onComplete?: (data: HolisticDiagnosticData) => Promise<void>;
    initialData?: Partial<HolisticDiagnosticData>;
    userEmail?: string;
    onClose?: () => void;
}

// =============================================================================
// STEPS CONFIG
// =============================================================================

const STEPS = [
    { id: 0, title: "État Vibratoire", subtitle: "Vos énergies", icon: Brain },
    { id: 1, title: "Corps Mémoire", subtitle: "Écouter le corps", icon: Activity },
    { id: 2, title: "Fréquence", subtitle: "Style de guidance", icon: Heart },
    { id: 3, title: "Ancrage", subtitle: "Coordonnées cosmiques", icon: MapPin },
    { id: 4, title: "Intentions", subtitle: "Vos attentes", icon: Target },
    { id: 5, title: "Scellement", subtitle: "Confirmation", icon: Sparkles },
];

// =============================================================================
// COMPONENT
// =============================================================================

export const HolisticWizard = ({ onComplete, initialData, userEmail, onClose }: HolisticWizardProps) => {
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load draft from localStorage
    const loadDraft = () => {
        if (typeof window === "undefined") return {};
        
        const cachedEmail = localStorage.getItem("holistic_wizard_email");
        const saved = localStorage.getItem("holistic_wizard_draft");
        
        if (userEmail && cachedEmail && cachedEmail !== userEmail) {
            localStorage.removeItem("holistic_wizard_draft");
            localStorage.removeItem("holistic_wizard_email");
            return {};
        }
        
        if (userEmail) {
            localStorage.setItem("holistic_wizard_email", userEmail);
        }
        
        return saved ? JSON.parse(saved) : {};
    };

    const defaultFormValues: Partial<HolisticDiagnosticData> = {
        highs: "",
        lows: "",
        ailments: "",
        strongSide: "Right",
        weakSide: "Left",
        strongZone: "",
        weakZone: "",
        deliveryStyle: "Gentle",
        pace: 50,
        birthDate: "",
        birthTime: "",
        birthPlace: "",
        facePhoto: "",
        palmPhoto: "",
        specificQuestion: "",
        objective: "",
        fears: "",
        rituals: "",
        gdprConsent: false,
    };

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        trigger,
        formState: { errors }
    } = useForm<HolisticDiagnosticData>({
        resolver: zodResolver(holisticDiagnosticSchema),
        defaultValues: { ...defaultFormValues, ...loadDraft(), ...initialData },
        mode: "onChange"
    });

    // Auto-save draft
    const formData = watch();
    useEffect(() => {
        localStorage.setItem("holistic_wizard_draft", JSON.stringify(formData));
    }, [formData]);

    // Navigation Logic
    const nextStep = async () => {
        let fieldsToValidate: (keyof HolisticDiagnosticData)[] = [];

        if (step === 0) fieldsToValidate = ["highs", "lows"];
        if (step === 1) fieldsToValidate = ["strongSide", "weakSide", "strongZone", "weakZone"];
        if (step === 2) fieldsToValidate = ["deliveryStyle", "pace"];
        if (step === 3) fieldsToValidate = ["birthDate", "birthPlace"];
        // Step 4 (Intentions) - all fields optional, no validation needed
        if (step === 5) fieldsToValidate = ["gdprConsent"];

        const isStepValid = await trigger(fieldsToValidate);
        if (isStepValid) setStep(prev => prev + 1);
    };

    const prevStep = () => setStep(prev => Math.max(0, prev - 1));

    const onSubmit = async (data: HolisticDiagnosticData) => {
        setIsSubmitting(true);
        try {
            await onComplete?.(data);
            localStorage.removeItem("holistic_wizard_draft");
            localStorage.removeItem("holistic_wizard_email");
        } catch (error) {
            console.error("[HolisticWizard] Submit error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Progress percentage
    const progress = ((step + 1) / STEPS.length) * 100;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-abyss-900/95 backdrop-blur-xl"
            />

            {/* Modal Container - Fullscreen on mobile, centered modal on desktop */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:mx-4 md:rounded-2xl bg-abyss-800 md:border md:border-white/10 md:shadow-2xl overflow-hidden flex flex-col"
            >
                {/* ═══════════════════════════════════════════════════════════
                    HEADER - Fixed
                ═══════════════════════════════════════════════════════════ */}
                <div className="flex-shrink-0 relative z-10">
                    {/* Progress Bar */}
                    <div className="h-1 bg-abyss-700">
                        <motion.div
                            className="h-full bg-gradient-to-r from-horizon-400 to-horizon-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>

                    {/* Header Content */}
                    <div className="px-4 md:px-6 py-4 border-b border-white/5 bg-abyss-800/80 backdrop-blur-sm">
                        <div className="flex items-center justify-between">
                            {/* Brand */}
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-horizon-400 to-horizon-500 flex items-center justify-center">
                                    <Star className="w-4 h-4 text-abyss-900 fill-abyss-900" />
                                </div>
                                <div className="hidden sm:block">
                                    <span className="text-sm font-playfair italic text-stellar-100">Oracle Lumira</span>
                                    <span className="block text-[9px] text-stellar-500 uppercase tracking-wider">Diagnostic</span>
                                </div>
                            </div>

                            {/* Step Indicator - Compact */}
                            <div className="flex items-center gap-1">
                                {STEPS.map((s, index) => {
                                    const isCompleted = index < step;
                                    const isCurrent = index === step;
                                    const Icon = s.icon;
                                    
                                    return (
                                        <div
                                            key={s.id}
                                            className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                                                isCompleted
                                                    ? "bg-emerald-500/20 text-emerald-400"
                                                    : isCurrent
                                                    ? "bg-horizon-400/20 text-horizon-400 ring-2 ring-horizon-400/50"
                                                    : "bg-white/5 text-stellar-600"
                                            }`}
                                        >
                                            {isCompleted ? (
                                                <Check className="w-3.5 h-3.5" />
                                            ) : (
                                                <Icon className="w-3.5 h-3.5" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Close Button */}
                            {onClose && (
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-stellar-400 hover:text-stellar-200 transition-colors"
                                    aria-label="Fermer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Current Step Title */}
                        <div className="mt-3 text-center">
                            <h2 className="text-lg md:text-xl font-playfair italic text-gradient-gold">
                                {STEPS[step].title}
                            </h2>
                            <p className="text-xs text-stellar-500 mt-0.5">{STEPS[step].subtitle}</p>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    CONTENT - Scrollable
                ═══════════════════════════════════════════════════════════ */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    <div className="p-4 md:p-6">
                        <AnimatePresence mode="wait">
                            
                            {/* STEP 1: VIBRATION */}
                            {step === 0 && (
                                <motion.div
                                    key="step0"
                                    initial={{ opacity: 0, x: 30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -30 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="space-y-4"
                                >
                                    <p className="text-center text-stellar-400 text-sm italic">
                                        "Partagez ce qui illumine et ce qui assombrit votre quotidien."
                                    </p>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400/90 font-medium mb-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                Ce qui vous porte
                                            </label>
                                            <textarea
                                                {...register("highs")}
                                                placeholder="Vos victoires, vos joies récentes..."
                                                className="w-full h-28 md:h-32 bg-abyss-700/50 border border-white/10 rounded-xl p-3 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all resize-none"
                                            />
                                            {errors.highs && <span className="text-rose-400 text-xs mt-1 block">{errors.highs.message}</span>}
                                        </div>
                                        
                                        <div>
                                            <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-rose-400/90 font-medium mb-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                                Ce qui vous pèse
                                            </label>
                                            <textarea
                                                {...register("lows")}
                                                placeholder="Vos doutes, vos obstacles..."
                                                className="w-full h-28 md:h-32 bg-abyss-700/50 border border-white/10 rounded-xl p-3 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 focus:outline-none transition-all resize-none"
                                            />
                                            {errors.lows && <span className="text-rose-400 text-xs mt-1 block">{errors.lows.message}</span>}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 2: SOMATIC */}
                            {step === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -30 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="space-y-4"
                                >
                                    <p className="text-center text-stellar-400 text-sm italic">
                                        "Le corps exprime souvent ce que l'esprit tait."
                                    </p>

                                    {/* Side Selector */}
                                    <div className="flex justify-center gap-3">
                                        {["Left", "Right"].map((side) => (
                                            <button
                                                key={side}
                                                type="button"
                                                onClick={() => {
                                                    setValue("strongSide", side as "Left" | "Right");
                                                    setValue("weakSide", side === "Left" ? "Right" : "Left");
                                                }}
                                                className={`relative flex-1 max-w-[140px] py-4 rounded-xl border transition-all duration-300 ${
                                                    watch("strongSide") === side
                                                        ? "bg-horizon-400/15 border-horizon-400/60"
                                                        : "bg-abyss-700/50 border-white/10 hover:border-white/20"
                                                }`}
                                            >
                                                <span className={`block text-lg font-medium mb-0.5 ${watch("strongSide") === side ? "text-horizon-300" : "text-stellar-400"}`}>
                                                    {side === "Left" ? "🤚 Gauche" : "✋ Droite"}
                                                </span>
                                                <span className="text-[10px] uppercase tracking-wider text-stellar-500">Côté Fort</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs uppercase tracking-wider text-stellar-500 font-medium mb-1.5 block">Zone fragile</label>
                                            <input
                                                {...register("weakZone")}
                                                className="w-full bg-abyss-700/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-horizon-400/50 focus:outline-none transition-all"
                                                placeholder="Ex: Bas du dos..."
                                            />
                                            {errors.weakZone && <span className="text-rose-400 text-xs">{errors.weakZone.message}</span>}
                                        </div>
                                        <div>
                                            <label className="text-xs uppercase tracking-wider text-stellar-500 font-medium mb-1.5 block">Zone forte</label>
                                            <input
                                                {...register("strongZone")}
                                                className="w-full bg-abyss-700/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-horizon-400/50 focus:outline-none transition-all"
                                                placeholder="Ex: Les mains..."
                                            />
                                            {errors.strongZone && <span className="text-rose-400 text-xs">{errors.strongZone.message}</span>}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 3: RHYTHM */}
                            {step === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -30 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="space-y-3"
                                >
                                    <p className="text-center text-stellar-400 text-sm italic">
                                        "Comment souhaitez-vous recevoir les messages de l'Oracle ?"
                                    </p>
                                    
                                    <div className="space-y-2">
                                        {(Object.keys(DELIVERY_STYLES) as Array<keyof typeof DELIVERY_STYLES>).map((style) => (
                                            <button
                                                key={style}
                                                type="button"
                                                onClick={() => setValue("deliveryStyle", style)}
                                                className={`w-full text-left p-3 md:p-4 rounded-xl border transition-all duration-300 flex items-center gap-3 ${
                                                    watch("deliveryStyle") === style
                                                        ? "bg-horizon-400/10 border-horizon-400/50"
                                                        : "bg-abyss-700/30 border-white/5 hover:bg-abyss-700/50"
                                                }`}
                                            >
                                                <span className="text-2xl">{DELIVERY_STYLES[style].icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`font-medium text-sm ${watch("deliveryStyle") === style ? "text-horizon-300" : "text-stellar-200"}`}>
                                                        {DELIVERY_STYLES[style].title}
                                                        <span className="text-stellar-500 font-normal ml-1.5">— {DELIVERY_STYLES[style].subtitle}</span>
                                                    </h4>
                                                    <p className="text-xs text-stellar-500 truncate">{DELIVERY_STYLES[style].description}</p>
                                                </div>
                                                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                                                    watch("deliveryStyle") === style 
                                                        ? "border-horizon-400 bg-horizon-400" 
                                                        : "border-white/20"
                                                }`}>
                                                    {watch("deliveryStyle") === style && <Check className="w-full h-full text-abyss-900 p-0.5" />}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 4: IDENTITY */}
                            {step === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: 30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -30 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="space-y-4"
                                >
                                    <p className="text-center text-stellar-400 text-sm italic">
                                        "Pour tracer votre carte, vos coordonnées cosmiques."
                                    </p>

                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs uppercase tracking-wider text-stellar-500 font-medium mb-1.5 block">Date de naissance *</label>
                                                <input
                                                    type="date"
                                                    {...register("birthDate")}
                                                    className="w-full bg-abyss-700/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-stellar-200 focus:border-horizon-400/50 focus:outline-none transition-all"
                                                />
                                                {errors.birthDate && <span className="text-rose-400 text-xs">{errors.birthDate.message}</span>}
                                            </div>
                                            <div>
                                                <label className="text-xs uppercase tracking-wider text-stellar-500 font-medium mb-1.5 block">Heure (optionnel)</label>
                                                <input
                                                    type="time"
                                                    {...register("birthTime")}
                                                    className="w-full bg-abyss-700/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-stellar-200 focus:border-horizon-400/50 focus:outline-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs uppercase tracking-wider text-stellar-500 font-medium mb-1.5 block">Lieu de naissance *</label>
                                            <input
                                                {...register("birthPlace")}
                                                placeholder="Ville, Pays"
                                                className="w-full bg-abyss-700/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-horizon-400/50 focus:outline-none transition-all"
                                            />
                                            {errors.birthPlace && <span className="text-rose-400 text-xs">{errors.birthPlace.message}</span>}
                                        </div>

                                        {/* Photos - Compact on mobile */}
                                        <div className="pt-2">
                                            <p className="text-xs text-stellar-500 mb-3 text-center">Photos optionnelles pour une lecture approfondie</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <SmartPhotoUploader
                                                    label="Visage"
                                                    description="Lecture physiognomonique"
                                                    value={watch("facePhoto")}
                                                    onChange={(url) => setValue("facePhoto", url || "")}
                                                    compact
                                                />
                                                <SmartPhotoUploader
                                                    label="Paume"
                                                    description="Lecture palmaire"
                                                    value={watch("palmPhoto")}
                                                    onChange={(url) => setValue("palmPhoto", url || "")}
                                                    compact
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 5: INTENTIONS */}
                            {step === 4 && (
                                <motion.div
                                    key="step4-intentions"
                                    initial={{ opacity: 0, x: 30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -30 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="space-y-4"
                                >
                                    <p className="text-center text-stellar-400 text-sm italic">
                                        "Partagez vos attentes pour guider l'Oracle dans sa lecture."
                                    </p>
                                    <p className="text-center text-stellar-600 text-xs">
                                        Ces champs sont optionnels mais enrichissent la lecture.
                                    </p>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-horizon-400/90 font-medium mb-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-horizon-400" />
                                                Question spécifique
                                            </label>
                                            <textarea
                                                {...register("specificQuestion")}
                                                placeholder="Avez-vous une question précise pour l'Oracle ?"
                                                className="w-full h-24 bg-abyss-700/50 border border-white/10 rounded-xl p-3 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-horizon-500/50 focus:ring-1 focus:ring-horizon-500/20 focus:outline-none transition-all resize-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-serenity-400/90 font-medium mb-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-serenity-400" />
                                                Objectif de la lecture
                                            </label>
                                            <textarea
                                                {...register("objective")}
                                                placeholder="Que cherchez-vous à comprendre, transformer ou clarifier ?"
                                                className="w-full h-24 bg-abyss-700/50 border border-white/10 rounded-xl p-3 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-serenity-500/50 focus:ring-1 focus:ring-serenity-500/20 focus:outline-none transition-all resize-none"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400/90 font-medium mb-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                    Peurs à transmuter
                                                </label>
                                                <textarea
                                                    {...register("fears")}
                                                    placeholder="Ce qui vous effraie ou vous bloque..."
                                                    className="w-full h-20 bg-abyss-700/50 border border-white/10 rounded-xl p-3 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 focus:outline-none transition-all resize-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-violet-400/90 font-medium mb-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                                                    Rituels actuels
                                                </label>
                                                <textarea
                                                    {...register("rituals")}
                                                    placeholder="Pratiques spirituelles, méditation..."
                                                    className="w-full h-20 bg-abyss-700/50 border border-white/10 rounded-xl p-3 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 focus:outline-none transition-all resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* STEP 6: CONSENT */}
                            {step === 5 && (
                                <motion.div
                                    key="step5-consent"
                                    initial={{ opacity: 0, x: 30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -30 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="space-y-6"
                                >
                                    <div className="text-center py-4">
                                        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-horizon-400/20 to-serenity-400/20 flex items-center justify-center mb-4 border border-horizon-400/30">
                                            <Sparkles className="w-8 h-8 text-horizon-400" />
                                        </div>
                                        <h3 className="text-xl font-playfair italic text-stellar-100 mb-2">
                                            Prêt à sceller votre diagnostic
                                        </h3>
                                        <p className="text-sm text-stellar-500">
                                            Vos informations seront utilisées pour créer une expérience personnalisée.
                                        </p>
                                    </div>

                                    <label className="flex items-start gap-3 p-4 rounded-xl bg-abyss-700/30 border border-white/5 cursor-pointer hover:bg-abyss-700/50 transition-colors">
                                        <input
                                            type="checkbox"
                                            {...register("gdprConsent")}
                                            className="mt-0.5 w-5 h-5 rounded border-white/20 bg-abyss-700 text-horizon-400 focus:ring-horizon-400/50 focus:ring-offset-0"
                                        />
                                        <span className="text-sm text-stellar-300">
                                            J'accepte que mes données soient utilisées pour personnaliser mon expérience spirituelle avec Oracle Lumira.
                                        </span>
                                    </label>
                                    {errors.gdprConsent && <span className="text-rose-400 text-xs block text-center">{errors.gdprConsent.message}</span>}
                                </motion.div>
                            )}

                        </AnimatePresence>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════
                    FOOTER - Fixed
                ═══════════════════════════════════════════════════════════ */}
                <div className="flex-shrink-0 px-4 md:px-6 py-4 border-t border-white/5 bg-abyss-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                        {/* Back Button */}
                        <button
                            type="button"
                            onClick={prevStep}
                            disabled={step === 0}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                step === 0
                                    ? "opacity-0 pointer-events-none"
                                    : "bg-white/5 text-stellar-300 hover:bg-white/10 border border-white/10"
                            }`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Retour</span>
                        </button>

                        {/* Step Counter - Mobile */}
                        <span className="text-xs text-stellar-500 sm:hidden">
                            {step + 1} / {STEPS.length}
                        </span>

                        {/* Next/Submit Button */}
                        {step < STEPS.length - 1 ? (
                            <button
                                type="button"
                                onClick={nextStep}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-900 font-semibold text-sm hover:shadow-lg hover:shadow-horizon-400/25 transition-all"
                            >
                                Continuer
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit(onSubmit)}
                                disabled={isSubmitting || !watch("gdprConsent")}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold text-sm hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Envoi...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        Sceller
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
