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
    Calendar,
    Clock,
    Camera,
    Star
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
}

// =============================================================================
// STEPS CONFIG
// =============================================================================

const STEPS = [
    { id: 0, title: "L'État Vibratoire", subtitle: "Vos énergies actuelles", icon: Brain },
    { id: 1, title: "Le Corps Mémoire", subtitle: "Écouter votre corps", icon: Activity },
    { id: 2, title: "Votre Fréquence", subtitle: "Style de guidance", icon: Heart },
    { id: 3, title: "L'Ancrage", subtitle: "Vos coordonnées cosmiques", icon: MapPin },
    { id: 4, title: "Le Scellement", subtitle: "Confirmation finale", icon: Sparkles },
];

// =============================================================================
// COMPONENT
// =============================================================================

export const HolisticWizard = ({ onComplete, initialData, userEmail }: HolisticWizardProps) => {
    const [step, setStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load draft from localStorage on mount - with email-based cache invalidation
    const loadDraft = () => {
        if (typeof window === "undefined") return {};
        
        const cachedEmail = localStorage.getItem("holistic_wizard_email");
        const saved = localStorage.getItem("holistic_wizard_draft");
        
        if (userEmail && cachedEmail && cachedEmail !== userEmail) {
            console.log("[HolisticWizard] Email mismatch - clearing cached draft");
            localStorage.removeItem("holistic_wizard_draft");
            localStorage.removeItem("holistic_wizard_email");
            return {};
        }
        
        if (userEmail) {
            localStorage.setItem("holistic_wizard_email", userEmail);
        }
        
        return saved ? JSON.parse(saved) : {};
    };

    // Default values for form
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
        if (step === 4) fieldsToValidate = ["gdprConsent"];

        const isStepValid = await trigger(fieldsToValidate);
        if (isStepValid) setStep(prev => prev + 1);
    };

    const prevStep = () => setStep(prev => Math.max(0, prev - 1));

    const onSubmit = async (data: HolisticDiagnosticData) => {
        console.log("[HolisticWizard] Submitting data:", data);
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

    // =========================================================================
    // RENDER HELPERS
    // =========================================================================

    const containerVariants = {
        hidden: { opacity: 0, y: 30, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
        exit: { opacity: 0, y: -20, scale: 0.98, transition: { duration: 0.3 } }
    };

    // Step Indicator Component
    const StepIndicator = () => (
        <div className="flex items-center justify-center gap-2 mb-8">
            {STEPS.map((s, index) => {
                const isCompleted = index < step;
                const isCurrent = index === step;
                const Icon = s.icon;
                
                return (
                    <React.Fragment key={s.id}>
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                            className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 ${
                                isCompleted
                                    ? "bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-[0_0_20px_rgba(52,211,153,0.4)]"
                                    : isCurrent
                                    ? "bg-gradient-to-br from-horizon-400 to-horizon-500 shadow-[0_0_25px_rgba(232,168,56,0.5)]"
                                    : "bg-abyss-600/80 border border-white/10"
                            }`}
                        >
                            {isCompleted ? (
                                <Check className="w-5 h-5 text-abyss-900" />
                            ) : (
                                <Icon className={`w-5 h-5 ${isCurrent ? "text-abyss-900" : "text-stellar-500"}`} />
                            )}
                            {isCurrent && (
                                <motion.div
                                    className="absolute inset-0 rounded-full border-2 border-horizon-400"
                                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                />
                            )}
                        </motion.div>
                        {index < STEPS.length - 1 && (
                            <div className={`w-8 h-0.5 transition-colors duration-500 ${
                                isCompleted ? "bg-emerald-400/50" : "bg-white/10"
                            }`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );

    return (
        <div className="min-h-full w-full relative overflow-y-auto overflow-x-hidden">
            {/* ═══════════════════════════════════════════════════════════════
                COSMIC BACKGROUND (relative to container)
            ═══════════════════════════════════════════════════════════════ */}
            <div className="absolute inset-0 bg-abyss-900" />
            <div className="absolute inset-0 wizard-cosmic-gradient" />
            
            {/* Animated Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.15, 0.25, 0.15],
                        x: [0, 30, 0],
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/4 -left-32 w-96 h-96 bg-serenity-400/30 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{ 
                        scale: [1, 1.15, 1],
                        opacity: [0.1, 0.2, 0.1],
                        x: [0, -20, 0],
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bottom-1/4 -right-32 w-80 h-80 bg-horizon-400/20 rounded-full blur-[100px]"
                />
            </div>
            
            {/* Starfield */}
            <div className="absolute inset-0 starfield pointer-events-none" />

            {/* ═══════════════════════════════════════════════════════════════
                MAIN CONTENT
            ═══════════════════════════════════════════════════════════════ */}
            <div className="relative z-10 min-h-full flex flex-col items-center justify-center px-4 py-8 md:py-12">
                
                {/* Brand Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 mb-6"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-horizon-400 to-horizon-500 flex items-center justify-center shadow-[0_0_30px_rgba(232,168,56,0.3)]">
                        <Star className="w-5 h-5 text-abyss-900 fill-abyss-900" />
                    </div>
                    <div>
                        <span className="text-lg font-playfair italic text-stellar-100">Oracle Lumira</span>
                        <span className="block text-[10px] text-stellar-500 uppercase tracking-[0.2em]">Diagnostic Vibratoire</span>
                    </div>
                </motion.div>

                {/* Glass Card Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="w-full max-w-2xl"
                >
                    <div className="glass-card p-6 md:p-8 relative overflow-hidden">
                        {/* Inner glow effect */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-horizon-400/50 to-transparent" />
                        
                        {/* Step Indicator */}
                        <StepIndicator />

                        {/* Step Header */}
                        <div className="text-center mb-8">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-horizon-400/10 text-horizon-400 mb-4 border border-horizon-400/20"
                            >
                                {React.createElement(STEPS[step].icon, { className: "w-7 h-7" })}
                            </motion.div>
                            <motion.h2 
                                key={`title-${step}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-2xl md:text-3xl font-playfair italic text-gradient-gold mb-2"
                            >
                                {STEPS[step].title}
                            </motion.h2>
                            <motion.p 
                                key={`subtitle-${step}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="text-stellar-500 text-sm"
                            >
                                {STEPS[step].subtitle}
                            </motion.p>
                        </div>

                        {/* Step Content */}
                        <div className="min-h-[320px] md:min-h-[360px]">
                            <AnimatePresence mode="wait">

                                {/* ════════════════════════════════════════════════
                                    STEP 1: VIBRATION
                                ════════════════════════════════════════════════ */}
                                {step === 0 && (
                                    <motion.div key="step1" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                                        <p className="text-center text-stellar-400 text-sm italic mb-6">
                                            "Partagez ce qui illumine et ce qui assombrit votre quotidien."
                                        </p>
                                        <div className="grid md:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400/90 font-medium">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                    Ce qui vous porte
                                                </label>
                                                <textarea
                                                    {...register("highs")}
                                                    placeholder="Vos victoires, vos joies récentes..."
                                                    className="w-full h-36 bg-abyss-600/50 border border-white/[0.08] rounded-xl p-4 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition-all resize-none"
                                                />
                                                {errors.highs && <span className="text-rose-400 text-xs">{errors.highs.message}</span>}
                                            </div>
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-rose-400/90 font-medium">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                                    Ce qui vous pèse
                                                </label>
                                                <textarea
                                                    {...register("lows")}
                                                    placeholder="Vos doutes, vos obstacles..."
                                                    className="w-full h-36 bg-abyss-600/50 border border-white/[0.08] rounded-xl p-4 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/10 focus:outline-none transition-all resize-none"
                                                />
                                                {errors.lows && <span className="text-rose-400 text-xs">{errors.lows.message}</span>}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* ════════════════════════════════════════════════
                                    STEP 2: SOMATIC
                                ════════════════════════════════════════════════ */}
                                {step === 1 && (
                                    <motion.div key="step2" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                                        <p className="text-center text-stellar-400 text-sm italic mb-6">
                                            "Le corps exprime souvent ce que l'esprit tait."
                                        </p>

                                        {/* Side Selector */}
                                        <div className="flex justify-center gap-4">
                                            {["Left", "Right"].map((side) => (
                                                <button
                                                    key={side}
                                                    type="button"
                                                    onClick={() => {
                                                        setValue("strongSide", side as "Left" | "Right");
                                                        setValue("weakSide", side === "Left" ? "Right" : "Left");
                                                    }}
                                                    className={`relative w-36 py-5 rounded-2xl border transition-all duration-300 ${watch("strongSide") === side
                                                        ? "bg-horizon-400/15 border-horizon-400/60 shadow-[0_0_30px_rgba(232,168,56,0.15)]"
                                                        : "bg-abyss-600/30 border-white/[0.08] hover:border-white/20"
                                                    }`}
                                                >
                                                    <span className={`block text-xl font-medium mb-1 ${watch("strongSide") === side ? "text-horizon-300" : "text-stellar-400"}`}>
                                                        {side === "Left" ? "🤚 Gauche" : "✋ Droite"}
                                                    </span>
                                                    <span className="text-[10px] uppercase tracking-wider text-stellar-500">Côté de Force</span>
                                                    {watch("strongSide") === side && (
                                                        <motion.div 
                                                            layoutId="sideIndicator"
                                                            className="absolute -top-px left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-transparent via-horizon-400 to-transparent"
                                                        />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        {errors.strongSide && <p className="text-center text-rose-400 text-xs">{errors.strongSide.message}</p>}

                                        <div className="grid md:grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-2">
                                                <label className="text-xs uppercase tracking-wider text-stellar-500 font-medium">Zone de vulnérabilité</label>
                                                <input
                                                    {...register("weakZone")}
                                                    className="w-full bg-abyss-600/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-horizon-400/50 focus:ring-2 focus:ring-horizon-400/10 focus:outline-none transition-all"
                                                    placeholder="Ex: Bas du dos, nuque..."
                                                />
                                                {errors.weakZone && <span className="text-rose-400 text-xs">{errors.weakZone.message}</span>}
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs uppercase tracking-wider text-stellar-500 font-medium">Zone de puissance</label>
                                                <input
                                                    {...register("strongZone")}
                                                    className="w-full bg-abyss-600/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-horizon-400/50 focus:ring-2 focus:ring-horizon-400/10 focus:outline-none transition-all"
                                                    placeholder="Ex: Le regard, les mains..."
                                                />
                                                {errors.strongZone && <span className="text-rose-400 text-xs">{errors.strongZone.message}</span>}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* ════════════════════════════════════════════════
                                    STEP 3: RHYTHM
                                ════════════════════════════════════════════════ */}
                                {step === 2 && (
                                    <motion.div key="step3" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-5">
                                        <p className="text-center text-stellar-400 text-sm italic mb-4">
                                            "Comment souhaitez-vous recevoir les messages de l'Oracle ?"
                                        </p>
                                        <div className="space-y-3">
                                            {(Object.keys(DELIVERY_STYLES) as Array<keyof typeof DELIVERY_STYLES>).map((style) => (
                                                <button
                                                    key={style}
                                                    type="button"
                                                    onClick={() => setValue("deliveryStyle", style)}
                                                    className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 flex items-center gap-4 group ${watch("deliveryStyle") === style
                                                        ? "bg-horizon-400/10 border-horizon-400/50 shadow-[0_0_25px_rgba(232,168,56,0.1)]"
                                                        : "bg-abyss-600/30 border-white/[0.06] hover:bg-abyss-600/50 hover:border-white/10"
                                                    }`}
                                                >
                                                    <div className={`text-3xl transition-transform duration-300 ${watch("deliveryStyle") === style ? "scale-110" : "group-hover:scale-105"}`}>
                                                        {DELIVERY_STYLES[style].icon}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className={`font-playfair text-lg ${watch("deliveryStyle") === style ? "text-horizon-300" : "text-stellar-200"}`}>
                                                            {DELIVERY_STYLES[style].title}
                                                            <span className="text-stellar-500 font-sans text-sm ml-2">— {DELIVERY_STYLES[style].subtitle}</span>
                                                        </h4>
                                                        <p className="text-xs text-stellar-500 mt-0.5">{DELIVERY_STYLES[style].description}</p>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                        watch("deliveryStyle") === style 
                                                            ? "border-horizon-400 bg-horizon-400" 
                                                            : "border-white/20"
                                                    }`}>
                                                        {watch("deliveryStyle") === style && <Check className="w-3 h-3 text-abyss-900" />}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        {errors.deliveryStyle && <p className="text-center text-rose-400 text-xs">{errors.deliveryStyle.message}</p>}
                                    </motion.div>
                                )}

                                {/* ════════════════════════════════════════════════
                                    STEP 4: IDENTITY
                                ════════════════════════════════════════════════ */}
                                {step === 3 && (
                                    <motion.div key="step4" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                                        <p className="text-center text-stellar-400 text-sm italic mb-4">
                                            "Pour tracer votre carte, nous avons besoin de vos coordonnées cosmiques."
                                        </p>

                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-stellar-500 font-medium">
                                                    <Calendar className="w-3.5 h-3.5" /> Date de naissance
                                                </label>
                                                <input 
                                                    type="date" 
                                                    {...register("birthDate")} 
                                                    className="w-full bg-abyss-600/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-stellar-200 focus:border-horizon-400/50 focus:ring-2 focus:ring-horizon-400/10 focus:outline-none transition-all [color-scheme:dark]" 
                                                />
                                                {errors.birthDate && <span className="text-rose-400 text-xs">{errors.birthDate.message}</span>}
                                            </div>
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-stellar-500 font-medium">
                                                    <Clock className="w-3.5 h-3.5" /> Heure <span className="text-stellar-600">(optionnel)</span>
                                                </label>
                                                <input 
                                                    type="time" 
                                                    {...register("birthTime")} 
                                                    className="w-full bg-abyss-600/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-stellar-200 focus:border-horizon-400/50 focus:ring-2 focus:ring-horizon-400/10 focus:outline-none transition-all [color-scheme:dark]" 
                                                />
                                            </div>
                                            <div className="md:col-span-2 space-y-2">
                                                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-stellar-500 font-medium">
                                                    <MapPin className="w-3.5 h-3.5" /> Lieu de naissance
                                                </label>
                                                <input 
                                                    {...register("birthPlace")} 
                                                    placeholder="Ville, Pays" 
                                                    className="w-full bg-abyss-600/50 border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-stellar-200 placeholder:text-stellar-600 focus:border-horizon-400/50 focus:ring-2 focus:ring-horizon-400/10 focus:outline-none transition-all" 
                                                />
                                                {errors.birthPlace && <span className="text-rose-400 text-xs">{errors.birthPlace.message}</span>}
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-white/[0.04]">
                                            <h4 className="flex items-center gap-2 text-sm text-horizon-300 font-medium mb-4">
                                                <Camera className="w-4 h-4" /> Photos <span className="text-stellar-600 font-normal">(optionnel)</span>
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <SmartPhotoUploader
                                                    label="Visage"
                                                    description="Physiognomonie"
                                                    value={watch("facePhoto") || undefined}
                                                    onChange={(val) => setValue("facePhoto", val || undefined)}
                                                />
                                                <SmartPhotoUploader
                                                    label="Paume"
                                                    description="Chiromancie"
                                                    value={watch("palmPhoto") || undefined}
                                                    onChange={(val) => setValue("palmPhoto", val || undefined)}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* ════════════════════════════════════════════════
                                    STEP 5: CONSENT
                                ════════════════════════════════════════════════ */}
                                {step === 4 && (
                                    <motion.div key="step5" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="text-center space-y-6">
                                        <motion.div 
                                            animate={{ 
                                                boxShadow: ["0 0 30px rgba(232,168,56,0.2)", "0 0 50px rgba(232,168,56,0.4)", "0 0 30px rgba(232,168,56,0.2)"]
                                            }}
                                            transition={{ duration: 3, repeat: Infinity }}
                                            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-horizon-400/20 to-horizon-500/10 border border-horizon-400/30"
                                        >
                                            <Sparkles className="w-10 h-10 text-horizon-400" />
                                        </motion.div>

                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-playfair italic text-stellar-100">Prêt pour le scellement</h3>
                                            <p className="text-stellar-400 text-sm max-w-md mx-auto">
                                                Merci de votre confiance. En confirmant, vous confiez ces éléments à l'Oracle pour votre analyse personnelle.
                                            </p>
                                        </div>

                                        <div className="bg-abyss-600/40 rounded-2xl p-6 text-left max-w-sm mx-auto border border-white/[0.06] space-y-5">
                                            <div className="space-y-3">
                                                {[
                                                    "Profil Vibratoire complet",
                                                    "Données Somatiques enregistrées",
                                                    "Coordonnées de naissance validées"
                                                ].map((item, i) => (
                                                    <motion.div 
                                                        key={item}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.15 }}
                                                        className="flex items-center gap-3 text-sm text-stellar-300"
                                                    >
                                                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                                            <Check className="w-3 h-3 text-emerald-400" />
                                                        </div>
                                                        {item}
                                                    </motion.div>
                                                ))}
                                            </div>

                                            <div className="pt-4 border-t border-white/[0.04]">
                                                <label className="flex items-start gap-3 cursor-pointer group">
                                                    <input
                                                        type="checkbox"
                                                        {...register("gdprConsent")}
                                                        className="mt-0.5 w-5 h-5 rounded border-white/20 bg-abyss-700 text-horizon-400 focus:ring-horizon-400/30 focus:ring-offset-0 cursor-pointer"
                                                    />
                                                    <span className="text-xs text-stellar-500 leading-relaxed group-hover:text-stellar-400 transition-colors">
                                                        Je consens au traitement de mes données spirituelles et personnelles pour mon analyse Oracle.
                                                    </span>
                                                </label>
                                                {errors.gdprConsent && <p className="mt-2 text-rose-400 text-xs">{errors.gdprConsent.message}</p>}
                                            </div>
                                        </div>

                                        <p className="text-xs text-stellar-600">Délai estimé : 24h à 48h</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* ═══════════════════════════════════════════════════════════
                            FOOTER NAVIGATION
                        ═══════════════════════════════════════════════════════════ */}
                        <div className="pt-6 mt-6 border-t border-white/[0.04] flex items-center justify-between">
                            {step > 0 ? (
                                <button
                                    onClick={prevStep}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-stellar-400 hover:text-stellar-200 hover:bg-white/5 transition-all"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Retour
                                </button>
                            ) : (
                                <div />
                            )}

                            {step < STEPS.length - 1 ? (
                                <button
                                    onClick={nextStep}
                                    type="button"
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-stellar-100 font-medium border border-white/10 hover:bg-white/15 hover:border-white/20 transition-all"
                                >
                                    Suivant <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit(onSubmit, (errors) => {
                                        console.error("[HolisticWizard] Validation errors:", errors);
                                    })}
                                    type="button"
                                    disabled={isSubmitting}
                                    className="relative overflow-hidden px-8 py-3.5 rounded-xl font-semibold text-abyss-900 bg-gradient-to-r from-horizon-400 via-horizon-300 to-horizon-400 bg-[length:200%_100%] hover:bg-[position:100%_0] transition-all duration-500 shadow-[0_0_30px_rgba(232,168,56,0.3)] hover:shadow-[0_0_40px_rgba(232,168,56,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Transmission...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            Transmettre mon dossier
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Footer Text */}
                <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 text-xs text-stellar-600 text-center"
                >
                    Vos données sont protégées et utilisées uniquement pour votre lecture personnelle.
                </motion.p>
            </div>
        </div>
    );
};
