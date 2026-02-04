'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { Loader2, Shield, CreditCard } from 'lucide-react';
import { CheckoutHeader, ProductSummary, CheckoutForm, CheckoutFormData, StripePayment, FreeOrderButton, TrustBadges } from '../../components/checkout';
import api from '../../lib/api';

// Type for connected user from Sanctuaire
interface ConnectedUser {
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Product {
    id: string;
    name: string;
    description: string;
    amountCents: number;
    level: string;
    features: string[];
    limitedOffer?: string | null;
}

function CheckoutContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const productLevel = searchParams.get('product') || 'initie';
    
    // Get connected user from Sanctuaire token (if any)
    const [connectedUser, setConnectedUser] = useState<ConnectedUser | null>(null);

    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<CheckoutFormData | null>(null);
    const [isFormValid, setIsFormValid] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [paymentError, setPaymentError] = useState<string | null>(null);

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
                // User not connected or token invalid - that's fine
                console.log('[Checkout] No connected user found');
            }
        };
        fetchConnectedUser();
    }, []);

    // Fetch product on mount
    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const response = await api.get(`/products/${productLevel}`);
                setProduct(response.data);
            } catch {
                // Fallback product data if API fails
                const fallbackProducts: Record<string, Product> = {
                    initie: {
                        id: 'initie',
                        name: 'Initié',
                        description: 'Accès Master - Offre Unique',
                        amountCents: 900,
                        level: 'INITIE',
                        features: ['Accès complet au Sanctuaire', 'Lectures audio & PDF', 'Rituels sacrés', 'Analyses karmiques'],
                        limitedOffer: null,
                    },
                    mystique: {
                        id: 'mystique',
                        name: 'Mystique',
                        description: 'Expérience audio (Obsolète)',
                        amountCents: 4700,
                        level: 'MYSTIQUE',
                        features: ['PDF lecture personnalisée', 'Audio voix sacrée', 'Accès au Sanctuaire'],
                        limitedOffer: 'Valable pour les 100 premiers clients',
                    },
                    profond: {
                        id: 'profond',
                        name: 'Profond',
                        description: 'Expérience complète (Obsolète)',
                        amountCents: 6700,
                        level: 'PROFOND',
                        features: ['PDF lecture personnalisée', 'Audio voix sacrée', 'Mandala HD personnalisé', 'Accès au Sanctuaire'],
                        limitedOffer: 'Valable pour les 100 premiers clients',
                    },
                    integrale: {
                        id: 'integrale',
                        name: 'Intégral',
                        description: 'Immersion totale (Obsolète)',
                        amountCents: 9700,
                        level: 'INTEGRALE',
                        features: ['Tout du niveau Profond', 'Rituels personnalisés', 'Suivi 30 jours', 'Accès prioritaire'],
                        limitedOffer: 'Valable pour les 50 premiers clients',
                    },
                };
                setProduct(fallbackProducts[productLevel] || fallbackProducts.initie);
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [productLevel]);

    // Create checkout intent when form becomes valid (for paid products)
    // Only run ONCE per valid form to prevent infinite loops
    useEffect(() => {
        // Guard: skip if not valid, no form data, no product, free product, or already have clientSecret
        if (!isFormValid || !formData || !product || product.amountCents === 0 || clientSecret) return;

        const createIntent = async () => {
            try {
                const response = await api.post('/payments/checkout-intent', {
                    email: formData.email,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    phone: formData.phone || '',
                    productLevel: product.level,
                    amountCents: product.amountCents,
                });
                setClientSecret(response.data.clientSecret);
            } catch {
                setPaymentError('Impossible de préparer le paiement. Veuillez réessayer.');
            }
        };

        createIntent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFormValid, product?.id, clientSecret]);

    const handleFormValid = useCallback((data: CheckoutFormData) => {
        setFormData(data);
        setIsFormValid(true);
    }, []);

    const handleFormInvalid = useCallback(() => {
        setIsFormValid(false);
        setClientSecret(null);
    }, []);

    const handlePaymentSuccess = () => {
        const successUrl = `/payment-success?email=${encodeURIComponent(formData?.email || '')}`;
        console.log('[Checkout] Payment success, redirecting to:', successUrl);
        // Use window.location for more reliable navigation after Stripe payment
        window.location.href = successUrl;
    };

    const handlePaymentError = (error: string) => {
        setPaymentError(error);
    };

    const handleFreeOrderSubmit = async () => {
        if (!formData || !product) return;

        try {
            // Create user and order directly for free products
            await api.post('/orders', {
                email: formData.email,
                firstName: formData.firstName,
                lastName: formData.lastName,
                totalAmount: 0,
                type: product.level,
            });

            router.push(`/sanctuaire?email=${encodeURIComponent(formData.email)}`);
        } catch (error) {
            console.error('Erreur création compte:', error);
            setPaymentError('Impossible de créer votre compte. Veuillez réessayer.');
        }
    };

    const isFree = product?.amountCents === 0;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-abyss-900 via-abyss-700 to-abyss-800">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="relative"
                >
                    <Loader2 className="w-12 h-12 text-horizon-400" />
                    <div className="absolute inset-0 w-12 h-12 bg-horizon-400/20 rounded-full blur-xl" />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Cosmic Background - Enhanced */}
            <div className="fixed inset-0 bg-gradient-to-b from-abyss-900 via-abyss-700 to-abyss-800" />

            {/* Floating Cosmic Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    animate={{
                        x: [0, 50, 0],
                        y: [0, -30, 0],
                        scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute top-1/4 -left-32 w-96 h-96 bg-serenity-500/20 rounded-full blur-[100px]"
                />
                <motion.div
                    animate={{
                        x: [0, -30, 0],
                        y: [0, 40, 0],
                        scale: [1, 1.15, 1],
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute bottom-1/4 -right-32 w-80 h-80 bg-horizon-400/15 rounded-full blur-[80px]"
                />
                <motion.div
                    animate={{
                        x: [0, 20, 0],
                        y: [0, -20, 0],
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-abyss-500/30 rounded-full blur-[120px]"
                />
                {/* Additional gold accent orb */}
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.2, 0.1],
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute top-20 right-1/4 w-64 h-64 bg-horizon-400/10 rounded-full blur-[60px]"
                />
            </div>

            {/* Starfield overlay */}
            <div className="fixed inset-0 starfield pointer-events-none opacity-60" />

            {/* Content */}
            <div className="relative z-10">
                <CheckoutHeader />

                <main className="max-w-6xl mx-auto px-6 pb-20">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                        {/* Product Summary - Left Column (5 cols) */}
                        <div className="lg:col-span-5 order-2 lg:order-1">
                            {product && <ProductSummary product={product} />}
                        </div>

                        {/* Form & Payment - Right Column (7 cols) */}
                        <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
                            {/* Glass Form Container */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
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

                            {/* Payment Section */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.2 }}
                                className="bg-abyss-600/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8"
                            >
                                {isFree ? (
                                    <FreeOrderButton
                                        onSubmit={handleFreeOrderSubmit}
                                        disabled={!isFormValid}
                                    />
                                ) : (
                                    <>
                                        {clientSecret ? (
                                            <Elements
                                                stripe={stripePromise}
                                                options={{
                                                    clientSecret,
                                                    appearance: {
                                                        theme: 'night',
                                                        variables: {
                                                            colorPrimary: '#E8A838',
                                                            colorBackground: '#101830',
                                                            colorText: '#F8FAFC',
                                                            colorDanger: '#f43f5e',
                                                            fontFamily: 'Inter, system-ui, sans-serif',
                                                            borderRadius: '12px',
                                                        },
                                                        rules: {
                                                            '.Input': {
                                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                                backgroundColor: 'rgba(16, 24, 48, 0.6)',
                                                            },
                                                            '.Input:focus': {
                                                                border: '1px solid rgba(232, 168, 56, 0.5)',
                                                                boxShadow: '0 0 0 2px rgba(232, 168, 56, 0.2)',
                                                            },
                                                        },
                                                    },
                                                }}
                                            >
                                                <StripePayment
                                                    amount={product?.amountCents || 0}
                                                    onPaymentSuccess={handlePaymentSuccess}
                                                    onPaymentError={handlePaymentError}
                                                    disabled={!isFormValid}
                                                />
                                            </Elements>
                                        ) : isFormValid ? (
                                            <div className="flex flex-col items-center justify-center py-12">
                                                <div className="relative">
                                                    <Loader2 className="w-10 h-10 text-horizon-400 animate-spin" />
                                                    <div className="absolute inset-0 w-10 h-10 bg-horizon-400/20 rounded-full blur-xl" />
                                                </div>
                                                <span className="mt-4 text-stellar-400">Préparation du paiement sécurisé...</span>
                                            </div>
                                        ) : (
                                            <div className="text-center py-8">
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-abyss-500/50 flex items-center justify-center">
                                                    <Shield className="w-8 h-8 text-stellar-500" />
                                                </div>
                                                <p className="text-stellar-400 text-sm">
                                                    Remplissez vos informations pour accéder au paiement sécurisé
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </motion.div>

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
