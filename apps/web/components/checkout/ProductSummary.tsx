'use client';

import { motion } from 'framer-motion';
import { Clock, Star, CheckCircle2 } from 'lucide-react';

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

const levelGradients: Record<string, string> = {
    'INITIE': 'from-horizon-400/20 via-horizon-300/10 to-transparent',
    'MYSTIQUE': 'from-purple-500/20 via-purple-400/10 to-transparent',
    'PROFOND': 'from-serenity-400/20 via-serenity-300/10 to-transparent',
    'INTEGRALE': 'from-amber-500/20 via-amber-400/10 to-transparent',
};

export function ProductSummary({ product }: ProductSummaryProps) {
    const isFree = product.amountCents === 0;
    const price = isFree ? 'GRATUIT' : `${(product.amountCents / 100).toFixed(0)}€`;
    const icon = levelIcons[product.level] || '✨';
    const gradient = levelGradients[product.level] || levelGradients['INITIE'];

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="sticky top-8"
        >
            {/* Main Product Card */}
            <div className={`relative bg-gradient-to-br ${gradient} backdrop-blur-xl border border-horizon-400/30 rounded-2xl p-6 shadow-gold-soft overflow-hidden`}>
                {/* Decorative glow */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-horizon-400/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-serenity-400/10 rounded-full blur-2xl pointer-events-none" />
                
                {/* Badge "Populaire" for Initié */}
                {product.level === 'INITIE' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="absolute -top-1 -right-1 bg-gradient-to-r from-horizon-400 to-horizon-300 text-abyss-900 text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl flex items-center gap-1"
                    >
                        <Star className="w-3 h-3 fill-current" />
                        Populaire
                    </motion.div>
                )}

                {/* Product Header */}
                <div className="relative flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <motion.div 
                            className="text-4xl"
                            animate={{ 
                                scale: [1, 1.1, 1],
                                rotate: [0, 5, -5, 0]
                            }}
                            transition={{ 
                                duration: 4, 
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        >
                            {icon}
                        </motion.div>
                        <div>
                            <p className="text-stellar-400 text-xs uppercase tracking-[0.2em] mb-1">
                                Niveau {product.level}
                            </p>
                            <h3 className="text-2xl font-playfair italic text-stellar-100">
                                {product.name}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Price Section */}
                <div className="relative mb-6 pb-6 border-b border-white/10">
                    <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold ${isFree ? 'text-emerald-400' : 'text-horizon-400'}`}>
                            {price}
                        </span>
                        {!isFree && (
                            <span className="text-stellar-500 text-sm">paiement unique</span>
                        )}
                    </div>
                    {product.description && (
                        <p className="text-stellar-400 text-sm mt-2">{product.description}</p>
                    )}
                </div>

                {/* Features */}
                <div className="relative space-y-3">
                    <p className="text-stellar-400 text-xs uppercase tracking-widest mb-4">
                        Ce qui est inclus
                    </p>
                    <ul className="space-y-3">
                        {product.features.map((feature, idx) => (
                            <motion.li 
                                key={idx} 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + idx * 0.1 }}
                                className="flex items-start gap-3 text-sm text-stellar-200"
                            >
                                <CheckCircle2 className="w-4 h-4 text-horizon-400 flex-shrink-0 mt-0.5" />
                                <span>{feature}</span>
                            </motion.li>
                        ))}
                    </ul>
                </div>

                {/* Limited Offer Badge */}
                {product.limitedOffer && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="relative mt-6 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 rounded-xl px-4 py-3 flex items-center gap-3"
                    >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-400/20 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-amber-300 text-sm font-medium">{product.limitedOffer}</p>
                            <p className="text-amber-400/60 text-xs">Ne manquez pas cette opportunité</p>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Testimonial Mini */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-4 bg-abyss-600/50 backdrop-blur-sm border border-white/5 rounded-xl p-4"
            >
                <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-horizon-400 fill-horizon-400" />
                    ))}
                </div>
                <p className="text-stellar-300 text-sm italic">
                    &ldquo;Une expérience transformatrice. Les lectures m&apos;ont apporté une clarté que je n&apos;avais jamais connue.&rdquo;
                </p>
                <p className="text-stellar-500 text-xs mt-2">— Marie L., Paris</p>
            </motion.div>
        </motion.div>
    );
}
