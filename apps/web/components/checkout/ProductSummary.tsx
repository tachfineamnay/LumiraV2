'use client';

import { motion } from 'framer-motion';
import { Sparkles, Clock } from 'lucide-react';

interface Product {
    id: string;
    name: string;
    description: string;
    amountCents: number;
    level: string;
    features: string[];
    limitedOffer?: string | null;
}

interface ProductSummaryProps {
    product: Product;
}

const levelIcons: Record<string, string> = {
    'INITIE': '🪷',
    'MYSTIQUE': '✨',
    'PROFOND': '🌀',
    'INTEGRALE': '👑',
};

export function ProductSummary({ product }: ProductSummaryProps) {
    const isFree = product.amountCents === 0;
    const price = isFree ? 'GRATUIT' : `${(product.amountCents / 100).toFixed(0)}€`;
    const icon = levelIcons[product.level] || '✨';

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-gradient-to-br from-cosmic-gold/10 to-amber-500/5 backdrop-blur-xl border border-cosmic-gold/30 rounded-2xl p-6 shadow-stellar"
        >
            {/* Product Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">{icon}</span>
                    <div>
                        <p className="text-cosmic-stardust text-xs uppercase tracking-widest">Niveau {product.level}</p>
                        <h3 className="text-xl font-playfair italic text-cosmic-divine">{product.name}</h3>
                    </div>
                </div>
                <div className="text-right">
                    <p className={`text-2xl font-bold ${isFree ? 'text-emerald-400' : 'text-cosmic-gold'}`}>
                        {price}
                    </p>
                </div>
            </div>

            {/* Features */}
            <div className="border-t border-white/10 pt-4 mt-4">
                <ul className="space-y-2">
                    {product.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-cosmic-ethereal">
                            <Sparkles className="w-3 h-3 text-cosmic-gold flex-shrink-0" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Limited Offer Badge */}
            {product.limitedOffer && (
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mt-4 bg-amber-500/20 border border-amber-400/30 rounded-lg px-4 py-2 flex items-center gap-2"
                >
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300 text-xs font-medium">{product.limitedOffer}</span>
                </motion.div>
            )}
        </motion.div>
    );
}
