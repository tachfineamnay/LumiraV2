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
    Camera
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
    userEmail?: string; // Used to invalidate cache when email changes
}

// =============================================================================
// STEPS CONFIG
// =============================================================================

const STEPS = [
    { id: 0, title: "L'État Vibratoire", subtitle: "Vibrations", icon: Brain },
    { id: 1, title: "Le Corps Mémoire", subtitle: "Somatique", icon: Activity },
    { id: 2, title: "Votre Fréquence", subtitle: "Rythme", icon: Heart },
    { id: 3, title: "L'Ancrage", subtitle: "Identité", icon: MapPin },
    { id: 4, title: "Le Scellement", subtitle: "Consentement", icon: Sparkles },
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
        
        // Check if the cached draft belongs to the current user
        const cachedEmail = localStorage.getItem("holistic_wizard_email");
        const saved = localStorage.getItem("holistic_wizard_draft");
        
        // If userEmail is provided and doesn't match cached email, clear the cache
        if (userEmail && cachedEmail && cachedEmail !== userEmail) {
            console.log("[HolisticWizard] Email mismatch - clearing cached draft");
            localStorage.removeItem("holistic_wizard_draft");
            localStorage.removeItem("holistic_wizard_email");
            return {};
        }
        
        // Store current email for future cache validation
        if (userEmail) {
            localStorage.setItem("holistic_wizard_email", userEmail);
        }
        
        return saved ? JSON.parse(saved) : {};
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
        defaultValues: { ...loadDraft(), ...initialData },
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
        if (step === 1) fieldsToValidate = ["strongSide", "strongZone"];
        if (step === 2) fieldsToValidate = ["deliveryStyle"];
        if (step === 3) fieldsToValidate = ["birthDate", "birthPlace"];
        if (step === 4) fieldsToValidate = ["gdprConsent"];

        const isStepValid = await trigger(fieldsToValidate);
        if (isStepValid) setStep(prev => prev + 1);
    };

    const prevStep = () => setStep(prev => Math.max(0, prev - 1));

    const onSubmit = async (data: HolisticDiagnosticData) => {
        setIsSubmitting(true);
        try {
            await onComplete?.(data);
            localStorage.removeItem("holistic_wizard_draft");
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // =========================================================================
    // RENDER HELPERS
    // =========================================================================

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
        exit: { opacity: 0, y: -20, transition: { duration: 0.4 } }
    };

    const ProgressBar = () => (
        <div className="absolute top-0 left-0 w-full h-1 bg-abyss-700">
            <motion.div
                className="h-full bg-gradient-to-r from-horizon-400 to-horizon-500 shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.5 }}
            />
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4 font-sans text-stellar-100">
            <motion.div
                className="w-full max-w-2xl bg-abyss-800/50 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative"
                initial="hidden"
                animate="visible"
            >
                <ProgressBar />

                {/* HEADER */}
                <div className="p-8 pb-0 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-horizon-400/10 text-horizon-400 mb-4 border border-horizon-400/20">
                        {React.createElement(STEPS[step].icon, { className: "w-6 h-6" })}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-playfair italic text-gradient-gold mb-2">
                        {STEPS[step].title}
                    </h2>
                    <p className="text-stellar-500 text-sm uppercase tracking-widest font-medium">
                        {STEPS[step].subtitle} • Étape {step + 1}/{STEPS.length}
                    </p>
                </div>

                {/* CONTENT */}
                <div className="p-8 min-h-[400px] flex flex-col justify-center">
                    <AnimatePresence mode="wait">

                        {/* STEP 1: VIBRATION */}
                        {step === 0 && (
                            <motion.div key="step1" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                                <p className="text-center text-stellar-400 mb-6 italic">
                                    "Commençons par faire le point sur votre énergie actuelle."
                                </p>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs uppercase tracking-wider text-emerald-400/80 font-semibold">Ce qui vous porte</label>
                                        <textarea
                                            {...register("highs")}
                                            placeholder="Vos victoires, vos joies récentes..."
                                            className="w-full h-32 bg-abyss-900/50 border border-white/10 rounded-xl p-4 text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all resize-none"
                                        />
                                        {errors.highs && <span className="text-rose-400 text-xs">{errors.highs.message}</span>}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs uppercase tracking-wider text-rose-400/80 font-semibold">Ce qui vous pèse</label>
                                        <textarea
                                            {...register("lows")}
                                            placeholder="Vos doutes, vos obstacles..."
                                            className="w-full h-32 bg-abyss-900/50 border border-white/10 rounded-xl p-4 text-sm focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all resize-none"
                                        />
                                        {errors.lows && <span className="text-rose-400 text-xs">{errors.lows.message}</span>}
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: SOMATIC */}
                        {step === 1 && (
                            <motion.div key="step2" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-8">
                                <p className="text-center text-stellar-400 italic">
                                    "Le corps exprime souvent ce que l'esprit tait."
                                </p>

                                {/* Strong Side Selector */}
                                <div className="flex justify-center gap-6">
                                    {["Left", "Right"].map((side) => (
                                        <button
                                            key={side}
                                            type="button"
                                            onClick={() => {
                                                setValue("strongSide", side as "Left" | "Right");
                                                setValue("weakSide", side === "Left" ? "Right" : "Left");
                                            }}
                                            className={`w-32 py-4 rounded-xl border transition-all ${watch("strongSide") === side
                                                ? "bg-horizon-400/20 border-horizon-400 text-horizon-300 shadow-gold-glow"
                                                : "bg-abyss-900/30 border-white/10 text-stellar-500 hover:border-horizon-400/30"
                                                }`}
                                        >
                                            <span className="block text-2xl mb-1">{side === "Left" ? "Gauche" : "Droite"}</span>
                                            <span className="text-xs uppercase tracking-wider">Côté de Force</span>
                                        </button>
                                    ))}
                                </div>
                                {errors.strongSide && <p className="text-center text-rose-400 text-xs">{errors.strongSide.message}</p>}

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs uppercase tracking-wider text-stellar-500 mb-2 block">Zone de vulnérabilité (Douleurs, tensions...)</label>
                                        <input
                                            {...register("weakZone")}
                                            className="w-full bg-abyss-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-horizon-400 focus:ring-1 focus:ring-horizon-400/20 transition-all"
                                            placeholder="Ex: Bas du dos, genou droit..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs uppercase tracking-wider text-stellar-500 mb-2 block">Zone de puissance</label>
                                        <input
                                            {...register("strongZone")}
                                            className="w-full bg-abyss-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-horizon-400 focus:ring-1 focus:ring-horizon-400/20 transition-all"
                                            placeholder="Ex: Le regard, les mains, la voix..."
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3: RHYTHM */}
                        {step === 2 && (
                            <motion.div key="step3" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                                <p className="text-center text-stellar-400 italic mb-4">
                                    "Comment souhaitez-vous recevoir les messages de l'Oracle ?"
                                </p>
                                <div className="grid gap-4">
                                    {(Object.keys(DELIVERY_STYLES) as Array<keyof typeof DELIVERY_STYLES>).map((style) => (
                                        <button
                                            key={style}
                                            type="button"
                                            onClick={() => setValue("deliveryStyle", style)}
                                            className={`text-left p-6 rounded-2xl border transition-all flex items-center justify-between group ${watch("deliveryStyle") === style
                                                ? "bg-horizon-400/10 border-horizon-400"
                                                : "bg-abyss-900/30 border-white/10 hover:bg-abyss-900/50 hover:border-white/20"
                                                }`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="text-2xl">{DELIVERY_STYLES[style].icon}</div>
                                                <div>
                                                    <h4 className={`font-playfair text-lg mb-1 ${watch("deliveryStyle") === style ? "text-horizon-300" : "text-stellar-200"}`}>
                                                        {DELIVERY_STYLES[style].title} – {DELIVERY_STYLES[style].subtitle}
                                                    </h4>
                                                    <p className="text-sm text-stellar-500">{DELIVERY_STYLES[style].description}</p>
                                                </div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${watch("deliveryStyle") === style ? "border-horizon-400 bg-horizon-400 text-abyss-900" : "border-white/20"
                                                }`}>
                                                {watch("deliveryStyle") === style && <Check className="w-4 h-4" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {errors.deliveryStyle && <p className="text-center text-rose-400 text-xs">{errors.deliveryStyle.message}</p>}
                            </motion.div>
                        )}

                        {/* STEP 4: IDENTITY */}
                        {step === 3 && (
                            <motion.div key="step4" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
                                <p className="text-center text-stellar-400 italic">
                                    "Pour tracer votre carte, nous avons besoin de vos coordonnées précises."
                                </p>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-stellar-500"><Calendar className="w-3 h-3" /> Date de naissance</label>
                                        <input type="date" {...register("birthDate")} className="w-full bg-abyss-900/50 border border-white/10 rounded-xl px-4 py-3" />
                                        {errors.birthDate && <span className="text-rose-400 text-xs">{errors.birthDate.message}</span>}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-stellar-500"><Clock className="w-3 h-3" /> Heure (Approx.)</label>
                                        <input type="time" {...register("birthTime")} className="w-full bg-abyss-900/50 border border-white/10 rounded-xl px-4 py-3" />
                                    </div>
                                    <div className="col-span-full space-y-2">
                                        <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-stellar-500"><MapPin className="w-3 h-3" /> Lieu de naissance</label>
                                        <input {...register("birthPlace")} placeholder="Ville, Pays" className="w-full bg-abyss-900/50 border border-white/10 rounded-xl px-4 py-3" />
                                        {errors.birthPlace && <span className="text-rose-400 text-xs">{errors.birthPlace.message}</span>}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5">
                                    <h4 className="flex items-center gap-2 text-sm text-horizon-300 font-medium mb-4">
                                        <Camera className="w-4 h-4" /> Photos (Optionnel)
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

                        {/* STEP 5: CONSENT */}
                        {step === 4 && (
                            <motion.div key="step5" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="text-center space-y-8">
                                <div className="inline-block p-6 rounded-full bg-horizon-400/5 border border-horizon-400/20 mb-4">
                                    <Sparkles className="w-12 h-12 text-horizon-400 animate-pulse" />
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-2xl font-playfair italic text-white">Prêt pour le scellement</h3>
                                    <p className="text-stellar-400 max-w-md mx-auto">
                                        Merci de votre confiance. En cliquant, vous confiez ces éléments à l'Oracle pour votre analyse personnelle.
                                    </p>
                                </div>

                                <div className="bg-abyss-900/50 rounded-xl p-6 text-left max-w-sm mx-auto border border-white/5 space-y-6">
                                    <ul className="space-y-3 text-sm text-stellar-300">
                                        <li className="flex items-center gap-3">
                                            <Check className="w-4 h-4 text-emerald-400" /> Profil Vibratoire complet
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <Check className="w-4 h-4 text-emerald-400" /> Données Somatiques enregistrées
                                        </li>
                                        <li className="flex items-center gap-3">
                                            <Check className="w-4 h-4 text-emerald-400" /> Coordonnées de naissance validées
                                        </li>
                                    </ul>

                                    <div className="pt-4 border-t border-white/5">
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                {...register("gdprConsent")}
                                                className="mt-1 w-4 h-4 rounded border-white/10 bg-abyss-900 text-horizon-400 focus:ring-horizon-400/20"
                                            />
                                            <span className="text-xs text-stellar-500 leading-tight group-hover:text-stellar-400 transition-colors">
                                                Je consens au traitement de mes données spirituelles et personnelles pour mon analyse Oracle.
                                            </span>
                                        </label>
                                        {errors.gdprConsent && <p className="mt-2 text-rose-400 text-[10px]">{errors.gdprConsent.message}</p>}
                                    </div>
                                </div>

                                <p className="text-xs text-stellar-600">Délai estimé : 24h à 48h</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* FOOTER ACTIONS */}
                <div className="p-8 border-t border-white/5 flex items-center justify-between">
                    {step > 0 ? (
                        <button
                            onClick={prevStep}
                            className="flex items-center gap-2 text-stellar-500 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> Retour
                        </button>
                    ) : (
                        <div /> // Spacer
                    )}

                    {step < STEPS.length - 1 ? (
                        <button
                            onClick={nextStep}
                            className="bg-white text-abyss-900 px-6 py-3 rounded-xl font-medium hover:bg-horizon-100 transition-colors flex items-center gap-2 hover:shadow-lg hover:shadow-white/10"
                        >
                            Suivant <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit(onSubmit)}
                            disabled={isSubmitting}
                            className="bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-900 px-8 py-4 rounded-xl font-bold tracking-wide hover:shadow-gold-glow transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "TRANSMETTRE MON DOSSIER"}
                        </button>
                    )}
                </div>

            </motion.div>
        </div>
    );
};
