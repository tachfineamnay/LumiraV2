'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import {
  Sparkles,
  Star,
  Clock,
  X,
  Loader2,
  Check,
  TrendingUp,
  Gift,
  Zap
} from 'lucide-react';
import api from '@/lib/api';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface UpsellProduct {
  type: string;
  name: string;
  amount: number;
  description: string;
}

interface UpsellModalProps {
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// Inner payment form component
function UpsellPaymentForm({
  orderId,
  product,
  paymentIntentId,
  onSuccess,
  onCancel
}: {
  orderId: string;
  product: UpsellProduct;
  paymentIntentId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href, // Fallback, we handle in-page
      },
      redirect: 'if_required'
    });

    if (submitError) {
      setError(submitError.message || 'Erreur de paiement');
      setIsProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      // Confirm on backend
      try {
        await api.post(`/payments/orders/${orderId}/upsell/confirm`, {
          addonType: product.type,
          paymentIntentId
        });
        setIsComplete(true);
        setTimeout(onSuccess, 1500);
      } catch (err) {
        console.error('Confirmation error:', err);
        // Payment succeeded even if confirmation API fails
        setIsComplete(true);
        setTimeout(onSuccess, 1500);
      }
    }

    setIsProcessing(false);
  };

  if (isComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center"
        >
          <Check className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h3 className="text-xl font-playfair text-cosmic-divine mb-2">
          Ajout confirmé !
        </h3>
        <p className="text-cosmic-stardust text-sm">
          Vos prévisions seront incluses dans votre lecture.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          defaultValues: {
            billingDetails: {
              address: { country: 'FR' }
            }
          }
        }}
      />

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-400 text-sm text-center"
        >
          {error}
        </motion.p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-cosmic-stardust hover:bg-white/5 transition-colors"
        >
          Non, je passe
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-cosmic-gold to-amber-500 text-abyss-900 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Paiement...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Ajouter pour {(product.amount / 100).toFixed(0)}€
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export function UpsellModal({ orderId, onClose, onSuccess }: UpsellModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<UpsellProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<UpsellProduct | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(300); // 5 minutes

  // Fetch available upsells
  useEffect(() => {
    const fetchUpsells = async () => {
      try {
        const { data } = await api.get(`/payments/orders/${orderId}/upsell`);
        if (data.isEligible && data.availableUpsells.length > 0) {
          setProducts(data.availableUpsells);
          // Track that upsell was offered
          api.post(`/payments/orders/${orderId}/upsell/offered`).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to fetch upsells:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUpsells();
  }, [orderId]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  // Create payment intent when product selected
  const handleSelectProduct = async (product: UpsellProduct) => {
    setSelectedProduct(product);
    setIsLoading(true);

    try {
      const { data } = await api.post(`/payments/orders/${orderId}/upsell`, {
        addonType: product.type
      });
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
    } catch (err) {
      console.error('Failed to create upsell intent:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Primary upsell product (Forecast 6M)
  const primaryProduct = products.find(p => p.type === 'FORECAST_6M') || products[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-abyss-800/95 to-abyss-900/95 rounded-2xl border border-cosmic-gold/20 shadow-2xl overflow-hidden"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-cosmic-gold/10 blur-3xl" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Fermer l'offre"
            className="absolute top-4 right-4 z-10 p-2 rounded-full hover:bg-white/10 transition-colors text-cosmic-stardust"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Timer badge */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30">
            <Clock className="w-4 h-4 text-red-400" />
            <span className="text-red-300 text-sm font-medium">
              Expire dans {formatTime(countdown)}
            </span>
          </div>

          <div className="relative p-6 pt-14">
            {/* Header */}
            <div className="text-center mb-6">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-cosmic-gold/20 to-amber-500/20 border border-cosmic-gold/30"
              >
                <Gift className="w-8 h-8 text-cosmic-gold" />
              </motion.div>

              <h2 className="text-2xl md:text-3xl font-playfair italic text-cosmic-divine mb-2">
                Attendez ! Offre Exclusive
              </h2>
              <p className="text-cosmic-stardust text-sm max-w-sm mx-auto">
                Votre lecture natale est en cours de préparation...
              </p>
            </div>

            {isLoading && !selectedProduct ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 text-cosmic-gold animate-spin" />
              </div>
            ) : selectedProduct && clientSecret ? (
              /* Payment Form */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-cosmic-stardust text-sm">Ajout sélectionné</span>
                    <span className="text-cosmic-gold font-semibold">
                      {(selectedProduct.amount / 100).toFixed(0)}€
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{selectedProduct.name}</h3>
                </div>

                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'night',
                      variables: {
                        colorPrimary: '#D4AF37',
                        colorBackground: '#1a1a2e',
                        colorText: '#e0e0e0',
                        fontFamily: 'system-ui, sans-serif',
                        borderRadius: '8px'
                      }
                    }
                  }}
                >
                  <UpsellPaymentForm
                    orderId={orderId}
                    product={selectedProduct}
                    paymentIntentId={paymentIntentId!}
                    onSuccess={onSuccess}
                    onCancel={onClose}
                  />
                </Elements>
              </div>
            ) : primaryProduct ? (
              /* Product Selection */
              <div className="space-y-4">
                {/* Main offer card */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="relative p-5 rounded-xl bg-gradient-to-br from-cosmic-gold/10 to-amber-500/5 border border-cosmic-gold/30 cursor-pointer"
                  onClick={() => handleSelectProduct(primaryProduct)}
                >
                  {/* Discount badge */}
                  <div className="absolute -top-3 left-4 px-3 py-1 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold">
                    -60% AUJOURD'HUI
                  </div>

                  <div className="flex items-start gap-4 mt-2">
                    <div className="flex-shrink-0 p-3 rounded-lg bg-cosmic-gold/20">
                      <TrendingUp className="w-6 h-6 text-cosmic-gold" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {primaryProduct.name}
                      </h3>
                      <p className="text-cosmic-stardust text-sm mb-3">
                        Découvrez ce que les astres vous réservent pour les 6 prochains mois. 
                        Inclus dans votre lecture natale !
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-cosmic-stardust line-through text-sm">67€</span>
                        <span className="text-2xl font-bold text-cosmic-gold">
                          {(primaryProduct.amount / 100).toFixed(0)}€
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Benefits */}
                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-2">
                    {[
                      'Prévisions mensuelles',
                      'Dates clés à retenir',
                      'Conseils personnalisés',
                      'Opportunités à saisir'
                    ].map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-cosmic-stardust">
                        <Star className="w-3 h-3 text-cosmic-gold" />
                        <span>{benefit}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* CTA Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-cosmic-stardust hover:bg-white/5 transition-colors"
                  >
                    Non merci
                  </button>
                  <button
                    onClick={() => handleSelectProduct(primaryProduct)}
                    className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-cosmic-gold to-amber-500 text-abyss-900 font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Oui, j'ajoute !
                  </button>
                </div>

                {/* Trust indicators */}
                <p className="text-center text-xs text-cosmic-stardust/60">
                  🔒 Paiement sécurisé • Satisfaction garantie
                </p>
              </div>
            ) : (
              /* No products available */
              <div className="text-center py-8">
                <p className="text-cosmic-stardust">Aucune offre disponible pour le moment.</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                >
                  Continuer
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
