'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Shield, CreditCard, Crown, Sparkles, Check, ArrowRight } from 'lucide-react';
import { CheckoutHeader, CheckoutForm, CheckoutFormData, StripePayment, TrustBadges } from '../../components/checkout';
import { SUBSCRIPTION } from '../../lib/products';
import api from '../../lib/api';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Type for connected user from Sanctuaire
interface ConnectedUser {
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
}

function CheckoutContent() {
    // Get connected user from Sanctuaire token (if any)
    const [connectedUser, setConnectedUser] = useState<ConnectedUser | null>(null);
    const [formData, setFormData] = useState<CheckoutFormData | null>(null);
    const [isFormValid, setIsFormValid] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [step, setStep] = useState<'form' | 'payment'>('form');

    // Try to fetch connected user from Sanctuaire on mount
    useEffect(() => {
        const fetchConnectedUser = async () => {
            const token = localStorage.getItem('sanctuaire_token') || localStorage.getItem('lumira_token');
            if (!token) return;

            try {
                const response = await api.get('/users/profile', {
                    headers: { Authorization: `Bearer ${token}` }
                });
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
    }, []);

    const handleFormValid = (data: CheckoutFormData) => {
        setFormData(data);
        setIsFormValid(true);
    };

    const handleFormInvalid = () => {
        setIsFormValid(false);
    };

    const handleProceedToPayment = async () => {
        if (!formData) return;

        setIsLoading(true);
        setPaymentError(null);

        try {
            // Create checkout intent — this creates User + Order + PaymentIntent on the backend
            const response = await api.post('/payments/checkout-intent', {
                email: formData.email,
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone || undefined,
                productLevel: '4',
                amountCents: 2900,
            });

            const secret = response.data?.clientSecret;
            if (!secret) {
                throw new Error('No client secret returned');
            }

            setClientSecret(secret);
            setStep('payment');
        } catch (err: unknown) {
            console.error('[Checkout] Error:', err);
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                || 'Impossible de préparer le paiement. Veuillez réessayer.';
            setPaymentError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePaymentSuccess = () => {
        // Store token if user was registered during checkout-intent
        window.location.href = '/sanctuaire?subscription=success';
    };

    const handlePaymentError = (error: string) => {
        setPaymentError(error);
    };

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Cosmic Background */}
            <div className="fixed inset-0 bg-gradient-to-b from-abyss-900 via-abyss-700 to-abyss-800" />

            {/* Floating Cosmic Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{ x: [0, 50, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute top-1/4 -left-32 w-96 h-96 bg-serenity-500/20 rounded-full blur-[100px]"
                />
                <motion.div
                    animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute bottom-1/4 -right-32 w-80 h-80 bg-horizon-400/15 rounded-full blur-[80px]"
                />
            </div>

            {/* Starfield overlay */}
            <div className="fixed inset-0 starfield pointer-events-none opacity-60" />

            {/* Content */}
            <div className="relative z-10">
                <CheckoutHeader />

                <main className="max-w-5xl mx-auto px-6 pb-20">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                        {/* Product Summary - Left Column */}
                        <div className="lg:col-span-5 order-2 lg:order-1">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="sticky top-8"
                            >
                                {/* Subscription Card */}
                                <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-abyss-600/80 via-abyss-700/90 to-abyss-600/80 backdrop-blur-xl p-6 md:p-8">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center">
                                            <Crown className="w-6 h-6 text-amber-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-playfair italic text-white">{SUBSCRIPTION.name}</h2>
                                            <p className="text-xs text-white/50">{SUBSCRIPTION.description}</p>
                                        </div>
                                    </div>

                                    {/* Price */}
                                    <div className="flex items-baseline gap-1 mb-6 pb-6 border-b border-white/[0.06]">
                                        <span className="text-4xl font-playfair italic text-white">{SUBSCRIPTION.price}€</span>
                                        <span className="text-white/40">paiement unique</span>
                                    </div>

                                    {/* Features */}
                                    <ul className="space-y-3">
                                        {SUBSCRIPTION.features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-3">
                                                <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                                <span className="text-sm text-white/70">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="mt-6 pt-4 border-t border-white/[0.06]">
                                        <p className="text-[11px] text-white/30 text-center">
                                            Paiement unique · Accès à vie · Satisfait ou remboursé 14 jours
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
                                        className="bg-abyss-600/40 backdrop-blur-xl border border-horizon-400/20 rounded-2xl p-6 md:p-8 shadow-stellar"
                                    >
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 rounded-full bg-horizon-400/10 flex items-center justify-center">
                                                <CreditCard className="w-5 h-5 text-horizon-400" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-playfair italic text-stellar-100">
                                                    Vos informations
                                                </h2>
                                                {connectedUser && (
                                                    <span className="text-sm text-stellar-500">
                                                        Informations pré-remplies
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <CheckoutForm
                                            onFormValid={handleFormValid}
                                            onFormInvalid={handleFormInvalid}
                                            initialValues={connectedUser ? {
                                                email: connectedUser.email,
                                                firstName: connectedUser.firstName || '',
                                                lastName: connectedUser.lastName || '',
                                                phone: connectedUser.phone || '',
                                            } : undefined}
                                        />
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
                                        className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-sm flex items-center gap-3"
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
                                    className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8"
                                >
                                    <button
                                        onClick={handleProceedToPayment}
                                        disabled={!isFormValid || isLoading}
                                        className="w-full flex items-center justify-center gap-3 px-8 py-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-abyss-900 font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:from-amber-400 hover:to-amber-500 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]"
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
                                </motion.div>
                            )}

                            {/* Step 2: Embedded Stripe Payment */}
                            {step === 'payment' && clientSecret && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                    className="bg-abyss-600/40 backdrop-blur-xl border border-horizon-400/20 rounded-2xl p-6 md:p-8"
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-horizon-400/10 flex items-center justify-center">
                                            <CreditCard className="w-5 h-5 text-horizon-400" />
                                        </div>
                                        <h2 className="text-xl font-playfair italic text-stellar-100">
                                            Paiement sécurisé
                                        </h2>
                                    </div>

                                    <Elements
                                        stripe={stripePromise}
                                        options={{
                                            clientSecret,
                                            appearance: {
                                                theme: 'night',
                                                variables: {
                                                    colorPrimary: '#f59e0b',
                                                    colorBackground: '#1a1a2e',
                                                    colorText: '#e2e8f0',
                                                    borderRadius: '12px',
                                                },
                                            },
                                        }}
                                    >
                                        <StripePayment
                                            amount={2900}
                                            onPaymentSuccess={handlePaymentSuccess}
                                            onPaymentError={handlePaymentError}
                                        />
                                    </Elements>
                                </motion.div>
                            )}

                            {/* Security Footer */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="flex items-center justify-center gap-6 text-stellar-500 text-xs"
                            >
                                <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    <span>Paiement sécurisé SSL</span>
                                </div>
                                <div className="w-1 h-1 rounded-full bg-stellar-600" />
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
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-abyss-900 via-abyss-700 to-abyss-800">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                    <Loader2 className="w-12 h-12 text-horizon-400" />
                </motion.div>
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}
