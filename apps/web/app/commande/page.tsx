'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@packages/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../../lib/api';

const formSchema = z.object({
    firstName: z.string().min(2, 'Prénom requis'),
    lastName: z.string().min(2, 'Nom requis'),
    email: z.string().email('Email invalide'),
    birthDate: z.string().optional(),
    birthTime: z.string().optional(),
    birthPlace: z.string().optional(),
    specificQuestion: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function CommandePage() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState<{ id: string; totalAmount: number; firstName: string; lastName: string; email: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const stripe = useStripe();
    const elements = useElements();

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(formSchema),
    });

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const onInfoSubmit = async (data: FormData) => {
        setLoading(true);
        setError(null);
        try {
            // 1. Create Order on Backend
            const response = await api.post('/orders', {
                ...data,
                totalAmount: 49, // Example fixed price
                type: 'INITIE'
            });
            setOrder(response.data);
            nextStep();
        } catch (err: unknown) {
            const errorResponse = err as { response?: { data?: { message?: string } } };
            const message = errorResponse.response?.data?.message;
            setError(message || 'Une erreur est survenue lors de la création de la commande.');
        } finally {
            setLoading(false);
        }
    };

    const onPaymentSubmit = async () => {
        if (!stripe || !elements || !order) return;

        setLoading(true);
        setError(null);

        try {
            // 2. Create Payment Intent
            const { data: { clientSecret } } = await api.post('/payments/create-intent', {
                orderId: order.id,
                amount: order.totalAmount * 100, // Stripe expects cents
            });

            // 3. Confirm Payment with Stripe
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) return;

            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: `${order.firstName} ${order.lastName}`,
                        email: order.email,
                    },
                },
            });

            if (result.error) {
                setError(result.error.message || 'Paiement échoué');
            } else if (result.paymentIntent?.status === 'succeeded') {
                nextStep();
            }
        } catch (err: unknown) {
            const errorResponse = err as { response?: { data?: { message?: string } } };
            const message = errorResponse.response?.data?.message;
            setError(message || 'Erreur de paiement');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-950 to-slate-950">
            <div className="max-w-3xl mx-auto">
                {/* Progress Bar */}
                <div className="mb-12">
                    <div className="flex justify-between items-center relative">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className="flex flex-col items-center z-10">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${step >= s ? 'bg-indigo-600 border-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>
                                    {step > s ? <CheckCircle2 className="w-6 h-6" /> : s}
                                </div>
                                <span className={`mt-2 text-xs font-medium uppercase tracking-wider ${step >= s ? 'text-indigo-400' : 'text-slate-600'}`}>
                                    {s === 1 ? 'Informations' : s === 2 ? 'Paiement' : 'Confirmation'}
                                </span>
                            </div>
                        ))}
                        <div className="absolute top-5 left-0 w-full h-0.5 bg-slate-800 -z-0">
                            <motion.div
                                className="h-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.5)]"
                                initial={{ width: '0%' }}
                                animate={{ width: `${((step - 1) / 2) * 100}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </div>
                </div>

                {/* Form Container */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl overflow-hidden min-h-[500px]">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h2 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                                    Préparez votre lecture
                                </h2>
                                <form onSubmit={handleSubmit(onInfoSubmit)} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400 ml-1">Prénom</label>
                                            <input {...register('firstName')} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none" />
                                            {errors.firstName && <p className="text-rose-500 text-xs mt-1 ml-1">{errors.firstName.message as string}</p>}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-slate-400 ml-1">Nom</label>
                                            <input {...register('lastName')} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none" />
                                            {errors.lastName && <p className="text-rose-500 text-xs mt-1 ml-1">{errors.lastName.message as string}</p>}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-400 ml-1">Email</label>
                                        <input {...register('email')} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none" placeholder="pour recevoir votre lecture" />
                                        {errors.email && <p className="text-rose-500 text-xs mt-1 ml-1">{errors.email.message as string}</p>}
                                    </div>

                                    <div className="space-y-2 pt-4">
                                        <label className="text-sm font-medium text-slate-400 ml-1">Votre question (optionnel)</label>
                                        <textarea {...register('specificQuestion')} rows={4} className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none resize-none" placeholder="Y a-t-il un domaine particulier que vous souhaitez explorer ?" />
                                    </div>

                                    {error && <p className="text-rose-500 text-sm">{error}</p>}

                                    <div className="pt-6 flex justify-end">
                                        <Button type="submit" disabled={loading} className="px-8 py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center gap-2 group">
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continuer'}
                                            {!loading && <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                                        </Button>
                                    </div>
                                </form>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h2 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
                                    Finalisez votre commande
                                </h2>
                                <div className="p-6 bg-indigo-600/5 border border-indigo-500/20 rounded-2xl mb-8">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-slate-400 text-sm">Lecture Sélectionnée</p>
                                            <p className="text-xl font-bold">Niveau Initié</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-indigo-400">{order?.totalAmount || 49} €</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                                        <CardElement
                                            options={{
                                                style: {
                                                    base: {
                                                        fontSize: '16px',
                                                        color: '#fff',
                                                        '::placeholder': { color: '#64748b' },
                                                    },
                                                    invalid: { color: '#f43f5e' },
                                                },
                                            }}
                                        />
                                    </div>

                                    {error && <p className="text-rose-500 text-sm">{error}</p>}

                                    <div className="flex justify-between">
                                        <Button onClick={prevStep} variant="secondary" disabled={loading} className="px-6 py-4 rounded-xl flex items-center gap-2">
                                            <ChevronLeft className="w-4 h-4" />
                                            Retour
                                        </Button>
                                        <Button onClick={onPaymentSubmit} disabled={loading || !stripe} className="px-8 py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold flex items-center gap-2">
                                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            {loading ? 'Traitement...' : 'Confirmer le paiement'}
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', damping: 15 }}
                                className="text-center py-12"
                            >
                                <div className="w-24 h-24 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                                </div>
                                <h2 className="text-4xl font-black mb-4 tracking-tight">C&apos;est fait !</h2>
                                <p className="text-slate-400 text-lg mb-12 max-w-sm mx-auto">
                                    Votre lecture est en cours de préparation. Vous recevrez une notification par email dès qu&apos;elle sera disponible dans votre sanctuaire.
                                </p>
                                <Button onClick={() => window.location.href = '/sanctuaire'} className="w-full py-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                                    Accéder au Sanctuaire
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
