'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';
import {
  buildSanctuairePostCheckoutUrl,
  completeCheckoutSession,
} from '../../lib/completeCheckoutSession';
import {
  clearCheckoutAttempt,
  readCheckoutAttempt,
  saveCheckoutAttempt,
} from '../../lib/checkoutAttempt';
import { SUBSCRIPTION } from '../../lib/products';
import { trackPurchase } from '../../lib/pixel';

type PaymentStatus = 'processing' | 'confirmed' | 'needs_action';
type RecoveryAction = 'verify' | 'return_to_payment' | 'login';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryPaymentIntentId =
    searchParams.get('payment_intent') || searchParams.get('payment_intent_id') || '';
  const redirectStatus = searchParams.get('redirect_status');
  const [storedPaymentIntentId, setStoredPaymentIntentId] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recoveryAction, setRecoveryAction] = useState<RecoveryAction>('login');
  const [isRetrying, setIsRetrying] = useState(false);
  const startedRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);
  const paymentIntentId = queryPaymentIntentId || storedPaymentIntentId;

  useEffect(() => {
    const attempt = readCheckoutAttempt();
    setStoredPaymentIntentId(attempt?.paymentIntentId || '');
    setStorageReady(true);
  }, []);

  useEffect(
    () => () => {
      if (redirectTimerRef.current) window.clearTimeout(redirectTimerRef.current);
    },
    [],
  );

  const finalizeAccess = useCallback(async (intentId: string) => {
    setStatus('processing');
    setErrorMessage(null);

    try {
      await completeCheckoutSession(intentId);
      clearCheckoutAttempt();
      trackPurchase(SUBSCRIPTION.price, intentId);
      setStatus('confirmed');
      redirectTimerRef.current = window.setTimeout(() => {
        window.location.assign(buildSanctuairePostCheckoutUrl());
      }, 800);
    } catch (err) {
      console.error('[PaymentSuccess] confirm failed:', err);
      setStatus('needs_action');
      setRecoveryAction('verify');
      setErrorMessage(
        redirectStatus === 'succeeded'
          ? "Votre paiement semble avoir été effectué, mais l'accès au Sanctuaire n'est pas encore finalisé. Ne payez pas une seconde fois : relancez uniquement cette vérification ou demandez votre lien d'accès."
          : "Nous ne pouvons pas encore confirmer votre paiement. Il peut être en cours de validation : ne payez pas une seconde fois, vérifiez plutôt cet accès ou demandez votre lien d'accès.",
      );
    }
  }, [redirectStatus]);

  useEffect(() => {
    if (!storageReady || startedRef.current) return;
    startedRef.current = true;

    if (redirectStatus && redirectStatus !== 'succeeded') {
      const attempt = readCheckoutAttempt();
      if (attempt) {
        saveCheckoutAttempt({ ...attempt, phase: 'payment_ready' });
      }
      setStatus('needs_action');
      setRecoveryAction('return_to_payment');
      setErrorMessage(
        "Votre banque n'a pas confirmé le paiement. Aucun débit n'est confirmé : reprenez la même tentative au lieu d'en créer une nouvelle.",
      );
      return;
    }

    if (!paymentIntentId) {
      setStatus('needs_action');
      setRecoveryAction('login');
      setErrorMessage(
        "Nous ne retrouvons pas de paiement à vérifier. Aucun débit n'est confirmé ici : demandez un lien d'accès si vous avez déjà acheté Lumira.",
      );
      return;
    }

    void finalizeAccess(paymentIntentId);
  }, [finalizeAccess, paymentIntentId, redirectStatus, storageReady]);

  const retryFinalization = async () => {
    if (!paymentIntentId || isRetrying) return;
    setIsRetrying(true);
    await finalizeAccess(paymentIntentId);
    setIsRetrying(false);
  };

  return (
    <main className="relative flex min-h-[100dvh] min-w-0 items-start justify-center overflow-x-clip px-4 py-8 sm:items-center sm:px-6">
      <div className="fixed inset-0 -z-10 bg-[#0a1024]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(45,104,180,0.28),transparent_55%),linear-gradient(180deg,#0a1024_0%,#10254a_100%)]" />

      <AnimatePresence mode="wait">
        {status === 'processing' ? (
          <motion.section
            key="processing"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full max-w-md flex-col items-center text-center"
            aria-live="polite"
          >
            <div className="mb-6 grid h-20 w-20 place-items-center rounded-full border border-horizon-300/30 bg-horizon-300/10">
              <Loader2 className="h-9 w-9 animate-spin text-horizon-300" />
            </div>
            <h1 className="text-2xl font-playfair italic text-white">Vérification de votre accès</h1>
            <p className="mt-4 text-sm leading-6 text-blue-100/80">
              Nous vérifions le paiement avec Lumira avant d&apos;ouvrir votre Sanctuaire. Ne
              relancez pas le paiement pendant cette étape.
            </p>
          </motion.section>
        ) : status === 'confirmed' ? (
          <motion.section
            key="confirmed"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex w-full max-w-md flex-col items-center text-center"
            aria-live="polite"
          >
            <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_0_40px_rgba(52,211,153,0.35)]">
              <CheckCircle className="h-11 w-11" />
            </div>
            <h1 className="text-3xl font-playfair italic text-white">Paiement vérifié</h1>
            <p className="mt-4 text-sm leading-6 text-blue-100/80">
              Votre accès au Sanctuaire est prêt. Ouverture en cours.
            </p>
          </motion.section>
        ) : (
          <motion.section
            key="needs-action"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0c1a36]/85 p-6 text-center shadow-2xl backdrop-blur"
            role="alert"
          >
            <AlertCircle className="mx-auto h-10 w-10 text-amber-300" />
            <h1 className="mt-4 text-2xl font-playfair italic text-white">Accès à vérifier</h1>
            <p className="mt-3 text-sm leading-6 text-blue-100/85">{errorMessage}</p>
            {recoveryAction === 'verify' && (
              <button
                type="button"
                onClick={() => void retryFinalization()}
                disabled={isRetrying}
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-horizon-300 px-4 py-3 font-semibold text-abyss-900 transition-colors hover:bg-horizon-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetrying ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                {isRetrying ? 'Vérification en cours…' : 'Vérifier mon accès sans repayer'}
              </button>
            )}
            {recoveryAction === 'return_to_payment' && (
              <button
                type="button"
                onClick={() => router.push('/commande')}
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-horizon-300 px-4 py-3 font-semibold text-abyss-900 transition-colors hover:bg-horizon-200"
              >
                Revenir à ma tentative de paiement
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push('/sanctuaire/login')}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-blue-100/30 px-4 py-2 text-sm font-semibold text-blue-50 transition-colors hover:bg-blue-100/10"
            >
              Recevoir un lien pour le Sanctuaire
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-[100dvh] place-items-center bg-[#0a1024]" aria-live="polite">
          <Loader2 className="h-10 w-10 animate-spin text-horizon-300" />
        </main>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
