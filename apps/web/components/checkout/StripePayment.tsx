'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Lock, Loader2, RefreshCw } from 'lucide-react';

interface StripePaymentProps {
  amount: number;
  onPaymentSuccess: (paymentIntentId: string) => void;
  onPaymentError: (error: string) => void;
  disabled?: boolean;
}

type PaymentElementState = 'loading' | 'ready' | 'error' | 'timeout';

const PAYMENT_ELEMENT_TIMEOUT_MS = 15_000;

export function StripePayment({
  amount,
  onPaymentSuccess,
  onPaymentError,
  disabled,
}: StripePaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentElementState, setPaymentElementState] = useState<PaymentElementState>('loading');
  const [paymentElementAttempt, setPaymentElementAttempt] = useState(0);

  useEffect(() => {
    if (paymentElementState === 'ready') return;

    const timeout = window.setTimeout(() => {
      setPaymentElementState((current) => (current === 'ready' ? current : 'timeout'));
    }, PAYMENT_ELEMENT_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [paymentElementAttempt, paymentElementState]);

  const retryPaymentElement = () => {
    if (isProcessing) return;
    setPaymentElementState('loading');
    setPaymentElementAttempt((attempt) => attempt + 1);
  };

  const handleSubmit = async () => {
    if (!stripe || !elements || isProcessing || disabled || paymentElementState !== 'ready') {
      return;
    }

    setIsProcessing(true);

    try {
      // No PII in the return URL: /payment-success only needs payment_intent,
      // which Stripe appends automatically on redirect.
      const returnUrl = new URL(`${window.location.origin}/payment-success`);

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl.toString(),
        },
        redirect: 'if_required',
      });

      if (error) {
        onPaymentError(error.message || 'Une erreur est survenue lors du paiement');
        setIsProcessing(false);
      } else if (paymentIntent?.status === 'succeeded' && paymentIntent.id) {
        onPaymentSuccess(paymentIntent.id);
      } else {
        // Payment requires redirect or additional action (3DS) —
        // Stripe will navigate to return_url.
        setIsProcessing(false);
      }
    } catch {
      onPaymentError('Une erreur inattendue est survenue');
      setIsProcessing(false);
    }
  };

  const formattedAmount = (amount / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });

  const paymentElementUnavailable =
    paymentElementState === 'error' || paymentElementState === 'timeout';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="space-y-6"
    >
      <div
        data-testid="stripe-payment-element"
        className="relative min-h-[150px] scroll-mt-4 rounded-xl border border-white/10 bg-abyss-600/60 p-4 backdrop-blur-sm"
      >
        {paymentElementState === 'loading' && (
          <div
            className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-abyss-700/95 px-4 text-center"
            role="status"
            aria-live="polite"
          >
            <span className="inline-flex items-center gap-2 text-sm text-stellar-200">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement du paiement sécurisé…
            </span>
          </div>
        )}

        {paymentElementUnavailable && (
          <div
            className="absolute inset-0 z-20 grid place-items-center rounded-xl bg-abyss-700/98 p-4 text-center"
            role="alert"
          >
            <div>
              <p className="text-sm leading-6 text-rose-100">
                Le module de paiement n’a pas pu se charger correctement. Aucun paiement n’a été
                effectué.
              </p>
              <button
                type="button"
                onClick={retryPaymentElement}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-horizon-400 px-4 py-2 text-sm font-semibold text-abyss-900 hover:bg-horizon-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-horizon-300"
              >
                <RefreshCw className="h-4 w-4" /> Recharger le module de paiement
              </button>
            </div>
          </div>
        )}

        <PaymentElement
          key={`payment-element-${paymentElementAttempt}`}
          onLoaderStart={() => setPaymentElementState('loading')}
          onReady={() => setPaymentElementState('ready')}
          onLoadError={() => setPaymentElementState('error')}
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      <motion.button
        type="button"
        onClick={handleSubmit}
        disabled={
          !stripe || !elements || isProcessing || disabled || paymentElementState !== 'ready'
        }
        className={`
          min-h-[52px] w-full rounded-xl py-4 text-lg font-bold transition-all duration-300
          flex items-center justify-center gap-3
          ${
            isProcessing || disabled || paymentElementState !== 'ready'
              ? 'cursor-not-allowed border border-white/10 bg-abyss-600/60 text-stellar-500'
              : 'group relative cursor-pointer overflow-hidden bg-gradient-to-r from-horizon-400 via-horizon-300 to-horizon-400 text-abyss-900 shadow-gold-glow hover:shadow-gold-soft'
          }
        `}
        whileTap={{ scale: isProcessing || disabled ? 1 : 0.98 }}
      >
        {!isProcessing && !disabled && paymentElementState === 'ready' && (
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        )}

        <span className="relative z-10 flex items-center gap-2">
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Traitement en cours…</span>
            </>
          ) : paymentElementState !== 'ready' ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Chargement du paiement…</span>
            </>
          ) : (
            <>
              <Lock className="h-5 w-5" />
              <span>Payer {formattedAmount}</span>
            </>
          )}
        </span>
      </motion.button>

      <div className="flex items-center justify-center gap-2 text-xs text-stellar-400">
        <Lock className="h-3 w-3" />
        <span>Paiement sécurisé par Stripe</span>
      </div>
    </motion.div>
  );
}
