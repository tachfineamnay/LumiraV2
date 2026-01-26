"use client";

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import axios from "axios";
import { MandalaNav } from "../../components/sanctuary/MandalaNav";
import { CosmicNotification } from "../../components/sanctuary/CosmicNotification";
import { HolisticWizard } from "../../components/onboarding/HolisticWizard";
import { useSanctuaire } from "../../context/SanctuaireContext";
import { useSanctuaireAuth, isFirstVisitToken, setFirstVisitFlag, clearFirstVisitFlag } from "../../context/SanctuaireAuthContext";
import {
    User,
    Eye,
    Crown,
    FileText,
    ChevronRight,
    Map,
    Loader2,
    Star,
    Lock,
    Sparkles,
    AlertCircle
} from "lucide-react";

// =============================================================================
// DASHBOARD CARDS
// =============================================================================

interface DashboardCard {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    route: string;
    requiredLevel: number;
    requiredCapability: string;
}

const dashboardCards: DashboardCard[] = [
    {
        title: "Mon Profil",
        description: "Votre identité et diagnostic holistique",
        icon: User,
        route: "/sanctuaire/profile",
        requiredLevel: 0,
        requiredCapability: "sanctuaire.sphere.profile",
    },
    {
        title: "Mes Lectures",
        description: "Accédez à vos lectures Oracle personnalisées",
        icon: Eye,
        route: "/sanctuaire/draws",
        requiredLevel: 1,
        requiredCapability: "sanctuaire.sphere.readings",
    },
    {
        title: "Rituels Sacrés",
        description: "Accédez aux rituels personnalisés et pratiques avancées",
        icon: Map,
        route: "/sanctuaire/rituals",
        requiredLevel: 2,
        requiredCapability: "sanctuaire.sphere.rituals",
    },
    {
        title: "Mandala Personnel",
        description: "Accédez à votre Mandala personnalisé en haute définition",
        icon: Crown,
        route: "/sanctuaire/mandala",
        requiredLevel: 3,
        requiredCapability: "sanctuaire.sphere.mandala",
    },
    {
        title: "Synthèse Profonde",
        description: "Accédez à l'analyse synthétique complète de votre parcours",
        icon: FileText,
        route: "/sanctuaire/synthesis",
        requiredLevel: 3,
        requiredCapability: "sanctuaire.sphere.synthesis",
    },
    {
        title: "Guidance Sacrée",
        description: "Accédez à la guidance personnalisée et au mentorat exclusif",
        icon: Star,
        route: "/sanctuaire/chat",
        requiredLevel: 4,
        requiredCapability: "sanctuaire.sphere.guidance",
    },
];

const getLevelInfo = (level: number): { name: "Initié" | "Mystique" | "Profond" | "Intégral"; productId: "initie" | "mystique" | "profond" | "integrale" } => {
    switch (level) {
        case 2: return { name: "Mystique", productId: "mystique" };
        case 3: return { name: "Profond", productId: "profond" };
        case 4: return { name: "Intégral", productId: "integrale" };
        default: return { name: "Initié", productId: "initie" };
    }
};

// =============================================================================
// AUTO-LOGIN HANDLER
// =============================================================================

function AutoLoginHandler() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { authenticateWithEmail, isAuthenticated, isLoading: authLoading, refetchData, profile, user } = useSanctuaireAuth();

    const [autoLoginState, setAutoLoginState] = useState<'idle' | 'authenticating' | 'success' | 'error'>('idle');
    const [autoLoginError, setAutoLoginError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [showOnboarding, setShowOnboarding] = useState(false);

    const email = searchParams.get('email');
    const token = searchParams.get('token');
    const isFirstVisit = isFirstVisitToken(token);

    // Handle auto-login from URL params
    useEffect(() => {
        if (!email || authLoading || isAuthenticated) return;
        if (autoLoginState !== 'idle') return;

        const performAutoLogin = async () => {
            setAutoLoginState('authenticating');

            // Set first visit flag if applicable
            if (isFirstVisit) {
                setFirstVisitFlag(true);
            }

            const result = await authenticateWithEmail(email);

            if (result.success) {
                setAutoLoginState('success');
                // Show onboarding for first visit ONLY if profile is NOT completed
                // This prevents re-showing onboarding if user has already completed it
                if (result.isFirstVisit) {
                    setShowOnboarding(true);
                    // Don't clean URL yet - will be done when onboarding completes
                } else {
                    // Clean URL params only if not showing onboarding
                    router.replace('/sanctuaire');
                }
            } else {
                // Retry with exponential backoff (2s, 4s, 8s)
                if (retryCount < 3 && !result.isRateLimited) {
                    const delay = Math.pow(2, retryCount + 1) * 1000;
                    setRetryCount(prev => prev + 1);
                    setTimeout(() => {
                        setAutoLoginState('idle');
                    }, delay);
                } else {
                    setAutoLoginState('error');
                    setAutoLoginError(result.error);
                    // Redirect to login after 3 failed attempts
                    setTimeout(() => {
                        router.push(`/sanctuaire/login?email=${encodeURIComponent(email)}`);
                    }, 3000);
                }
            }
        };

        performAutoLogin();
    }, [email, token, authLoading, isAuthenticated, autoLoginState, authenticateWithEmail, retryCount, router, isFirstVisit]);

    // 🔄 Check if we should show onboarding after authentication completes
    // This handles the case where isFirstVisit was set but profile data wasn't loaded yet
    useEffect(() => {
        if (showOnboarding && profile?.profileCompleted) {
            // Profile is already completed, skip onboarding
            console.log("[AutoLoginHandler] Profile already completed, skipping onboarding");
            setShowOnboarding(false);
            clearFirstVisitFlag();
            router.replace('/sanctuaire');
        }
    }, [showOnboarding, profile, router]);

    // Show loading during auto-login
    if (autoLoginState === 'authenticating') {
        return (
            <div className="fixed inset-0 bg-abyss-700/95 backdrop-blur-xl z-50 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-6 text-center px-4"
                >
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 bg-horizon-400/20 rounded-full blur-xl animate-pulse" />
                        <div className="relative w-full h-full bg-gradient-to-br from-horizon-400 to-horizon-500 rounded-full flex items-center justify-center">
                            <Loader2 className="w-10 h-10 text-abyss-800 animate-spin" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-playfair italic text-stellar-200 mb-2">
                            Préparation de votre Sanctuaire...
                        </h2>
                        <p className="text-stellar-500 text-sm">
                            {retryCount > 0 ? `Tentative ${retryCount + 1}/3...` : 'Authentification en cours...'}
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Show error during auto-login failure
    if (autoLoginState === 'error') {
        return (
            <div className="fixed inset-0 bg-abyss-700/95 backdrop-blur-xl z-50 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-6 text-center px-4 max-w-md"
                >
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                        <AlertCircle className="w-8 h-8 text-rose-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-playfair italic text-stellar-200 mb-2">
                            Erreur d&apos;authentification
                        </h2>
                        <p className="text-rose-300 text-sm mb-4">
                            {autoLoginError}
                        </p>
                        <p className="text-stellar-500 text-xs">
                            Redirection vers la page de connexion...
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    // Onboarding modal
    if (showOnboarding && !profile?.profileCompleted) {
        return (
            <div className="fixed inset-0 z-[100] bg-void">
                <HolisticWizard
                    userEmail={email || user?.email}
                    onComplete={async (data) => {
                        try {
                            const token = localStorage.getItem("sanctuaire_token");
                            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
                            
                            if (token) {
                                await axios.patch(
                                    `${API_URL}/api/users/profile`,
                                    { 
                                        ...data,
                                        profileCompleted: true 
                                    },
                                    { headers: { Authorization: `Bearer ${token}` } }
                                );
                            }
                        } catch (error) {
                            console.error("Failed to save holistic diagnostic:", error);
                        } finally {
                            setShowOnboarding(false);
                            clearFirstVisitFlag();
                            // Clear the draft after successful submission
                            localStorage.removeItem('holistic_wizard_draft');
                            localStorage.removeItem('holistic_wizard_email');
                            await refetchData();
                            router.replace('/sanctuaire');
                        }
                    }}
                />
            </div>
        );
    }

    return null;
}

// =============================================================================
// DASHBOARD CONTENT
// =============================================================================

function DashboardContent() {
    const { highestLevel, hasCapability, isLoading, orderCount } = useSanctuaire();
    const { profile, refetchData, user } = useSanctuaireAuth();

    // Check if onboarding is complete
    const isOnboardingComplete = !!(profile?.birthDate && profile?.profileCompleted);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
                    <p className="text-stellar-500 text-sm tracking-widest uppercase">
                        Chargement de votre sanctuaire...
                    </p>
                </div>
            </div>
        );
    }

    const hasOrders = orderCount > 0;

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center">

            {/* 🏛️ WELCOME */}
            <div className="text-center mb-8 relative z-10">
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl md:text-5xl font-playfair italic text-gradient-gold mb-4"
                >
                    Votre Sanctuaire Personnel
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-stellar-500 tracking-[0.15em] uppercase text-xs font-medium"
                >
                    Explorez votre univers intérieur à travers le mandala sacré
                </motion.p>
            </div>

            {/* 🪐 MANDALA NAVIGATION or HOLISTIC WIZARD */}
            <section className="relative w-full flex justify-center items-start py-8 mb-8 z-30">
                {isOnboardingComplete ? (
                    <div className="hidden lg:block">
                        <MandalaNav />
                    </div>
                ) : (
                    <div className="w-full max-w-4xl min-h-[700px]">
                        <HolisticWizard
                            userEmail={user?.email}
                            onComplete={async (data) => {
                                try {
                                    const token = localStorage.getItem("sanctuaire_token");
                                    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
                                    
                                    if (token) {
                                        // Map wizard fields to API expected fields
                                        const profileData = {
                                            birthDate: data.birthDate,
                                            birthTime: data.birthTime || null,
                                            birthPlace: data.birthPlace,
                                            facePhotoUrl: data.facePhoto || null,
                                            palmPhotoUrl: data.palmPhoto || null,
                                            highs: data.highs,
                                            lows: data.lows,
                                            strongSide: data.strongSide,
                                            weakSide: data.weakSide,
                                            strongZone: data.strongZone,
                                            weakZone: data.weakZone,
                                            deliveryStyle: data.deliveryStyle,
                                            pace: data.pace,
                                            ailments: data.ailments || null,
                                            profileCompleted: true,
                                        };
                                        
                                        console.log("[Sanctuaire] Saving profile data:", profileData);
                                        
                                        // Save the holistic diagnostic data and mark profile as completed
                                        await axios.patch(
                                            `${API_URL}/api/users/profile`,
                                            profileData,
                                            { headers: { Authorization: `Bearer ${token}` } }
                                        );
                                    }
                                    
                                    // Clear wizard draft
                                    localStorage.removeItem('holistic_wizard_draft');
                                    localStorage.removeItem('holistic_wizard_email');
                                    
                                    await refetchData();
                                } catch (error) {
                                    console.error("Failed to save holistic diagnostic:", error);
                                    // Fallback to just refetching
                                    await refetchData();
                                }
                            }}
                        />
                    </div>
                )}
            </section>

            {/* 🔔 ORDER STATUS */}
            {hasOrders && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="w-full max-w-3xl mx-auto mb-12 relative z-20"
                >
                    <CosmicNotification
                        title="Votre demande a été transmise avec succès"
                        message="L'Oracle travaille sur votre révélation personnalisée. Vous serez notifié par email et via l'application dès qu'elle sera prête."
                        delay="24h"
                        status="En cours d'analyse"
                        actionLabel="Suivre ma commande"
                        secondaryActionLabel="Nouvelle lecture"
                        onAction={() => console.log('Suivre')}
                        onSecondaryAction={() => console.log('Nouvelle')}
                    />
                </motion.div>
            )}

            {/* 🧩 DASHBOARD CARDS */}
            <div className={`w-full relative z-10 transition-all duration-500 ${!isOnboardingComplete ? "blur-sm opacity-50 pointer-events-none select-none" : ""}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                    {dashboardCards.map((card, i) => {
                        const Icon = card.icon;
                        const levelInfo = getLevelInfo(card.requiredLevel);
                        const isIntegral = card.requiredLevel === 4;
                        const hasAccess = card.requiredLevel === 0 ||
                            (hasCapability(card.requiredCapability) && highestLevel >= card.requiredLevel);

                        if (!hasAccess) {
                            return (
                                <motion.div
                                    key={card.title}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 + i * 0.08 }}
                                >
                                    <div className="h-full min-h-[180px] rounded-2xl bg-abyss-500/30 border border-white/[0.04] p-5 flex flex-col justify-between relative overflow-hidden">
                                        <div className="absolute inset-0 bg-abyss-600/40 backdrop-blur-[2px] z-10" />

                                        <div className="relative z-20">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center border border-white/[0.06]">
                                                    <Icon className="w-6 h-6 text-stellar-500" />
                                                </div>
                                                <Lock className="w-5 h-5 text-horizon-400/50" />
                                            </div>

                                            <h3 className="text-lg font-playfair italic text-stellar-300 mb-1">
                                                {card.title}
                                            </h3>
                                            <p className="text-stellar-600 text-sm">
                                                {card.description}
                                            </p>
                                        </div>

                                        <div className="relative z-20 mt-4 pt-4 border-t border-white/[0.04]">
                                            <div className="flex items-center justify-center gap-2 mb-3">
                                                <Sparkles className="w-3 h-3 text-horizon-400/50" />
                                                <span className="text-[10px] text-horizon-400/80 uppercase tracking-wider">
                                                    Requiert niveau {levelInfo.name}
                                                </span>
                                                <Sparkles className="w-3 h-3 text-horizon-400/50" />
                                            </div>
                                            <Link href={`/commande?product=${levelInfo.productId}`}>
                                                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-800 text-sm font-semibold hover:shadow-gold-glow transition-all">
                                                    {isIntegral ? "Niveau Intégral" : "Débloquer"}
                                                </button>
                                            </Link>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        }

                        return (
                            <motion.div
                                key={card.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 + i * 0.08 }}
                            >
                                <Link href={card.route}>
                                    <div className="h-full min-h-[180px] rounded-2xl bg-abyss-500/20 border border-white/[0.06] p-5 flex flex-col justify-between group hover:border-horizon-400/20 transition-all duration-500 cursor-pointer hover:bg-abyss-400/30">
                                        <div>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-12 h-12 rounded-xl bg-horizon-400/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 border border-horizon-400/20">
                                                    <Icon className="w-6 h-6 text-horizon-400" />
                                                </div>
                                            </div>

                                            <h3 className="text-lg font-playfair italic text-stellar-100 mb-1 group-hover:text-horizon-300 transition-colors">
                                                {card.title}
                                            </h3>
                                            <p className="text-stellar-500 text-sm">
                                                {card.description}
                                            </p>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-white/[0.04] flex justify-end items-center">
                                            <span className="flex items-center gap-2 text-horizon-400 text-xs font-bold uppercase tracking-widest">
                                                Accéder
                                                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SanctuaireDashboard() {
    return (
        <Suspense fallback={
            <div className="flex-1 flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
                    <p className="text-stellar-500 text-sm tracking-widest uppercase">
                        Chargement...
                    </p>
                </div>
            </div>
        }>
            <AutoLoginHandler />
            <DashboardContent />
        </Suspense>
    );
}
