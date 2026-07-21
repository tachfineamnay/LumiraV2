'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Lock, Loader2 } from 'lucide-react';

interface StripePaymentProps {
  amount: number;
  onPaymentSuccess: (paymentIntentId: string) => void;
  onPaymentError: (error: string) => void;
  disabled?: boolean;
}

export function StripePayment({
  amount,
  onPaymentSuccess,
  onPaymentError,
  disabled,
}: StripePaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentElementReady, setPaymentElementReady] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements || isProcessing || disabled) return;

    setIsProcessing(true);

    try {
      // No PII in the return URL: /payment-success only needs payment_intent,
      // which Stripe appends automatically on redirect.
      const returnUrl = new URL(`${window.location.origin}/payment-success`);

      console.log('[StripePayment] Confirming payment...');
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl.toString(),
        },
        redirect: 'if_required',
      });

      console.log('[StripePayment] Result:', { error, paymentIntent });

      if (error) {
        console.error('[StripePayment] Error:', error);
        onPaymentError(error.message || 'Une erreur est survenue lors du paiement');
        setIsProcessing(false);
      } else if (paymentIntent?.status === 'succeeded' && paymentIntent.id) {
        console.log('[StripePayment] Payment succeeded!');
        onPaymentSuccess(paymentIntent.id);
      } else {
        // Payment requires redirect or additional action (3DS) —
        // Stripe will navigate to return_url
        console.log('[StripePayment] Payment status:', paymentIntent?.status);
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('[StripePayment] Unexpected error:', err);
      onPaymentError('Une erreur inattendue est survenue');
      setIsProcessing(false);
    }
  };

  const formattedAmount = (amount / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="space-y-6"
    >
      {/* Stripe Payment Element */}
      <div className="bg-abyss-600/60 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <PaymentElement
          onReady={() => setPaymentElementReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {/* Pay Button */}
      <motion.button
        onClick={handleSubmit}
        disabled={!stripe || !elements || isProcessing || disabled || !paymentElementReady}
        className={`
                    w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300
                    ${
                      isProcessing || disabled || !paymentElementReady
                        ? 'bg-abyss-600/60 text-stellar-500 cursor-not-allowed border border-white/10'
                        : 'bg-gradient-to-r from-horizon-400 via-horizon-300 to-horizon-400 text-abyss-900 shadow-gold-glow hover:shadow-gold-soft cursor-pointer relative overflow-hidden group'
                    }
                `}
        whileTap={{ scale: isProcessing || disabled ? 1 : 0.98 }}
      >
        {/* Shimmer effect */}
        {!isProcessing && !disabled && paymentElementReady && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        )}

        <span className="relative z-10 flex items-center gap-2">
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Traitement en cours...</span>
            </>
          ) : (
            <>
              <Lock className="w-5 h-5" />
              <span>Payer {formattedAmount}</span>
            </>
          )}
        </span>
      </motion.button>

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 text-stellar-500 text-xs">
        <Lock className="w-3 h-3" />
        <span>Paiement sécurisé par Stripe</span>
      </div>
    </motion.div>
  );
}
