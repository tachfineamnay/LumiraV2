'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, Sparkles } from 'lucide-react';

function PaymentSuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const email = searchParams.get('email') || '';

    const [status, setStatus] = useState<'processing' | 'confirmed'>('processing');

    useEffect(() => {
        // Simulate payment confirmation delay (in reality, this would poll the backend)
        const timer = setTimeout(() => {
            setStatus('confirmed');
        }, 2500);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (status === 'confirmed') {
            // Generate a unique first visit token
            const firstVisitToken = `fv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            // Auto-redirect to sanctuaire after animation
            const redirectTimer = setTimeout(() => {
                router.push(`/sanctuaire?email=${encodeURIComponent(email)}&token=${firstVisitToken}`);
            }, 2000);

            return () => clearTimeout(redirectTimer);
        }
    }, [status, router, email]);


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
                            {/* Golden Spinner */}
                            <motion.div
                                className="relative w-24 h-24 mb-8"
                            >
                                {/* Outer ring */}
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                    className="absolute inset-0 border-4 border-transparent border-t-cosmic-gold border-r-cosmic-gold/50 rounded-full"
                                />
                                {/* Inner ring */}
                                <motion.div
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                    className="absolute inset-2 border-4 border-transparent border-b-amber-400 border-l-amber-400/50 rounded-full"
                                />
                                {/* Center glow */}
                                <div className="absolute inset-4 bg-cosmic-gold/20 rounded-full blur-md" />
                                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-cosmic-gold" />
                            </motion.div>

                            <h1 className="text-2xl md:text-3xl font-playfair italic text-cosmic-divine mb-4">
                                Préparation de votre Sanctuaire...
                            </h1>
                            <p className="text-cosmic-stardust text-sm max-w-md">
                                Nous finalisons votre accès. Cela ne prendra qu'un instant.
                            </p>
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
                            {/* Success Checkmark */}
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
                                {/* Glow effect */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0.5, 0.8, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl"
                                />
                                {/* Circle */}
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full shadow-[0_0_40px_rgba(52,211,153,0.4)]" />
                                {/* Checkmark */}
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
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#0A0514] via-[#1a0b2e] to-[#0A0514]">
                <Loader2 className="w-12 h-12 text-cosmic-gold animate-spin" />
            </div>
        }>
            <PaymentSuccessContent />
        </Suspense>
    );
}
