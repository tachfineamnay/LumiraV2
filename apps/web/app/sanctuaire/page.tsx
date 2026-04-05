"use client";

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import axios from "axios";
import { MandalaNav } from "../../components/sanctuary/MandalaNav";
import { CosmicNotification } from "../../components/sanctuary/CosmicNotification";
import { ExpertValidationBanner } from "../../components/sanctuary/ExpertValidationBanner";
import { HolisticWizard } from "../../components/onboarding/HolisticWizard";
import { useSanctuaire } from "../../context/SanctuaireContext";
import { useSanctuaireAuth, isFirstVisitToken, setFirstVisitFlag, clearFirstVisitFlag } from "../../context/SanctuaireAuthContext";
import {
    Loader2,
    Sparkles,
    AlertCircle
} from "lucide-react";

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

    // Onboarding modal - force display until profile is completed (server state as source of truth)
    if (showOnboarding && !profile?.profileCompleted) {
        return (
            <HolisticWizard
                userEmail={email || user?.email}
                onClose={() => {
                    // User closed wizard to prepare (photos, etc.) - draft is auto-saved by HolisticWizard
                    setShowOnboarding(false);
                    clearFirstVisitFlag();
                    toast.info(
                        "Votre progression est sauvegardée ✨",
                        { 
                            description: "Reprenez votre diagnostic quand vous êtes prêt via le bouton doré.",
                            duration: 5000
                        }
                    );
                    router.replace('/sanctuaire');
                }}
                onComplete={async (data) => {
                    try {
                        const authToken = localStorage.getItem("sanctuaire_token");
                        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
                        
                        if (authToken) {
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
                                specificQuestion: data.specificQuestion || null,
                                objective: data.objective || null,
                                fears: data.fears || null,
                                rituals: data.rituals || null,
                                profileCompleted: true,
                            };
                            
                            await axios.patch(
                                `${API_URL}/api/users/profile`,
                                profileData,
                                { headers: { Authorization: `Bearer ${authToken}` } }
                            );
                        }
                    } catch (error) {
                        console.error("Failed to save holistic diagnostic:", error);
                    } finally {
                        setShowOnboarding(false);
                        clearFirstVisitFlag();
                        localStorage.removeItem('holistic_wizard_draft');
                        localStorage.removeItem('holistic_wizard_email');
                        await refetchData();
                        router.replace('/sanctuaire');
                    }
                }}
            />
        );
    }

    return null;
}

// =============================================================================
// DASHBOARD CONTENT
// =============================================================================

function DashboardContent() {
    const { isLoading, orderCount } = useSanctuaire();
    const { profile, refetchData, user } = useSanctuaireAuth();
    const [showWizard, setShowWizard] = useState(false);
    const [hasDraft, setHasDraft] = useState(false);

    // Check if onboarding is complete - use profileCompleted as single source of truth
    const isOnboardingComplete = profile?.profileCompleted === true;

    // Check for existing draft in localStorage (user started but didn't finish)
    useEffect(() => {
        const draft = localStorage.getItem('holistic_wizard_draft');
        const draftEmail = localStorage.getItem('holistic_wizard_email');
        // Draft exists and belongs to current user
        if (draft && (!draftEmail || draftEmail === user?.email)) {
            setHasDraft(true);
        } else {
            setHasDraft(false);
        }
    }, [user?.email, showWizard]); // Re-check when wizard closes

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

    // Handle wizard completion
    const handleWizardComplete = async (data: any) => {
        try {
            const token = localStorage.getItem("sanctuaire_token");
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
            
            if (token) {
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
                    specificQuestion: data.specificQuestion || null,
                    objective: data.objective || null,
                    fears: data.fears || null,
                    rituals: data.rituals || null,
                    profileCompleted: true,
                };
                
                await axios.patch(
                    `${API_URL}/api/users/profile`,
                    profileData,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            
            localStorage.removeItem('holistic_wizard_draft');
            localStorage.removeItem('holistic_wizard_email');
            
            await refetchData();
            toast.success("Diagnostic complété !", { description: "Votre mandala est maintenant accessible." });
        } catch (error) {
            console.error("Failed to save holistic diagnostic:", error);
            toast.error("Erreur lors de la sauvegarde", { description: "Veuillez réessayer." });
            await refetchData();
        } finally {
            setShowWizard(false);
        }
    };

    return (
        <>
            {/* Wizard Modal */}
            {showWizard && (
                <HolisticWizard
                    userEmail={user?.email}
                    onComplete={handleWizardComplete}
                    onClose={() => {
                        setShowWizard(false);
                        toast.info(
                            "Progression sauvegardée ✨",
                            { description: "Reprenez quand vous êtes prêt." }
                        );
                    }}
                />
            )}

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

            {/* 🔔 ONBOARDING REMINDER - Shows if profile incomplete */}
            {!isOnboardingComplete && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="w-full max-w-2xl mx-auto mb-6 relative z-40"
                >
                    <div className="relative group overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 backdrop-blur-xl shadow-[0_0_40px_rgba(16,185,129,0.15)]">
                        {/* Animated Background Sheen */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent pointer-events-none translate-x-[-100%] animate-[shimmer_3s_infinite]" />
                        
                        <div className="relative p-6 flex items-center gap-5">
                            {/* Icon */}
                            <div className="relative flex-shrink-0">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
                                    <Sparkles className="w-7 h-7 text-emerald-400" />
                                </div>
                            </div>
                            
                            {/* Content */}
                            <div className="flex-grow">
                                <h3 className="text-lg font-playfair italic text-emerald-300 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-emerald-400" />
                                    {hasDraft ? "Reprenez votre diagnostic" : "Complétez votre profil"}
                                </h3>
                                <p className="text-emerald-100/80 text-sm mt-1">
                                    {hasDraft 
                                        ? "Votre progression a été sauvegardée. Continuez là où vous vous êtes arrêté." 
                                        : "Finalisez votre diagnostic holistique pour recevoir votre lecture Oracle personnalisée."}
                                </p>
                            </div>
                            
                            {/* CTA Button */}
                            <button
                                onClick={() => setShowWizard(true)}
                                className="flex-shrink-0 px-5 py-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-sm font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                            >
                                {hasDraft ? "Continuer →" : "Terminer →"}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* 👁️ EXPERT VALIDATION NOTIFICATION - Shows when expert validates a reading */}
            {isOnboardingComplete && (
                <div className="w-full max-w-2xl mx-auto mb-6 relative z-40">
                    <ExpertValidationBanner />
                </div>
            )}

            {/* 🪐 MANDALA NAVIGATION or ONBOARDING CTA */}
            <section className="relative w-full flex justify-center items-start py-8 mb-8 z-30">
                {isOnboardingComplete ? (
                    <div>
                        <MandalaNav />
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-lg text-center"
                    >
                        <div className="glass-card p-8 rounded-2xl border border-horizon-400/20">
                            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-horizon-400/20 to-serenity-400/20 flex items-center justify-center mb-6 border border-horizon-400/30">
                                <Sparkles className="w-8 h-8 text-horizon-400" />
                            </div>
                            <h3 className="text-xl font-playfair italic text-stellar-100 mb-3">
                                Complétez votre Diagnostic Vibratoire
                            </h3>
                            <p className="text-stellar-500 text-sm mb-6">
                                Partagez vos énergies, votre corps et vos préférences pour une expérience Oracle personnalisée.
                            </p>
                            <button
                                onClick={() => setShowWizard(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-horizon-400 to-horizon-500 text-abyss-900 font-semibold hover:shadow-lg hover:shadow-horizon-400/25 transition-all"
                            >
                                <Sparkles className="w-5 h-5" />
                                Commencer le Diagnostic
                            </button>
                        </div>
                    </motion.div>
                )}
            </section>

            {/* 🔔 ORDER STATUS */}
            {hasOrders && isOnboardingComplete && (
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
                        actionLabel="Voir ma lecture"
                        actionHref="/sanctuaire/draws"
                    />
                </motion.div>
            )}

        </div>
        </>
    );
}

// =============================================================================
// SUBSCRIPTION SUCCESS HANDLER
// Polls /subscriptions/status after Stripe redirect until ACTIVE or timeout
// =============================================================================

function SubscriptionSuccessHandler() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { refetch } = useSanctuaire();
    const [activating, setActivating] = useState(false);

    useEffect(() => {
        if (searchParams.get('subscription') !== 'success') return;

        setActivating(true);
        const token = localStorage.getItem('sanctuaire_token');
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        let attempts = 0;
        const maxAttempts = 8; // 16 seconds max

        const poll = setInterval(async () => {
            attempts++;
            try {
                const res = await axios.get(`${API_URL}/api/subscriptions/status`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const status = res.data?.subscription?.status;
                if (status === 'ACTIVE') {
                    clearInterval(poll);
                    setActivating(false);
                    refetch();
                    toast.success('Abonnement activé !', { description: 'Bienvenue dans votre Sanctuaire.' });
                    router.replace('/sanctuaire');
                }
            } catch {
                // ignore transient errors
            }
            if (attempts >= maxAttempts) {
                clearInterval(poll);
                setActivating(false);
                refetch();
                router.replace('/sanctuaire');
            }
        }, 2000);

        return () => clearInterval(poll);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!activating) return null;

    return (
        <div className="fixed inset-0 bg-abyss-700/90 backdrop-blur-xl z-50 flex items-center justify-center">
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
                        Activation en cours...
                    </h2>
                    <p className="text-stellar-500 text-sm">
                        Votre abonnement est en cours d&apos;activation.
                    </p>
                </div>
            </motion.div>
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
            <SubscriptionSuccessHandler />
            <AutoLoginHandler />
            <DashboardContent />
        </Suspense>
    );
}
