'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export function CheckoutHeader() {
    return (
        <header className="relative z-10 py-8 px-6">
            <div className="max-w-4xl mx-auto">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-cosmic-stardust hover:text-cosmic-gold transition-colors mb-8 group"
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
                    <Sparkles className="w-6 h-6 text-cosmic-gold" />
                    <h1 className="text-3xl md:text-4xl font-playfair italic bg-gradient-to-r from-cosmic-gold via-amber-300 to-cosmic-gold bg-clip-text text-transparent">
                        Finaliser votre commande
                    </h1>
                </motion.div>
            </div>
        </header>
    );
}
