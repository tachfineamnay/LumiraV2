'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Loader2, Sparkles, ArrowLeft, AlertCircle, Lock, Timer } from 'lucide-react';
import { useSanctuaireAuth } from '../../../context/SanctuaireAuthContext';

function LoginContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { authenticateWithEmail, isAuthenticated, isLoading: authLoading, cooldownRemaining, isCoolingDown } = useSanctuaireAuth();

    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pre-fill email from URL params (from redirect)
    useEffect(() => {
        const urlEmail = searchParams.get('email');
        if (urlEmail) {
            setEmail(urlEmail);
        }
    }, [searchParams]);

    // Redirect if already authenticated
    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.push('/sanctuaire');
        }
    }, [isAuthenticated, authLoading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim()) {
            setError('Veuillez entrer votre email');
            return;
        }

        setIsSubmitting(true);

        const result = await authenticateWithEmail(email);

        if (result.success) {
            router.push('/sanctuaire');
        } else {
            setError(result.error);
            setIsSubmitting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-abyss-700">
                <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden flex items-center justify-center starfield">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-b from-abyss-900 via-abyss-700 to-abyss-800" />

            {/* Floating Blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.15, 1],
                        opacity: [0.2, 0.35, 0.2],
                    }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute top-1/4 left-1/4 w-96 h-96 bg-horizon-400/20 rounded-full blur-[120px]"
                />
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.15, 0.25, 0.15],
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-serenity-400/15 rounded-full blur-[100px]"
                />
            </div>

            {/* Content */}
            <div className="relative z-10 w-full max-w-md mx-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="bg-abyss-600/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 shadow-abyss"
                >
                    {/* Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                            className="w-20 h-20 mx-auto mb-6 relative"
                        >
                            {/* Outer glow */}
                            <div className="absolute inset-0 bg-horizon-400/20 rounded-full blur-xl" />
                            {/* Icon container */}
                            <div className="relative w-full h-full bg-gradient-to-br from-horizon-400 to-horizon-500 rounded-full flex items-center justify-center shadow-gold-glow">
                                <Sparkles className="w-10 h-10 text-abyss-800" />
                            </div>
                        </motion.div>

                        <h1 className="text-3xl font-playfair italic text-gradient-gold mb-3">
                            Sanctuaire Oracle
                        </h1>
                        <p className="text-stellar-400 text-sm">
                            Accédez à vos lectures personnalisées
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email Input */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-stellar-300">
                                Email de commande
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="w-5 h-5 text-stellar-500" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError(null);
                                    }}
                                    placeholder="votre@email.com"
                                    disabled={isSubmitting || isCoolingDown}
                                    className="w-full pl-12 pr-4 py-4 bg-abyss-500/50 border border-white/[0.08] rounded-xl text-stellar-100 placeholder:text-stellar-600 focus:outline-none focus:border-horizon-400/50 focus:ring-2 focus:ring-horizon-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    autoComplete="email"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl"
                                >
                                    <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-rose-300">{error}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Cooldown Timer */}
                        <AnimatePresence>
                            {isCoolingDown && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="flex items-center justify-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl"
                                >
                                    <Timer className="w-4 h-4 text-amber-400" />
                                    <p className="text-sm text-amber-300">
                                        Patientez <span className="font-bold">{cooldownRemaining}s</span> avant de réessayer
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Submit Button */}
                        <motion.button
                            type="submit"
                            disabled={isSubmitting || isCoolingDown || !email.trim()}
                            whileHover={{ scale: isSubmitting || isCoolingDown ? 1 : 1.02 }}
                            whileTap={{ scale: isSubmitting || isCoolingDown ? 1 : 0.98 }}
                            className="w-full py-4 bg-gradient-to-r from-horizon-400 to-horizon-500 hover:from-horizon-500 hover:to-horizon-600 text-abyss-800 font-bold rounded-xl shadow-gold-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all flex items-center justify-center gap-3"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Connexion...</span>
                                </>
                            ) : (
                                <>
                                    <Lock className="w-5 h-5" />
                                    <span>Accéder au Sanctuaire</span>
                                </>
                            )}
                        </motion.button>
                    </form>

                    {/* Helper Text */}
                    <p className="text-center text-stellar-500 text-xs mt-6">
                        Utilisez l&apos;email de votre commande
                    </p>
                </motion.div>

                {/* Back Link */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="mt-6 text-center"
                >
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-stellar-400 hover:text-stellar-200 transition-colors text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Retour à l&apos;accueil</span>
                    </Link>
                </motion.div>

                {/* Glow effect */}
                <div className="absolute -inset-4 bg-gradient-to-r from-horizon-500/10 via-serenity-500/10 to-horizon-500/10 rounded-3xl blur-2xl opacity-50 -z-10" />
            </div>
        </div>
    );
}

export default function SanctuaireLoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-abyss-700">
                <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
