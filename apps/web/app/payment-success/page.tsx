'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, Sparkles, AlertCircle } from 'lucide-react';
import {
  buildSanctuairePostCheckoutUrl,
  completeCheckoutSession,
} from '../../lib/completeCheckoutSession';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get('email') || '';
  const paymentIntentId =
    searchParams.get('payment_intent') || searchParams.get('payment_intent_id') || '';
  const redirectStatus = searchParams.get('redirect_status');

  const [status, setStatus] = useState<'processing' | 'confirmed' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const finalize = async () => {
      if (redirectStatus && redirectStatus !== 'succeeded') {
        setStatus('error');
        setErrorMessage("Le paiement n'a pas pu être confirmé. Veuillez réessayer.");
        return;
      }

      if (!paymentIntentId) {
        // Legacy fallback: redirect with email if present
        if (emailParam) {
          setStatus('confirmed');
          setTimeout(() => {
            // Hard nav so httpOnly cookie + sessionStorage are reliable
            window.location.href = buildSanctuairePostCheckoutUrl(emailParam);
          }, 800);
          return;
        }
        setStatus('error');
        setErrorMessage(
          'Impossible de retrouver votre paiement. Connectez-vous avec votre email de commande.',
        );
        return;
      }

      try {
        const { email } = await completeCheckoutSession(paymentIntentId);
        setStatus('confirmed');
        setTimeout(() => {
          // Hard nav ensures Set-Cookie from confirm is included on Sanctuaire load
          window.location.href = buildSanctuairePostCheckoutUrl(email);
        }, 800);
      } catch (err) {
        console.error('[PaymentSuccess] confirm failed:', err);
        // Soft fallback: email auto-login (webhook may have fulfilled)
        if (emailParam) {
          setStatus('confirmed');
          setTimeout(() => {
            window.location.href = buildSanctuairePostCheckoutUrl(emailParam);
          }, 800);
          return;
        }
        setStatus('error');
        setErrorMessage(
          "Paiement reçu, mais l'accès automatique a échoué. Connectez-vous avec votre email de commande.",
        );
      }
    };

    void finalize();
  }, [paymentIntentId, redirectStatus, emailParam, router]);

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* Cosmic Background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0A0514] via-[#1a0b2e] to-[#0A0514]" />

      {/* Floating Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 left-1/4 w-96 h-96 bg-cosmic-gold/20 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-emerald-500/20 rounded-full blur-[80px]"
        />
      </div>

      {/* Starfield */}
      <div className="fixed inset-0 starfield pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 text-center px-6">
        <AnimatePresence mode="wait">
          {status === 'processing' ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <motion.div className="relative w-24 h-24 mb-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 border-4 border-transparent border-t-cosmic-gold border-r-cosmic-gold/50 rounded-full"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-2 border-4 border-transparent border-b-amber-400 border-l-amber-400/50 rounded-full"
                />
                <div className="absolute inset-4 bg-cosmic-gold/20 rounded-full blur-md" />
                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-cosmic-gold" />
              </motion.div>

              <h1 className="text-2xl md:text-3xl font-playfair italic text-cosmic-divine mb-4">
                Préparation de votre Sanctuaire...
              </h1>
              <p className="text-cosmic-stardust text-sm max-w-md">
                Nous finalisons votre accès. Cela ne prendra qu&apos;un instant.
              </p>
            </motion.div>
          ) : status === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center max-w-md"
            >
              <div className="w-20 h-20 mb-6 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-rose-400" />
              </div>
              <h1 className="text-2xl font-playfair italic text-cosmic-divine mb-3">
                Accès à finaliser
              </h1>
              <p className="text-cosmic-stardust text-sm mb-6">{errorMessage}</p>
              <button
                onClick={() =>
                  router.push(
                    emailParam
                      ? `/sanctuaire/login?email=${encodeURIComponent(emailParam)}`
                      : '/sanctuaire/login',
                  )
                }
                className="px-6 py-3 rounded-xl bg-cosmic-gold/20 border border-cosmic-gold/40 text-cosmic-gold text-sm font-medium hover:bg-cosmic-gold/30 transition-colors"
              >
                Se connecter au Sanctuaire
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="confirmed"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 15,
              }}
              className="flex flex-col items-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 12,
                  delay: 0.2,
                }}
                className="relative w-24 h-24 mb-8"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full shadow-[0_0_40px_rgba(52,211,153,0.4)]" />
                <CheckCircle className="absolute inset-0 m-auto w-12 h-12 text-white" />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl md:text-4xl font-playfair italic text-cosmic-divine mb-4"
              >
                Paiement confirmé !
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-cosmic-stardust text-sm max-w-md mb-8"
              >
                Votre accès est prêt. Redirection vers votre Sanctuaire...
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex items-center gap-2 text-cosmic-gold text-xs"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirection en cours...</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0A0514] via-[#1a0b2e] to-[#0A0514]">
          <Loader2 className="w-12 h-12 text-cosmic-gold animate-spin" />
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
