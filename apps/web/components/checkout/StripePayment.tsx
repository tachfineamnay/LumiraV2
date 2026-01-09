'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Lock, Loader2 } from 'lucide-react';

interface StripePaymentProps {
    amount: number;
    onPaymentSuccess: () => void;
    onPaymentError: (error: string) => void;
    disabled?: boolean;
}

export function StripePayment({ amount, onPaymentSuccess, onPaymentError, disabled }: StripePaymentProps) {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentElementReady, setPaymentElementReady] = useState(false);

    const handleSubmit = async () => {
        if (!stripe || !elements || isProcessing || disabled) return;

        setIsProcessing(true);

        try {
            console.log('[StripePayment] Confirming payment...');
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/payment-success`,
                },
                redirect: 'if_required',
            });

            console.log('[StripePayment] Result:', { error, paymentIntent });

            if (error) {
                console.error('[StripePayment] Error:', error);
                onPaymentError(error.message || 'Une erreur est survenue lors du paiement');
                setIsProcessing(false);
            } else if (paymentIntent?.status === 'succeeded') {
                console.log('[StripePayment] Payment succeeded!');
                onPaymentSuccess();
            } else {
                // Payment requires redirect or additional action
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
            {/* Express Checkout placeholder - Apple Pay/Google Pay */}
            <div className="text-center">
                <p className="text-cosmic-stardust text-xs uppercase tracking-widest mb-4">Paiement Express</p>
                <div className="flex gap-3 justify-center">
                    <div className="px-6 py-3 bg-black rounded-lg border border-white/10 text-white text-sm font-medium flex items-center gap-2 opacity-50 cursor-not-allowed">
                        <span>Apple Pay</span>
                    </div>
                    <div className="px-6 py-3 bg-white rounded-lg text-black text-sm font-medium flex items-center gap-2 opacity-50 cursor-not-allowed">
                        <span>Google Pay</span>
                    </div>
                </div>
                <p className="text-cosmic-stardust/50 text-xs mt-2">Bientôt disponible</p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <span className="text-cosmic-stardust text-xs uppercase tracking-widest">ou payer par carte</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            {/* Stripe Payment Element */}
            <div className="bg-cosmic-deep/60 backdrop-blur-sm border border-white/10 rounded-xl p-4">
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
                    ${isProcessing || disabled || !paymentElementReady
                        ? 'bg-cosmic-deep/60 text-cosmic-stardust cursor-not-allowed border border-white/10'
                        : 'bg-gradient-to-r from-cosmic-gold via-amber-400 to-cosmic-gold text-cosmic-void shadow-stellar hover:shadow-aurora cursor-pointer relative overflow-hidden group'
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
            <div className="flex items-center justify-center gap-2 text-cosmic-stardust/60 text-xs">
                <Lock className="w-3 h-3" />
                <span>Paiement sécurisé par Stripe</span>
            </div>
        </motion.div>
    );
}
