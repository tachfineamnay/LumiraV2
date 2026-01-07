'use client';

import { motion } from 'framer-motion';
import { Check, Sparkles, Crown, Star } from 'lucide-react';
import Link from 'next/link';
import type { Product } from '../../lib/products';

interface LevelCardProps {
    product: Product;
}

export function LevelCardPremium({ product }: LevelCardProps) {
    const { id, name, description, price, features, duration, badge, secondaryBadge, comingSoon, popular, free, ctaLabel, icons } = product;

    const [Icon1, Icon2] = icons;

    // Determine card variant
    const isPopular = popular;
    const isFree = free;
    const isComingSoon = comingSoon;

    // Card container styles
    const getCardClasses = () => {
        const baseClasses = 'group relative h-full flex flex-col items-center text-center p-8 rounded-[2rem] border transition-all duration-500 overflow-hidden';

        if (isComingSoon) {
            return `${baseClasses} bg-[#080812]/60 border-white/5 opacity-60 cursor-not-allowed`;
        }
        if (isPopular) {
            return `${baseClasses} bg-gradient-to-b from-[#1a0b2e] to-[#0A0510] border-cosmic-gold shadow-[0_0_40px_rgba(255,215,0,0.15)]`;
        }
        if (isFree) {
            return `${baseClasses} bg-[#080812] border-emerald-500/30 hover:border-emerald-400/50 hover:bg-[#0D0D1A]`;
        }
        return `${baseClasses} bg-[#080812] border-white/10 hover:border-white/20 hover:bg-[#0D0D1A]`;
    };

    // Button styles
    const getButtonClasses = () => {
        const baseClasses = 'w-full py-4 rounded-xl text-xs uppercase tracking-[0.2em] font-bold border transition-all duration-500 flex items-center justify-center gap-2 relative z-10 overflow-hidden';

        if (isComingSoon) {
            return `${baseClasses} bg-white/5 border-white/10 text-white/40 cursor-not-allowed`;
        }
        if (isPopular) {
            return `${baseClasses} bg-cosmic-gold text-[#0A0510] border-cosmic-gold hover:bg-white hover:border-white shadow-[0_0_20px_rgba(255,215,0,0.3)]`;
        }
        if (isFree) {
            return `${baseClasses} bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-400 hover:border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]`;
        }
        return `${baseClasses} bg-transparent border-white/20 text-white hover:bg-white/5 hover:border-white/30`;
    };

    // Card content wrapped in Link or div based on comingSoon state
    const CardContent = () => (
        <>
            {/* Popular Badge & Glow */}
            {isPopular && (
                <>
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-cosmic-gold to-transparent opacity-100" />
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <Crown className="w-24 h-24 text-cosmic-gold rotate-12" />
                    </div>
                    <div className="mb-4 px-4 py-1.5 bg-cosmic-gold text-cosmic-void text-[10px] font-bold uppercase tracking-[0.2em] rounded-full flex items-center gap-2">
                        <Star className="w-3 h-3 fill-current" />
                        {badge}
                        <Star className="w-3 h-3 fill-current" />
                    </div>
                    {secondaryBadge && (
                        <div className="mb-4 px-3 py-1 bg-cosmic-gold/10 text-cosmic-gold text-[9px] font-medium uppercase tracking-wider rounded-full border border-cosmic-gold/20">
                            {secondaryBadge}
                        </div>
                    )}
                </>
            )}

            {/* Free Badge */}
            {isFree && badge && (
                <div className="mb-4 px-4 py-1.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase tracking-[0.15em] rounded-full border border-emerald-500/20 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    {badge}
                </div>
            )}

            {/* Coming Soon Badge */}
            {isComingSoon && badge && (
                <div className="mb-4 px-4 py-1.5 bg-white/5 text-white/50 text-[10px] font-bold uppercase tracking-[0.15em] rounded-full border border-white/10">
                    {badge}
                </div>
            )}

            {/* Icon & Title */}
            <div className={`mb-6 relative z-10 ${!isPopular && !isFree && !isComingSoon ? 'mt-4' : ''}`}>
                <div className={`mx-auto w-12 h-12 flex items-center justify-center rounded-full mb-4 transition-colors duration-500 ${isPopular
                    ? 'text-cosmic-gold bg-cosmic-gold/10'
                    : isFree
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : isComingSoon
                            ? 'text-white/30 bg-white/5'
                            : 'text-white/40 bg-white/5 group-hover:text-white group-hover:bg-white/10'
                    }`}>
                    <Icon1 className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <h3 className={`font-playfair md:text-2xl text-xl mb-2 ${isComingSoon ? 'text-white/50' : 'text-white'}`}>
                    {name}
                </h3>
                <p className={`text-xs uppercase tracking-[0.15em] font-medium max-w-[200px] mx-auto ${isPopular
                    ? 'text-cosmic-gold/80'
                    : isFree
                        ? 'text-emerald-400/70'
                        : 'text-white/40'
                    }`}>
                    {description}
                </p>
            </div>

            {/* Price */}
            <div className="relative z-10 mb-6 w-full">
                <div className="flex items-baseline justify-center gap-2">
                    {isComingSoon ? (
                        <span className="text-3xl md:text-4xl font-light text-white/40 tracking-tight">
                            Bientôt
                        </span>
                    ) : price === 0 ? (
                        <span className="text-3xl md:text-4xl font-light text-emerald-400 tracking-tight">
                            Gratuit
                        </span>
                    ) : (
                        <span className={`text-4xl md:text-5xl font-light tracking-tight ${isPopular ? 'text-cosmic-gold' : 'text-white'}`}>
                            {price}€
                        </span>
                    )}
                </div>
                <p className={`text-[10px] uppercase tracking-widest mt-2 ${isComingSoon ? 'text-white/30' : 'text-white/40'}`}>
                    {duration}
                </p>
            </div>

            {/* Divider */}
            <div className={`w-12 h-px mb-6 ${isPopular
                ? 'bg-cosmic-gold/30'
                : isFree
                    ? 'bg-emerald-500/30'
                    : 'bg-white/10'
                }`} />

            {/* Features */}
            <ul className="space-y-3 mb-8 w-full text-left flex-grow relative z-10">
                {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 group/item">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 duration-300 ${isPopular
                            ? 'text-cosmic-gold'
                            : isFree
                                ? 'text-emerald-400'
                                : isComingSoon
                                    ? 'text-white/20'
                                    : 'text-white/30 group-hover/item:text-white'
                            }`} />
                        <span className={`text-sm font-light leading-relaxed duration-300 ${isPopular
                            ? 'text-white/90'
                            : isComingSoon
                                ? 'text-white/30'
                                : 'text-white/60 group-hover/item:text-white/80'
                            }`}>
                            {feature}
                        </span>
                    </li>
                ))}
            </ul>

            {/* Action Button */}
            <motion.button
                whileHover={!isComingSoon ? { scale: 1.02 } : undefined}
                whileTap={!isComingSoon ? { scale: 0.98 } : undefined}
                className={getButtonClasses()}
                disabled={isComingSoon}
            >
                <span className="relative z-10">{ctaLabel}</span>
                {(isPopular || isFree) && !isComingSoon && <Icon2 className="w-4 h-4 relative z-10" />}
            </motion.button>
        </>
    );

    // Wrap in Link if not coming soon
    if (isComingSoon) {
        return (
            <div className={getCardClasses()}>
                <CardContent />
            </div>
        );
    }

    return (
        <motion.div
            whileHover={{ y: -8 }}
            className={getCardClasses()}
        >
            <Link href={`/commande?product=${id}`} className="absolute inset-0 z-20" aria-label={`Choisir ${name}`} />
            <CardContent />
        </motion.div>
    );
}

// Re-export for backwards compatibility
export type { Product as Level };
