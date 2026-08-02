'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Mail, Loader2, Sparkles, ArrowLeft, AlertCircle, Lock, Timer } from 'lucide-react';
import { useSanctuaireAuth } from '../../../context/SanctuaireAuthContext';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    authenticateWithEmail,
    consumeMagicLink,
    isAuthenticated,
    isLoading: authLoading,
    cooldownRemaining,
    isCoolingDown,
  } = useSanctuaireAuth();

  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const consumedLinkRef = useRef(false);
  const magicToken = searchParams.get('token');
  const prefersReducedMotion = useReducedMotion();

  // Pre-fill email from URL params (from redirect)
  useEffect(() => {
    const urlEmail = searchParams.get('email');
    if (urlEmail) {
      setEmail(urlEmail);
    }
  }, [searchParams]);

  const safeRedirect = (() => {
    const raw = searchParams.get('redirect');
    if (raw && raw.startsWith('/sanctuaire') && !raw.startsWith('/sanctuaire/login')) {
      return raw;
    }
    return '/sanctuaire';
  })();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push(safeRedirect);
    }
  }, [isAuthenticated, authLoading, router, safeRedirect]);

  useEffect(() => {
    if (!magicToken || authLoading || isAuthenticated || consumedLinkRef.current) return;
    consumedLinkRef.current = true;
    setIsSubmitting(true);
    void consumeMagicLink(magicToken).then((result) => {
      if (!result.success) {
        setError(result.error);
        setIsSubmitting(false);
      }
    });
  }, [magicToken, authLoading, isAuthenticated, consumeMagicLink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError('Veuillez entrer votre email');
      return;
    }

    setIsSubmitting(true);

    const result = await authenticateWithEmail(email);

    if (result.success) {
      setMessage(
        result.message ||
          'Si un accès existe pour cette adresse, un lien de connexion vient d’être envoyé.',
      );
      setIsSubmitting(false);
    } else {
      setError(result.error);
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-abyss-700">
        <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh items-start justify-center overflow-x-clip overflow-y-auto px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] starfield sm:items-center sm:py-8">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-b from-abyss-900 via-abyss-700 to-abyss-800" />

      {/* Floating Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: prefersReducedMotion ? 1 : [1, 1.15, 1],
            opacity: prefersReducedMotion ? 0.2 : [0.2, 0.35, 0.2],
          }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-horizon-400/20 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: prefersReducedMotion ? 1 : [1, 1.1, 1],
            opacity: prefersReducedMotion ? 0.15 : [0.15, 0.25, 0.15],
          }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-serenity-400/15 rounded-full blur-[100px]"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6 }}
          className="rounded-3xl border border-white/[0.08] bg-abyss-600/80 p-5 shadow-abyss backdrop-blur-xl min-[360px]:p-6 sm:p-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { type: 'spring', delay: 0.2 }}
              className="relative mx-auto mb-5 h-16 w-16 sm:mb-6 sm:h-20 sm:w-20"
            >
              {/* Outer glow */}
              <div className="absolute inset-0 bg-horizon-400/20 rounded-full blur-xl" />
              {/* Icon container */}
              <div className="relative w-full h-full bg-gradient-to-br from-horizon-400 to-horizon-500 rounded-full flex items-center justify-center shadow-gold-glow">
                <Sparkles className="h-8 w-8 text-abyss-800 sm:h-10 sm:w-10" />
              </div>
            </motion.div>

            <h1 className="mb-3 font-playfair text-2xl italic text-gradient-gold sm:text-3xl">
              Sanctuaire Lumira
            </h1>
            <p className="text-stellar-400 text-sm">Accédez à vos lectures personnalisées</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="sanctuaire-login-email" className="block text-sm font-medium text-stellar-300">
                Email de commande
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-stellar-500" />
                </div>
                <input
                  id="sanctuaire-login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="votre@email.com"
                  disabled={isSubmitting || isCoolingDown}
                  className="w-full rounded-xl border border-white/[0.08] bg-abyss-500/50 py-4 pl-12 pr-4 text-base text-stellar-100 placeholder:text-stellar-600 transition-all focus:border-horizon-400/50 focus:outline-none focus:ring-2 focus:ring-horizon-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                  autoComplete="email"
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
                  role="alert"
                >
                  <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-300">{error}</p>
                </motion.div>
              )}
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
                  role="status"
                  aria-live="polite"
                >
                  <Mail className="w-5 h-5 text-emerald-300 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-200">{message}</p>
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
                  role="status"
                >
                  <Timer className="w-4 h-4 text-amber-400" />
                  <p className="text-sm text-amber-300">
                    Patientez <span className="font-bold">{cooldownRemaining}s</span> avant de
                    réessayer
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
                  <span>Vérification...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Recevoir un lien sécurisé</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Helper Text */}
          <p className="text-center text-stellar-500 text-xs mt-6">
            Utilisez l&apos;email de votre commande. Le lien est valable 15 minutes.
          </p>
        </motion.div>

        {/* Back Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3, delay: prefersReducedMotion ? 0 : 0.4 }}
          className="mt-6 text-center"
        >
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 text-sm text-stellar-400 transition-colors hover:text-stellar-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-400"
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
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-abyss-700">
          <Loader2 className="w-12 h-12 text-horizon-400 animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
