'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export function CheckoutHeader() {
    return (
        <header className="relative z-10 py-8 px-6">
            <div className="max-w-6xl mx-auto">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-stellar-400 hover:text-horizon-400 transition-colors mb-8 group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm uppercase tracking-widest">Retour</span>
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex items-center gap-3"
                >
                    <div className="relative">
                        <Sparkles className="w-7 h-7 text-horizon-400" />
                        <div className="absolute inset-0 w-7 h-7 bg-horizon-400/30 rounded-full blur-lg" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-playfair italic bg-gradient-to-r from-horizon-400 via-horizon-300 to-horizon-400 bg-clip-text text-transparent">
                        Finaliser votre commande
                    </h1>
                </motion.div>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-3 text-stellar-400 text-sm max-w-lg"
                >
                    Accédez à votre lecture spirituelle personnalisée et commencez votre voyage intérieur
                </motion.p>
            </div>
        </header>
    );
}
