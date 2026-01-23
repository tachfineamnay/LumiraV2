"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
    Sparkles,
    Calendar,
    Clock,
    MapPin,
    Camera,
    ArrowRight,
    ArrowLeft,
    Check,
    Loader2,
    Sun,
    Moon,
    Zap,
    Shield,
    Eye,
    Heart,
    Activity,
    User,
    Lock,
} from "lucide-react";
import axios from "axios";

import { SmartPhotoUploader } from "./SmartPhotoUploader";
import {
    holisticDiagnosticSchema,
    vibrationSchema,
    somaticSchema,
    rhythmSchema,
    identitySchema,
    defaultHolisticData,
    BODY_ZONES,
    DELIVERY_STYLES,
    type HolisticDiagnosticData,
    type DeliveryStyle,
    type Laterality,
} from "../../lib/holisticSchema";
import { useSanctuaireAuth } from "../../context/SanctuaireAuthContext";

// =============================================================================
// TYPES
// =============================================================================

interface HolisticWizardProps {
    onComplete?: () => void;
}

type Step = 0 | 1 | 2 | 3 | 4;

interface StepConfig {
    id: Step;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    vibe: string;
}

const STEPS: StepConfig[] = [
    {
        id: 0,
        title: "L'État Vibratoire",
        subtitle: "Lumière & Ombre",
        icon: Activity,
        vibe: "Pour vous élever, nous devons connaître le poids de vos chaînes.",
    },
    {
        id: 1,
        title: "Le Corps Mémoire",
        subtitle: "Cartographie Somatique",
        icon: Heart,
        vibe: "Le corps ne ment jamais. Où réside votre puissance ?",
    },
    {
        id: 2,
        title: "La Fréquence",
        subtitle: "Votre Résonance",
        icon: Zap,
        vibe: "Comment souhaitez-vous recevoir les messages de l'Oracle ?",
    },
    {
        id: 3,
        title: "L'Ancrage",
        subtitle: "Coordonnées Célestes",
        icon: User,
        vibe: "La position des astres à votre naissance révèle votre destin.",
    },
    {
        id: 4,
        title: "Le Scellement",
        subtitle: "Alliance Sacrée",
        icon: Lock,
        vibe: "Votre diagnostic est complet. Scellez votre engagement.",
    },
];

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const pageVariants = {
    initial: { opacity: 0, x: 100, scale: 0.95 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: -100, scale: 0.95 },
};

const pageTransition = {
    type: "spring",
    stiffness: 100,
    damping: 20,
    duration: 0.6,
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.5 },
    }),
};

// =============================================================================
// STEP 1: VIBRATION (L'État Vibratoire)
// =============================================================================

interface StepVibrationProps {
    control: ReturnType<typeof useForm<HolisticDiagnosticData>>["control"];
    errors: ReturnType<typeof useForm<HolisticDiagnosticData>>["formState"]["errors"];
    onNext: () => void;
}

const StepVibration = ({ control, errors, onNext }: StepVibrationProps) => {
    const [highsCount, setHighsCount] = useState(0);
    const [lowsCount, setLowsCount] = useState(0);

    return (
        <motion.div
            key="vibration"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="space-y-6"
        >
            {/* Header */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={0}
                className="text-center mb-8"
            >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400/20 to-violet-500/20 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <Activity className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-2xl font-playfair italic text-stellar-100">
                    L&apos;État Vibratoire
                </h3>
                <p className="text-stellar-500 text-sm mt-2 max-w-md mx-auto italic">
                    &quot;Pour vous élever, nous devons connaître le poids de vos chaînes.&quot;
                </p>
            </motion.div>

            {/* Split Screen: Lumière & Ombre */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Lumière (Highs) */}
                <motion.div
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    custom={1}
                    className="relative group"
                >
                    <div className="absolute -inset-1 bg-gradient-to-br from-amber-400/20 to-amber-600/10 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                    <div className="relative bg-abyss-600/60 backdrop-blur-xl border border-amber-400/20 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center">
                                <Sun className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-amber-300">Lumière</h4>
                                <p className="text-xs text-stellar-500">Ce qui illumine votre vie</p>
                            </div>
                        </div>

                        <Controller
                            name="highs"
                            control={control}
                            render={({ field }) => (
                                <textarea
                                    {...field}
                                    onChange={(e) => {
                                        field.onChange(e);
                                        setHighsCount(e.target.value.length);
                                    }}
                                    rows={6}
                                    placeholder="Vos forces, vos joies, ce qui vous fait vibrer haut..."
                                    className="w-full px-4 py-3 bg-abyss-700/50 border border-amber-400/10 rounded-xl text-stellar-100 placeholder-stellar-600 focus:border-amber-400/40 focus:ring-2 focus:ring-amber-400/20 transition-all resize-none"
                                />
                            )}
                        />
                        <div className="flex items-center justify-between mt-2">
                            {errors.highs ? (
                                <p className="text-rose-400 text-xs">{errors.highs.message}</p>
                            ) : (
                                <span />
                            )}
                            <span className={`text-xs ${highsCount > 1800 ? "text-rose-400" : "text-stellar-600"}`}>
                                {highsCount}/2000
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Ombre (Lows) */}
                <motion.div
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    custom={2}
                    className="relative group"
                >
                    <div className="absolute -inset-1 bg-gradient-to-br from-violet-500/20 to-violet-800/10 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                    <div className="relative bg-abyss-600/60 backdrop-blur-xl border border-violet-500/20 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center">
                                <Moon className="w-5 h-5 text-violet-400" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-violet-300">Ombre</h4>
                                <p className="text-xs text-stellar-500">Ce qui pèse sur votre âme</p>
                            </div>
                        </div>

                        <Controller
                            name="lows"
                            control={control}
                            render={({ field }) => (
                                <textarea
                                    {...field}
                                    onChange={(e) => {
                                        field.onChange(e);
                                        setLowsCount(e.target.value.length);
                                    }}
                                    rows={6}
                                    placeholder="Vos blocages, vos peurs, ce qui vous tire vers le bas..."
                                    className="w-full px-4 py-3 bg-abyss-700/50 border border-violet-500/10 rounded-xl text-stellar-100 placeholder-stellar-600 focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
                                />
                            )}
                        />
                        <div className="flex items-center justify-between mt-2">
                            {errors.lows ? (
                                <p className="text-rose-400 text-xs">{errors.lows.message}</p>
                            ) : (
                                <span />
                            )}
                            <span className={`text-xs ${lowsCount > 1800 ? "text-rose-400" : "text-stellar-600"}`}>
                                {lowsCount}/2000
                            </span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Navigation */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={3}
                className="flex justify-end pt-4"
            >
                <button
                    type="button"
                    onClick={onNext}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-abyss-900 font-semibold hover:shadow-lg hover:shadow-amber-500/25 transition-all"
                >
                    Continuer
                    <ArrowRight className="w-4 h-4" />
                </button>
            </motion.div>
        </motion.div>
    );
};

// =============================================================================
// STEP 2: SOMATIC (Le Corps Mémoire)
// =============================================================================

interface StepSomaticProps {
    control: ReturnType<typeof useForm<HolisticDiagnosticData>>["control"];
    errors: ReturnType<typeof useForm<HolisticDiagnosticData>>["formState"]["errors"];
    watch: ReturnType<typeof useForm<HolisticDiagnosticData>>["watch"];
    onNext: () => void;
    onBack: () => void;
}

const StepSomatic = ({ control, errors, watch, onNext, onBack }: StepSomaticProps) => {
    const strongSide = watch("strongSide");
    const weakSide = watch("weakSide");

    return (
        <motion.div
            key="somatic"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="space-y-6"
        >
            {/* Header */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={0}
                className="text-center mb-8"
            >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-600/20 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-8 h-8 text-rose-400" />
                </div>
                <h3 className="text-2xl font-playfair italic text-stellar-100">
                    Le Corps Mémoire
                </h3>
                <p className="text-stellar-500 text-sm mt-2 max-w-md mx-auto italic">
                    &quot;Le corps ne ment jamais. Où réside votre puissance ?&quot;
                </p>
            </motion.div>

            {/* Laterality Selector */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={1}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
                {/* Strong Side */}
                <div className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <label className="block text-sm font-medium text-emerald-400 mb-3">
                        Côté Dominant (Votre Force)
                    </label>
                    <Controller
                        name="strongSide"
                        control={control}
                        render={({ field }) => (
                            <div className="flex gap-3">
                                {(["Left", "Right"] as Laterality[]).map((side) => (
                                    <button
                                        key={side}
                                        type="button"
                                        onClick={() => field.onChange(side)}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${
                                            field.value === side
                                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                                                : "bg-abyss-700/50 border-white/10 text-stellar-400 hover:border-white/20"
                                        }`}
                                    >
                                        {side === "Left" ? "Gauche" : "Droite"}
                                    </button>
                                ))}
                            </div>
                        )}
                    />
                </div>

                {/* Weak Side */}
                <div className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <label className="block text-sm font-medium text-rose-400 mb-3">
                        Côté Vulnérable (Votre Faille)
                    </label>
                    <Controller
                        name="weakSide"
                        control={control}
                        render={({ field }) => (
                            <div className="flex gap-3">
                                {(["Left", "Right"] as Laterality[]).map((side) => (
                                    <button
                                        key={side}
                                        type="button"
                                        onClick={() => field.onChange(side)}
                                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all ${
                                            field.value === side
                                                ? "bg-rose-500/20 border-rose-500 text-rose-300"
                                                : "bg-abyss-700/50 border-white/10 text-stellar-400 hover:border-white/20"
                                        }`}
                                    >
                                        {side === "Left" ? "Gauche" : "Droite"}
                                    </button>
                                ))}
                            </div>
                        )}
                    />
                </div>
            </motion.div>

            {/* Body Zones */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={2}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
                {/* Strong Zone */}
                <div className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <label className="block text-sm font-medium text-emerald-400 mb-2">
                        <Shield className="w-4 h-4 inline mr-2" />
                        Votre Armure (Zone Forte)
                    </label>
                    <p className="text-xs text-stellar-500 mb-3">
                        La partie de votre corps où vous puisez votre force
                    </p>
                    <Controller
                        name="strongZone"
                        control={control}
                        render={({ field }) => (
                            <>
                                <input
                                    {...field}
                                    type="text"
                                    placeholder="Ex: Épaules, Regard, Mains..."
                                    className="w-full px-4 py-3 bg-abyss-700/50 border border-white/10 rounded-xl text-stellar-100 placeholder-stellar-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                />
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {BODY_ZONES.strength.slice(0, 5).map((zone) => (
                                        <button
                                            key={zone}
                                            type="button"
                                            onClick={() => field.onChange(zone)}
                                            className={`px-3 py-1 text-xs rounded-full border transition-all ${
                                                field.value === zone
                                                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                                                    : "bg-abyss-700/50 border-white/10 text-stellar-500 hover:border-white/20"
                                            }`}
                                        >
                                            {zone}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    />
                    {errors.strongZone && (
                        <p className="text-rose-400 text-xs mt-2">{errors.strongZone.message}</p>
                    )}
                </div>

                {/* Weak Zone */}
                <div className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
                    <label className="block text-sm font-medium text-rose-400 mb-2">
                        <Eye className="w-4 h-4 inline mr-2" />
                        Votre Faille (Zone Faible)
                    </label>
                    <p className="text-xs text-stellar-500 mb-3">
                        La partie de votre corps où se loge votre vulnérabilité
                    </p>
                    <Controller
                        name="weakZone"
                        control={control}
                        render={({ field }) => (
                            <>
                                <input
                                    {...field}
                                    type="text"
                                    placeholder="Ex: Ventre, Gorge, Cœur..."
                                    className="w-full px-4 py-3 bg-abyss-700/50 border border-white/10 rounded-xl text-stellar-100 placeholder-stellar-600 focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/20 transition-all"
                                />
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {BODY_ZONES.weakness.slice(0, 5).map((zone) => (
                                        <button
                                            key={zone}
                                            type="button"
                                            onClick={() => field.onChange(zone)}
                                            className={`px-3 py-1 text-xs rounded-full border transition-all ${
                                                field.value === zone
                                                    ? "bg-rose-500/20 border-rose-500 text-rose-300"
                                                    : "bg-abyss-700/50 border-white/10 text-stellar-500 hover:border-white/20"
                                            }`}
                                        >
                                            {zone}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    />
                    {errors.weakZone && (
                        <p className="text-rose-400 text-xs mt-2">{errors.weakZone.message}</p>
                    )}
                </div>
            </motion.div>

            {/* Ailments */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={3}
                className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5"
            >
                <label className="block text-sm font-medium text-stellar-300 mb-2">
                    Maladies ou Douleurs Chroniques
                    <span className="text-stellar-600 text-xs ml-2">(Optionnel)</span>
                </label>
                <Controller
                    name="ailments"
                    control={control}
                    render={({ field }) => (
                        <textarea
                            {...field}
                            rows={3}
                            placeholder="Décrivez vos maux physiques récurrents, allergies, sensibilités..."
                            className="w-full px-4 py-3 bg-abyss-700/50 border border-white/10 rounded-xl text-stellar-100 placeholder-stellar-600 focus:border-stellar-400/40 focus:ring-2 focus:ring-stellar-400/20 transition-all resize-none"
                        />
                    )}
                />
            </motion.div>

            {/* Navigation */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={4}
                className="flex items-center justify-between pt-4"
            >
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 text-stellar-500 hover:text-stellar-300 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold hover:shadow-lg hover:shadow-rose-500/25 transition-all"
                >
                    Continuer
                    <ArrowRight className="w-4 h-4" />
                </button>
            </motion.div>
        </motion.div>
    );
};

// =============================================================================
// STEP 3: RHYTHM (La Fréquence)
// =============================================================================

interface StepRhythmProps {
    control: ReturnType<typeof useForm<HolisticDiagnosticData>>["control"];
    errors: ReturnType<typeof useForm<HolisticDiagnosticData>>["formState"]["errors"];
    watch: ReturnType<typeof useForm<HolisticDiagnosticData>>["watch"];
    onNext: () => void;
    onBack: () => void;
}

const StepRhythm = ({ control, errors, watch, onNext, onBack }: StepRhythmProps) => {
    const selectedStyle = watch("deliveryStyle");
    const pace = watch("pace");

    return (
        <motion.div
            key="rhythm"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="space-y-6"
        >
            {/* Header */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={0}
                className="text-center mb-8"
            >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400/20 to-blue-600/20 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-playfair italic text-stellar-100">
                    La Fréquence
                </h3>
                <p className="text-stellar-500 text-sm mt-2 max-w-md mx-auto italic">
                    &quot;Comment souhaitez-vous recevoir les messages de l&apos;Oracle ?&quot;
                </p>
            </motion.div>

            {/* Delivery Style Cards */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={1}
            >
                <label className="block text-sm font-medium text-stellar-300 mb-4 text-center">
                    Choisissez votre style de guidance
                </label>
                <Controller
                    name="deliveryStyle"
                    control={control}
                    render={({ field }) => (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(Object.entries(DELIVERY_STYLES) as [DeliveryStyle, typeof DELIVERY_STYLES[DeliveryStyle]][]).map(
                                ([key, style]) => (
                                    <motion.button
                                        key={key}
                                        type="button"
                                        onClick={() => field.onChange(key)}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`relative group p-6 rounded-2xl border-2 transition-all text-left ${
                                            field.value === key
                                                ? "bg-gradient-to-br from-horizon-400/20 to-horizon-600/10 border-horizon-400 shadow-lg shadow-horizon-400/20"
                                                : "bg-abyss-600/40 border-white/10 hover:border-white/20"
                                        }`}
                                    >
                                        {/* Selection indicator */}
                                        {field.value === key && (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-horizon-400 flex items-center justify-center"
                                            >
                                                <Check className="w-4 h-4 text-abyss-900" />
                                            </motion.div>
                                        )}

                                        <span className="text-4xl mb-4 block">{style.icon}</span>
                                        <h4 className={`text-lg font-semibold mb-1 ${
                                            field.value === key ? "text-horizon-300" : "text-stellar-200"
                                        }`}>
                                            {style.title}
                                        </h4>
                                        <p className={`text-sm mb-2 ${
                                            field.value === key ? "text-horizon-400" : "text-stellar-400"
                                        }`}>
                                            {style.subtitle}
                                        </p>
                                        <p className="text-xs text-stellar-500">
                                            {style.description}
                                        </p>
                                    </motion.button>
                                )
                            )}
                        </div>
                    )}
                />
            </motion.div>

            {/* Pace Slider */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={2}
                className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            >
                <label className="block text-sm font-medium text-stellar-300 mb-4 text-center">
                    Rythme de transformation
                </label>
                <Controller
                    name="pace"
                    control={control}
                    render={({ field }) => (
                        <div className="space-y-4">
                            <div className="relative">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={field.value}
                                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                                    className="w-full h-2 bg-abyss-700 rounded-full appearance-none cursor-pointer accent-horizon-400
                                        [&::-webkit-slider-thumb]:appearance-none
                                        [&::-webkit-slider-thumb]:w-6
                                        [&::-webkit-slider-thumb]:h-6
                                        [&::-webkit-slider-thumb]:rounded-full
                                        [&::-webkit-slider-thumb]:bg-gradient-to-r
                                        [&::-webkit-slider-thumb]:from-horizon-400
                                        [&::-webkit-slider-thumb]:to-horizon-500
                                        [&::-webkit-slider-thumb]:shadow-lg
                                        [&::-webkit-slider-thumb]:shadow-horizon-400/30
                                        [&::-webkit-slider-thumb]:border-2
                                        [&::-webkit-slider-thumb]:border-white/20
                                        [&::-webkit-slider-thumb]:transition-transform
                                        [&::-webkit-slider-thumb]:hover:scale-110"
                                />
                                {/* Progress track */}
                                <div
                                    className="absolute top-0 left-0 h-2 bg-gradient-to-r from-serenity-500 to-horizon-400 rounded-full pointer-events-none"
                                    style={{ width: `${field.value}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className={`flex items-center gap-2 ${
                                    field.value < 50 ? "text-serenity-400" : "text-stellar-500"
                                }`}>
                                    🐢 Intégration Lente
                                </span>
                                <span className="text-stellar-400 font-mono">
                                    {field.value}%
                                </span>
                                <span className={`flex items-center gap-2 ${
                                    field.value >= 50 ? "text-horizon-400" : "text-stellar-500"
                                }`}>
                                    Transformation Radicale ⚡
                                </span>
                            </div>
                        </div>
                    )}
                />
            </motion.div>

            {/* Navigation */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={3}
                className="flex items-center justify-between pt-4"
            >
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 text-stellar-500 hover:text-stellar-300 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                >
                    Continuer
                    <ArrowRight className="w-4 h-4" />
                </button>
            </motion.div>
        </motion.div>
    );
};

// =============================================================================
// STEP 4: IDENTITY (L'Ancrage)
// =============================================================================

interface StepIdentityProps {
    control: ReturnType<typeof useForm<HolisticDiagnosticData>>["control"];
    errors: ReturnType<typeof useForm<HolisticDiagnosticData>>["formState"]["errors"];
    setValue: ReturnType<typeof useForm<HolisticDiagnosticData>>["setValue"];
    watch: ReturnType<typeof useForm<HolisticDiagnosticData>>["watch"];
    onNext: () => void;
    onBack: () => void;
}

const StepIdentity = ({ control, errors, setValue, watch, onNext, onBack }: StepIdentityProps) => {
    const facePhoto = watch("facePhoto");
    const palmPhoto = watch("palmPhoto");

    return (
        <motion.div
            key="identity"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="space-y-6"
        >
            {/* Header */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={0}
                className="text-center mb-8"
            >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-horizon-400/20 to-amber-500/20 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-horizon-400" />
                </div>
                <h3 className="text-2xl font-playfair italic text-stellar-100">
                    L&apos;Ancrage
                </h3>
                <p className="text-stellar-500 text-sm mt-2 max-w-md mx-auto italic">
                    &quot;La position des astres à votre naissance révèle votre destin.&quot;
                </p>
            </motion.div>

            {/* Birth Data */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={1}
                className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            >
                <h4 className="text-lg font-medium text-stellar-200 mb-4">Coordonnées Célestes</h4>
                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2">
                            <Calendar className="w-3 h-3" /> Date de naissance
                        </label>
                        <Controller
                            name="birthDate"
                            control={control}
                            render={({ field }) => (
                                <input
                                    {...field}
                                    type="date"
                                    className="w-full px-4 py-3 bg-abyss-700/50 border border-white/10 rounded-xl text-stellar-100 focus:border-horizon-400 focus:ring-2 focus:ring-horizon-400/20 transition-all"
                                />
                            )}
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
                            <Controller
                                name="birthTime"
                                control={control}
                                render={({ field }) => (
                                    <input
                                        {...field}
                                        type="time"
                                        className="w-full px-4 py-3 bg-abyss-700/50 border border-white/10 rounded-xl text-stellar-100 focus:border-horizon-400 focus:ring-2 focus:ring-horizon-400/20 transition-all"
                                    />
                                )}
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs text-stellar-400 uppercase tracking-wider mb-2">
                                <MapPin className="w-3 h-3" /> Lieu
                            </label>
                            <Controller
                                name="birthPlace"
                                control={control}
                                render={({ field }) => (
                                    <input
                                        {...field}
                                        type="text"
                                        placeholder="Paris, France"
                                        className="w-full px-4 py-3 bg-abyss-700/50 border border-white/10 rounded-xl text-stellar-100 placeholder-stellar-600 focus:border-horizon-400 focus:ring-2 focus:ring-horizon-400/20 transition-all"
                                    />
                                )}
                            />
                            {errors.birthPlace && (
                                <p className="text-rose-400 text-xs mt-1">{errors.birthPlace.message}</p>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Photos */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={2}
                className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
            >
                <h4 className="text-lg font-medium text-stellar-200 mb-2">Votre Reflet Sacré</h4>
                <p className="text-stellar-500 text-sm mb-4">
                    Ces images enrichiront votre lecture (optionnel)
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SmartPhotoUploader
                        label="Photo de visage"
                        description="Pour la lecture physiognomonique"
                        value={facePhoto || undefined}
                        onChange={(val) => setValue("facePhoto", val || "")}
                    />
                    <SmartPhotoUploader
                        label="Photo de paume"
                        description="Pour la lecture palmaire"
                        value={palmPhoto || undefined}
                        onChange={(val) => setValue("palmPhoto", val || "")}
                    />
                </div>
            </motion.div>

            {/* Navigation */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={3}
                className="flex items-center justify-between pt-4"
            >
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 text-stellar-500 hover:text-stellar-300 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Retour
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-horizon-400 to-amber-500 text-abyss-900 font-semibold hover:shadow-lg hover:shadow-horizon-400/25 transition-all"
                >
                    Continuer
                    <ArrowRight className="w-4 h-4" />
                </button>
            </motion.div>
        </motion.div>
    );
};

// =============================================================================
// STEP 5: SEALING (Le Scellement)
// =============================================================================

interface StepSealingProps {
    watch: ReturnType<typeof useForm<HolisticDiagnosticData>>["watch"];
    isSubmitting: boolean;
    onBack: () => void;
    onSubmit: () => void;
}

const StepSealing = ({ watch, isSubmitting, onBack, onSubmit }: StepSealingProps) => {
    const data = watch();

    const summaryItems = [
        {
            label: "État Vibratoire",
            value: `${data.highs?.slice(0, 50)}${data.highs && data.highs.length > 50 ? "..." : ""}`,
            icon: Activity,
            color: "text-amber-400",
        },
        {
            label: "Corps Mémoire",
            value: `${data.strongZone} (Force) / ${data.weakZone} (Faille)`,
            icon: Heart,
            color: "text-rose-400",
        },
        {
            label: "Fréquence",
            value: `${DELIVERY_STYLES[data.deliveryStyle as DeliveryStyle]?.title || "—"} • Rythme ${data.pace}%`,
            icon: Zap,
            color: "text-cyan-400",
        },
        {
            label: "Ancrage",
            value: `${data.birthDate || "—"} • ${data.birthPlace || "—"}`,
            icon: User,
            color: "text-horizon-400",
        },
    ];

    return (
        <motion.div
            key="sealing"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="space-y-6"
        >
            {/* Header */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={0}
                className="text-center mb-8"
            >
                <div className="relative">
                    <div className="absolute -inset-4 bg-horizon-400/20 rounded-full blur-2xl animate-pulse" />
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-horizon-300 via-horizon-400 to-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-horizon-400/30">
                        <Lock className="w-10 h-10 text-abyss-900" />
                    </div>
                </div>
                <h3 className="text-2xl font-playfair italic text-gradient-gold">
                    Le Scellement
                </h3>
                <p className="text-stellar-500 text-sm mt-2 max-w-md mx-auto italic">
                    &quot;Votre diagnostic est complet. Scellez votre engagement.&quot;
                </p>
            </motion.div>

            {/* Summary */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={1}
                className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-4"
            >
                <h4 className="text-lg font-medium text-stellar-200 mb-4 text-center">
                    Résumé de votre Diagnostic
                </h4>
                {summaryItems.map((item, index) => (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + index * 0.1 }}
                        className="flex items-start gap-4 p-3 rounded-xl bg-abyss-700/30 border border-white/5"
                    >
                        <div className={`w-10 h-10 rounded-full bg-abyss-600 flex items-center justify-center flex-shrink-0 ${item.color}`}>
                            <item.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-stellar-500 uppercase tracking-wider">{item.label}</p>
                            <p className="text-sm text-stellar-200 truncate">{item.value}</p>
                        </div>
                    </motion.div>
                ))}
            </motion.div>

            {/* CTA */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={2}
                className="text-center space-y-4"
            >
                <motion.button
                    type="button"
                    onClick={onSubmit}
                    disabled={isSubmitting}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    animate={{
                        boxShadow: [
                            "0 0 20px rgba(251, 191, 36, 0.3)",
                            "0 0 40px rgba(251, 191, 36, 0.5)",
                            "0 0 20px rgba(251, 191, 36, 0.3)",
                        ],
                    }}
                    transition={{
                        boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                    }}
                    className="w-full py-4 px-8 rounded-2xl bg-gradient-to-r from-amber-400 via-horizon-400 to-amber-500 text-abyss-900 font-bold text-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <span className="flex items-center justify-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Scellement en cours...
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-3">
                            <Sparkles className="w-5 h-5" />
                            SCELLER ET TRANSMETTRE
                            <Sparkles className="w-5 h-5" />
                        </span>
                    )}
                </motion.button>

                {/* GDPR Consent Text */}
                <p className="text-xs text-stellar-600 max-w-md mx-auto">
                    Par cet acte, je consens au traitement de mes données pour mon élévation spirituelle.
                    <br />
                    <span className="text-stellar-500">(Conformité RGPD • Vos données sont sacrées)</span>
                </p>
            </motion.div>

            {/* Back Button */}
            <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                custom={3}
                className="flex justify-start"
            >
                <button
                    type="button"
                    onClick={onBack}
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-4 py-2 text-stellar-500 hover:text-stellar-300 transition-colors disabled:opacity-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Modifier
                </button>
            </motion.div>
        </motion.div>
    );
};

// =============================================================================
// MAIN COMPONENT: HOLISTIC WIZARD
// =============================================================================

export const HolisticWizard = ({ onComplete }: HolisticWizardProps) => {
    const [currentStep, setCurrentStep] = useState<Step>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { refetchData } = useSanctuaireAuth();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const {
        control,
        handleSubmit,
        watch,
        setValue,
        trigger,
        formState: { errors },
    } = useForm<HolisticDiagnosticData>({
        resolver: zodResolver(holisticDiagnosticSchema),
        defaultValues: defaultHolisticData as HolisticDiagnosticData,
        mode: "onChange",
    });

    // Get token from localStorage
    const getToken = useCallback(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("sanctuaire_token");
        }
        return null;
    }, []);

    // Step validation
    const validateStep = async (step: Step): Promise<boolean> => {
        const stepFields: Record<Step, (keyof HolisticDiagnosticData)[]> = {
            0: ["highs", "lows"],
            1: ["strongSide", "weakSide", "strongZone", "weakZone"],
            2: ["deliveryStyle", "pace"],
            3: ["birthDate", "birthPlace"],
            4: [],
        };
        return await trigger(stepFields[step]);
    };

    // Navigation handlers
    const goNext = async () => {
        const isValid = await validateStep(currentStep);
        if (isValid) {
            setCurrentStep((prev) => Math.min(prev + 1, 4) as Step);
        }
    };

    const goBack = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0) as Step);
    };

    // Submit handler
    const onSubmitForm = async (data: HolisticDiagnosticData) => {
        setIsSubmitting(true);
        try {
            const token = getToken();
            if (!token) {
                throw new Error("No authentication token");
            }

            // Submit the holistic diagnostic data
            await axios.post(
                `${API_URL}/api/users/holistic-diagnostic`,
                {
                    ...data,
                    gdprConsent: true,
                    submittedAt: new Date().toISOString(),
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            // Also update the user profile with birth data
            await axios.patch(
                `${API_URL}/api/users/profile`,
                {
                    birthDate: data.birthDate,
                    birthTime: data.birthTime || null,
                    birthPlace: data.birthPlace,
                    facePhotoUrl: data.facePhoto || null,
                    palmPhotoUrl: data.palmPhoto || null,
                    profileCompleted: true,
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            await refetchData();
            onComplete?.();
        } catch (error) {
            console.error("Failed to submit holistic diagnostic:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFinalSubmit = () => {
        setValue("gdprConsent", true);
        handleSubmit(onSubmitForm)();
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            {/* Glassmorphic Container */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-abyss-600/30 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl"
            >
                {/* Decorative glows */}
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-48 bg-horizon-400/5 blur-3xl rounded-full pointer-events-none" />
                <div className="absolute -bottom-20 right-0 w-64 h-32 bg-violet-500/5 blur-3xl rounded-full pointer-events-none" />

                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-1 mb-8">
                    {STEPS.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{
                                    scale: currentStep === step.id ? 1.1 : 1,
                                    opacity: currentStep >= step.id ? 1 : 0.4,
                                }}
                                className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                                    currentStep === step.id
                                        ? "bg-horizon-400/20 border-horizon-400"
                                        : currentStep > step.id
                                        ? "bg-emerald-500/20 border-emerald-500"
                                        : "bg-abyss-700/50 border-white/10"
                                }`}
                            >
                                {currentStep > step.id ? (
                                    <Check className="w-5 h-5 text-emerald-400" />
                                ) : (
                                    <step.icon className={`w-5 h-5 ${
                                        currentStep === step.id ? "text-horizon-400" : "text-stellar-500"
                                    }`} />
                                )}
                            </motion.div>
                            {index < STEPS.length - 1 && (
                                <div className={`w-8 h-0.5 transition-all ${
                                    currentStep > step.id ? "bg-emerald-500" : "bg-white/10"
                                }`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Step content */}
                <div className="relative z-10 min-h-[500px]">
                    <AnimatePresence mode="wait">
                        {currentStep === 0 && (
                            <StepVibration
                                control={control}
                                errors={errors}
                                onNext={goNext}
                            />
                        )}
                        {currentStep === 1 && (
                            <StepSomatic
                                control={control}
                                errors={errors}
                                watch={watch}
                                onNext={goNext}
                                onBack={goBack}
                            />
                        )}
                        {currentStep === 2 && (
                            <StepRhythm
                                control={control}
                                errors={errors}
                                watch={watch}
                                onNext={goNext}
                                onBack={goBack}
                            />
                        )}
                        {currentStep === 3 && (
                            <StepIdentity
                                control={control}
                                errors={errors}
                                setValue={setValue}
                                watch={watch}
                                onNext={goNext}
                                onBack={goBack}
                            />
                        )}
                        {currentStep === 4 && (
                            <StepSealing
                                watch={watch}
                                isSubmitting={isSubmitting}
                                onBack={goBack}
                                onSubmit={handleFinalSubmit}
                            />
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};

export default HolisticWizard;
