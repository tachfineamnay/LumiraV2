'use client';

import {
  Component,
  useState,
  useEffect,
  useRef,
  Suspense,
  useCallback,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Shield, CreditCard, Crown, Sparkles, Check, ArrowRight } from 'lucide-react';
import {
  CheckoutHeader,
  CheckoutForm,
  CheckoutFormData,
  StripePayment,
  TrustBadges,
} from '../../components/checkout';
import { SUBSCRIPTION } from '../../lib/products';
import sanctuaireApi from '../../lib/sanctuaireApi';
import {
  buildSanctuairePostCheckoutUrl,
  completeCheckoutSession,
  getCheckoutPaymentStatus,
} from '../../lib/completeCheckoutSession';
import {
  clearCheckoutAttempt,
  paymentIntentIdFromClientSecret,
  readCheckoutAttempt,
  saveCheckoutAttempt,
} from '../../lib/checkoutAttempt';
import { trackInitiateCheckout, trackPurchase } from '../../lib/pixel';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

function getPublishableKeyMode(): 'live' | 'test' | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  if (key.startsWith('pk_live_')) return 'live';
  if (key.startsWith('pk_test_')) return 'test';
  return null;
}

class StripeElementsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          data-testid="stripe-payment-element"
          className="rounded-xl border border-rose-300/30 bg-rose-300/10 p-4 text-sm leading-6 text-rose-50"
          role="alert"
        >
          Le module de paiement n&apos;a pas pu se charger. Aucun paiement n&apos;a été effectué :
          rechargez cette même tentative ou revenez plus tard sans créer un second paiement.
        </div>
      );
    }
    return this.props.children;
  }
}

// Type for connected user from Sanctuaire
interface ConnectedUser {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

function CheckoutContent() {
  // Get connected user from Sanctuaire session (if any)
  const [connectedUser, setConnectedUser] = useState<ConnectedUser | null>(null);
  const [formData, setFormData] = useState<CheckoutFormData | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'payment'>('form');
  const [isPreparationSlow, setIsPreparationSlow] = useState(false);
  const [isPaymentUncertain, setIsPaymentUncertain] = useState(false);
  const [stripeConfigurationError, setStripeConfigurationError] = useState<string | null>(null);
  const paymentSectionRef = useRef<HTMLDivElement>(null);
  const preparingIntentRef = useRef(false);
  const finalizingPaymentRef = useRef(false);
  const checkoutAttemptIdRef = useRef<string | null>(null);

  // Try to fetch connected user from Sanctuaire session cookies on mount
  useEffect(() => {
    const fetchConnectedUser = async () => {
      try {
        const response = await sanctuaireApi.get('/users/profile');
        if (response.data) {
          setConnectedUser({
            email: response.data.email,
            firstName: response.data.firstName || '',
            lastName: response.data.lastName || '',
            phone: response.data.phone || null,
          });
        }
      } catch {
        console.log('[Checkout] No connected user found');
      }
    };
    fetchConnectedUser();
    trackInitiateCheckout(SUBSCRIPTION.price);
  }, []);

  useEffect(() => {
    const attempt = readCheckoutAttempt();
    if (!attempt) return;

    checkoutAttemptIdRef.current = attempt.checkoutAttemptId;
    if (!attempt.clientSecret || !attempt.paymentIntentId) {
      setPaymentError(
        'La préparation a été interrompue. Reprenez le formulaire : Lumira réutilisera la même tentative et ne créera pas de second paiement.',
      );
      return;
    }

    setClientSecret(attempt.clientSecret);
    setPaymentIntentId(attempt.paymentIntentId);
    setStep('payment');
    setIsPaymentUncertain(attempt.phase !== 'payment_ready');
  }, []);

  useEffect(() => {
    if (!isLoading || step !== 'form') {
      setIsPreparationSlow(false);
      return;
    }

    const timer = window.setTimeout(() => setIsPreparationSlow(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [isLoading, step]);

  useEffect(() => {
    if (step !== 'payment' || !clientSecret) return;

    const frame = window.requestAnimationFrame(() => {
      paymentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [clientSecret, step]);

  useEffect(() => {
    if (step !== 'payment' || !clientSecret || !paymentIntentId) return;

    let cancelled = false;
    void getCheckoutPaymentStatus(paymentIntentId, clientSecret)
      .then((result) => {
        const publishableKeyMode = getPublishableKeyMode();
        if (!cancelled && (!publishableKeyMode || result.stripeMode !== publishableKeyMode)) {
          setStripeConfigurationError(
            "Le module de paiement est configuré dans un environnement différent de votre commande. Aucun paiement n'a été effectué : ne recommencez pas le paiement, contactez Lumira ou réessayez après la correction du service.",
          );
        }
      })
      .catch(() => {
        // The Element remains usable when a status probe is temporarily unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [clientSecret, paymentIntentId, step]);

  const handleFormValid = useCallback((data: CheckoutFormData) => {
    setFormData(data);
    setIsFormValid(true);
  }, []);

  const handleFormInvalid = useCallback(() => {
    setIsFormValid(false);
  }, []);

  const finalizePaymentAccess = useCallback(
    async (intentId: string) => {
      if (finalizingPaymentRef.current) return;

      finalizingPaymentRef.current = true;
      setIsLoading(true);
      setIsPaymentUncertain(true);
      setPaymentError(null);

      try {
        const attempt = readCheckoutAttempt();
        const secret = clientSecret || attempt?.clientSecret;
        if (!secret || !checkoutAttemptIdRef.current) {
          throw new Error('Missing checkout attempt proof');
        }
        saveCheckoutAttempt({
          checkoutAttemptId: checkoutAttemptIdRef.current,
          clientSecret: secret,
          paymentIntentId: intentId,
          phase: 'finalizing',
        });
        await completeCheckoutSession(intentId, secret);
        clearCheckoutAttempt();
        trackPurchase(SUBSCRIPTION.price, intentId);
        window.location.assign(buildSanctuairePostCheckoutUrl());
      } catch (err) {
        console.error('[Checkout] Post-payment session failed:', err);
        setPaymentError(
          "Votre paiement semble effectué, mais l'accès n'est pas encore finalisé. Ne payez pas une seconde fois : vérifiez à nouveau le paiement ou connectez-vous au Sanctuaire.",
        );
      } finally {
        finalizingPaymentRef.current = false;
        setIsLoading(false);
      }
    },
    [clientSecret],
  );

  const handleProceedToPayment = async () => {
    if (!formData || preparingIntentRef.current) return;

    preparingIntentRef.current = true;
    setIsLoading(true);
    setPaymentError(null);
    setStripeConfigurationError(null);

    try {
      const storedAttempt = readCheckoutAttempt();
      const checkoutAttemptId =
        storedAttempt?.checkoutAttemptId || checkoutAttemptIdRef.current || crypto.randomUUID();
      checkoutAttemptIdRef.current = checkoutAttemptId;
      saveCheckoutAttempt({ checkoutAttemptId, phase: 'preparing' });

      // The server remains authoritative for price, order and payment state.
      const response = await sanctuaireApi.post('/payments/checkout-intent', {
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        productLevel: 'lumira_early_v1',
        checkoutAttemptId,
      });

      const secret = response.data?.clientSecret;
      const intentId =
        (typeof response.data?.paymentIntentId === 'string' && response.data.paymentIntentId) ||
        (typeof secret === 'string' ? paymentIntentIdFromClientSecret(secret) : null);
      if (!secret || !intentId) {
        throw new Error('No client secret returned');
      }
      const publishableKeyMode = getPublishableKeyMode();
      if (!publishableKeyMode) {
        const message =
          "Le paiement sécurisé n'est pas configuré correctement. Aucun paiement n'a été effectué : réessayez plus tard ou contactez Lumira sans recommencer le paiement.";
        setStripeConfigurationError(message);
        setPaymentError(message);
        return;
      }
      if (response.data?.stripeMode && response.data.stripeMode !== publishableKeyMode) {
        const message =
          "Le module de paiement est configuré dans un environnement différent de celui de votre commande. Aucun paiement n'a été effectué : ne recommencez pas le paiement, contactez Lumira ou réessayez après la correction du service.";
        setStripeConfigurationError(message);
        setPaymentError(message);
        return;
      }

      setClientSecret(secret);
      setPaymentIntentId(intentId);
      saveCheckoutAttempt({
        checkoutAttemptId,
        clientSecret: secret,
        paymentIntentId: intentId,
        phase: 'payment_ready',
      });
      setStep('payment');
      if (response.data?.paymentStatus === 'succeeded') {
        await finalizePaymentAccess(intentId);
      }
    } catch (err) {
      console.error('[Checkout] Error:', err);
      setPaymentError(
        "Nous n'avons pas pu préparer le paiement. Aucun débit n'a été confirmé : vous pouvez réessayer une seule fois lorsque votre connexion est rétablie.",
      );
    } finally {
      preparingIntentRef.current = false;
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async (intentId: string) => {
    setPaymentIntentId(intentId);
    await finalizePaymentAccess(intentId);
  };

  const handlePaymentAttemptStart = () => {
    if (!clientSecret || !paymentIntentId || !checkoutAttemptIdRef.current) return;
    saveCheckoutAttempt({
      checkoutAttemptId: checkoutAttemptIdRef.current,
      clientSecret,
      paymentIntentId,
      phase: 'confirming',
    });
    setIsPaymentUncertain(true);
    setPaymentError(null);
  };

  const handlePaymentError = (error: { message: string; paymentMayBePending: boolean }) => {
    if (clientSecret && paymentIntentId && checkoutAttemptIdRef.current) {
      saveCheckoutAttempt({
        checkoutAttemptId: checkoutAttemptIdRef.current,
        clientSecret,
        paymentIntentId,
        phase: error.paymentMayBePending ? 'confirming' : 'payment_ready',
      });
    }
    setIsPaymentUncertain(error.paymentMayBePending);
    setPaymentError(error.message);
  };

  const verifyPaymentAttempt = async () => {
    if (!clientSecret || !paymentIntentId || isLoading || finalizingPaymentRef.current) return;
    setIsLoading(true);
    setPaymentError(null);
    try {
      const result = await getCheckoutPaymentStatus(paymentIntentId, clientSecret);
      if (result.status === 'succeeded') {
        await finalizePaymentAccess(paymentIntentId);
        return;
      }
      if (result.status === 'requires_action' || result.status === 'requires_payment_method') {
        if (checkoutAttemptIdRef.current) {
          saveCheckoutAttempt({
            checkoutAttemptId: checkoutAttemptIdRef.current,
            clientSecret,
            paymentIntentId,
            phase: 'payment_ready',
          });
        }
        setIsPaymentUncertain(false);
        setPaymentError(
          "Votre paiement n'est pas confirmé. Reprenez la même tentative ci-dessous : aucun nouveau paiement ne sera créé.",
        );
        return;
      }
      setIsPaymentUncertain(true);
      setPaymentError(
        "Votre paiement est encore en cours de validation. Ne payez pas une seconde fois : vérifiez à nouveau dans un instant ou demandez votre lien d'accès.",
      );
    } catch {
      setIsPaymentUncertain(true);
      setPaymentError(
        'Nous ne pouvons pas vérifier le paiement pour le moment. Ne payez pas une seconde fois : réessayez cette vérification lorsque la connexion est rétablie.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip">
      {/* Ciel crépusculaire — nuit qui s'ouvre vers l'aube */}
      <div
        className="fixed inset-0"
        style={{
          background:
            'linear-gradient(180deg, #060d1f 0%, #0a1530 18%, #0d1e42 36%, #102248 52%, #152d58 68%, #1a3a6e 82%, #1e4880 100%)',
        }}
      />

      {/* Halos de lumière — l'espoir qui monte */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Halo d'horizon — lumière chaude qui monte du bas */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[140%] h-[55%]"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(100, 160, 240, 0.22) 0%, rgba(70, 120, 210, 0.1) 40%, transparent 70%)',
          }}
        />
        {/* Étoile du matin — lueur dorée subtile */}
        <div
          className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[60%] h-[40%]"
          style={{
            background:
              'radial-gradient(ellipse 50% 40% at 50% 0%, rgba(180, 140, 60, 0.06) 0%, transparent 70%)',
          }}
        />
        {/* Orbe lumineux gauche — bleu clair */}
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -25, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 -left-24 w-80 h-80 rounded-full blur-[120px]"
          style={{ background: 'rgba(60, 130, 220, 0.15)' }}
        />
        {/* Orbe lumineux droite — bleu azur */}
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 35, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/3 -right-24 w-72 h-72 rounded-full blur-[100px]"
          style={{ background: 'rgba(80, 160, 230, 0.12)' }}
        />
        {/* Voile d'étoiles subtil */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(1px 1px at 20% 20%, rgba(255,255,255,0.18) 0%, transparent 70%), radial-gradient(1.5px 1.5px at 65% 12%, rgba(200,220,255,0.12) 0%, transparent 70%), radial-gradient(1px 1px at 80% 55%, rgba(255,255,255,0.08) 0%, transparent 70%), radial-gradient(1px 1px at 35% 75%, rgba(180,210,255,0.1) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <CheckoutHeader />

        <main className="mx-auto min-w-0 max-w-5xl scroll-pb-32 px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:px-6 md:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Product Summary - Left Column */}
            <div className="lg:col-span-5 order-2 lg:order-1">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:sticky lg:top-8"
              >
                {/* Subscription Card — seuil de lumière */}
                <div
                  className="rounded-2xl backdrop-blur-xl p-6 md:p-8"
                  style={{
                    background:
                      'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(100,160,255,0.04) 50%, rgba(255,255,255,0.03) 100%)',
                    border: '1px solid rgba(130,180,255,0.18)',
                    boxShadow:
                      '0 8px 32px rgba(10,20,60,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{
                        background:
                          'linear-gradient(135deg, rgba(232,168,56,0.18) 0%, rgba(200,140,40,0.1) 100%)',
                        border: '1px solid rgba(232,168,56,0.25)',
                      }}
                    >
                      <Crown className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-playfair italic text-white">
                        {SUBSCRIPTION.name}
                      </h2>
                      <p className="text-xs" style={{ color: 'rgba(180,210,255,0.55)' }}>
                        {SUBSCRIPTION.description}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div
                    className="flex items-baseline gap-1 mb-6 pb-6"
                    style={{ borderBottom: '1px solid rgba(130,180,255,0.1)' }}
                  >
                    <span
                      className="text-4xl font-playfair italic"
                      style={{
                        background: 'linear-gradient(135deg, #ffffff 0%, #c8dcff 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {SUBSCRIPTION.price}€
                    </span>
                    <span style={{ color: 'rgba(160,200,255,0.45)' }}>paiement unique</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3">
                    {SUBSCRIPTION.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check
                          className="w-4 h-4 flex-shrink-0 mt-0.5"
                          style={{ color: 'rgba(140,200,255,0.8)' }}
                        />
                        <span className="text-sm" style={{ color: 'rgba(200,225,255,0.75)' }}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div
                    className="mt-6 pt-4"
                    style={{ borderTop: '1px solid rgba(130,180,255,0.1)' }}
                  >
                    <p
                      className="text-[11px] text-center"
                      style={{ color: 'rgba(160,200,255,0.35)' }}
                    >
                      Paiement unique · {SUBSCRIPTION.accessLabel} · Satisfait ou remboursé 14 jours
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Form & Payment - Right Column */}
            <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
              {/* Step 1: Form */}
              <AnimatePresence mode="wait">
                {step === 'form' && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="backdrop-blur-xl rounded-2xl p-6 md:p-8"
                    style={{
                      background:
                        'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(80,130,220,0.04) 100%)',
                      border: '1px solid rgba(130,180,255,0.15)',
                      boxShadow:
                        '0 8px 40px rgba(10,20,60,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-horizon-400/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-horizon-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-playfair italic text-white">
                          Vos informations
                        </h2>
                        {connectedUser && (
                          <span className="text-sm" style={{ color: 'rgba(160,200,255,0.6)' }}>
                            Informations pré-remplies
                          </span>
                        )}
                      </div>
                    </div>

                    <CheckoutForm
                      onFormValid={handleFormValid}
                      onFormInvalid={handleFormInvalid}
                      initialValues={
                        connectedUser
                          ? {
                              email: connectedUser.email,
                              firstName: connectedUser.firstName || '',
                              lastName: connectedUser.lastName || '',
                              phone: connectedUser.phone || '',
                            }
                          : undefined
                      }
                    />
                    {connectedUser && (
                      <p className="mt-5 text-sm leading-6 text-blue-100/75">
                        Votre compte existe déjà. Votre accès actuel reste disponible dans le
                        Sanctuaire : ne procédez à ce paiement que pour un nouvel achat.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Trust Badges */}
              <TrustBadges />

              {/* Payment Error */}
              <AnimatePresence mode="wait">
                {paymentError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300"
                    role="alert"
                  >
                    <Shield className="w-5 h-5 flex-shrink-0" />
                    {paymentError}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 1: Continue to Payment button */}
              {step === 'form' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="scroll-mt-4 backdrop-blur-xl rounded-2xl p-6 md:p-8"
                  style={{
                    background:
                      'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(80,130,220,0.03) 100%)',
                    border: '1px solid rgba(130,180,255,0.12)',
                  }}
                >
                  <button
                    onClick={handleProceedToPayment}
                    disabled={!isFormValid || isLoading}
                    className="flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl px-8 py-5 text-lg font-bold transition-all duration-300 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      background: 'linear-gradient(135deg, #e8a838 0%, #f4b942 50%, #ffcc5c 100%)',
                      color: '#080c1a',
                      boxShadow: '0 4px 24px rgba(232,168,56,0.25), 0 0 0 1px rgba(232,168,56,0.1)',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        '0 8px 40px rgba(232,168,56,0.45), 0 0 0 1px rgba(232,168,56,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.boxShadow =
                        '0 4px 24px rgba(232,168,56,0.25), 0 0 0 1px rgba(232,168,56,0.1)';
                    }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Préparation du paiement...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Payer {SUBSCRIPTION.price}€
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  {isPreparationSlow && (
                    <p
                      className="mt-4 text-center text-sm leading-6 text-blue-100/75"
                      role="status"
                    >
                      La préparation prend plus de temps que prévu. Gardez cette page ouverte : ne
                      cliquez pas une seconde fois, aucun paiement n&apos;est encore confirmé.
                    </p>
                  )}
                  {!connectedUser && (
                    <p className="mt-4 text-center text-sm leading-6 text-blue-100/75">
                      Vous avez déjà un accès ? Connectez-vous au Sanctuaire avant de payer.
                      Utiliser une adresse connue ne crée pas un second compte.
                    </p>
                  )}
                </motion.div>
              )}

              {/* Step 2: Embedded Stripe Payment */}
              {step === 'payment' && clientSecret && (
                <motion.div
                  ref={paymentSectionRef}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="backdrop-blur-xl rounded-2xl p-6 md:p-8"
                  style={{
                    background:
                      'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(80,130,220,0.04) 100%)',
                    border: '1px solid rgba(130,180,255,0.15)',
                    boxShadow:
                      '0 8px 40px rgba(10,20,60,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(100,160,255,0.1)' }}
                    >
                      <CreditCard className="w-5 h-5" style={{ color: 'rgba(150,200,255,0.8)' }} />
                    </div>
                    <h2 className="text-xl font-playfair italic text-white">Paiement sécurisé</h2>
                  </div>

                  {stripeConfigurationError ? (
                    <div
                      className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50"
                      role="alert"
                    >
                      {stripeConfigurationError}
                    </div>
                  ) : (
                    <StripeElementsBoundary>
                      <Elements
                        stripe={getStripe()}
                        options={{
                          clientSecret,
                          appearance: {
                            theme: 'night',
                            variables: {
                              colorPrimary: '#e8a838',
                              colorBackground: '#0f1e42',
                              colorText: '#c8dcff',
                              borderRadius: '12px',
                            },
                          },
                        }}
                      >
                        <StripePayment
                          amount={SUBSCRIPTION.price * 100}
                          onPaymentSuccess={handlePaymentSuccess}
                          onPaymentError={handlePaymentError}
                          onPaymentAttemptStart={handlePaymentAttemptStart}
                          disabled={isLoading || isPaymentUncertain}
                        />
                        {isPaymentUncertain && paymentIntentId && (
                          <div className="mt-5 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50">
                            <p className="leading-6">
                              Une seule tentative de paiement est active. Avant de recommencer,
                              vérifiez cette tentative : cela ne crée aucun nouveau paiement.
                            </p>
                            <button
                              type="button"
                              onClick={() => void verifyPaymentAttempt()}
                              disabled={isLoading}
                              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-amber-200/50 px-4 py-2 font-semibold text-amber-50 transition-colors hover:bg-amber-100/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isLoading
                                ? 'Vérification en cours…'
                                : 'Vérifier mon paiement et accéder au Sanctuaire'}
                            </button>
                          </div>
                        )}
                      </Elements>
                    </StripeElementsBoundary>
                  )}
                </motion.div>
              )}

              {/* Security Footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center justify-center gap-6 text-xs"
                style={{ color: 'rgba(150,190,255,0.4)' }}
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Paiement sécurisé SSL</span>
                </div>
                <div
                  className="w-1 h-1 rounded-full"
                  style={{ background: 'rgba(150,190,255,0.25)' }}
                />
                <span>Propulsé par Stripe</span>
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function CommandePage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{
            background: 'linear-gradient(180deg, #060d1f 0%, #0d1e42 50%, #1a3a6e 100%)',
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-12 h-12" style={{ color: 'rgba(140,190,255,0.8)' }} />
          </motion.div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
