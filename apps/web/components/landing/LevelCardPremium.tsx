'use client'

import { motion } from 'framer-motion'
import { Check, Star, ArrowRight, Sparkles, Crown, Eye, Infinity } from 'lucide-react'

export interface Level {
    id: number
    name: string
    subtitle: string
    price: number
    originalPrice?: number
    features: string[]
    popular?: boolean
    color: 'blue' | 'purple' | 'amber' | 'emerald'
    icon: string
}

interface LevelCardPremiumProps {
    level: Level
}

export function LevelCardPremium({ level }: LevelCardPremiumProps) {
    // Map IDs to Lucide Icons for a more premium look than emojis
    const IconMap = [Star, Sparkles, Eye, Infinity]
    const LevelIcon = IconMap[level.id - 1] || Star

    const isPopular = level.popular

    return (
        <motion.div
            whileHover={{ y: -8 }}
            className={`group relative h-full flex flex-col items-center text-center p-8 rounded-[2rem] border transition-all duration-500 overflow-hidden ${isPopular
                ? 'bg-gradient-to-b from-[#1a0b2e] to-[#0A0510] border-cosmic-gold shadow-[0_0_40px_rgba(255,215,0,0.15)]'
                : 'bg-[#080812] border-white/10 hover:border-white/20 hover:bg-[#0D0D1A]'
                }`}
        >
            {/* Popular Badge & Glow */}
            {isPopular && (
                <>
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-cosmic-gold to-transparent opacity-100" />
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <Crown className="w-24 h-24 text-cosmic-gold rotate-12" />
                    </div>
                    <div className="mb-6 px-4 py-1.5 bg-cosmic-gold text-cosmic-void text-[10px] font-bold uppercase tracking-[0.2em] rounded-full flex items-center gap-2">
                        <Star className="w-3 h-3 fill-current" />
                        Le Plus Populaire
                        <Star className="w-3 h-3 fill-current" />
                    </div>
                </>
            )}

            {/* Icon & Title */}
            <div className={`mb-6 relative z-10 ${!isPopular ? 'mt-4' : ''}`}>
                <div className={`mx-auto w-12 h-12 flex items-center justify-center rounded-full mb-4 transition-colors duration-500 ${isPopular ? 'text-cosmic-gold bg-cosmic-gold/10' : 'text-white/40 bg-white/5 group-hover:text-white group-hover:bg-white/10'
                    }`}>
                    <LevelIcon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <h3 className="font-playfair md:text-2xl text-xl text-white mb-2">{level.name}</h3>
                <p className={`text-xs uppercase tracking-[0.15em] font-medium ${isPopular ? 'text-cosmic-gold/80' : 'text-white/40'}`}>
                    {level.subtitle}
                </p>
            </div>

            {/* Price */}
            <div className="relative z-10 mb-8 w-full">
                <div className="flex items-baseline justify-center gap-2">
                    <span className="text-4xl md:text-5xl font-light text-white tracking-tight">{level.price}€</span>
                    {level.originalPrice && (
                        <span className="text-white/20 line-through text-lg">{level.originalPrice}€</span>
                    )}
                </div>
                {level.originalPrice && (
                    <p className="text-emerald-400/60 text-[10px] uppercase tracking-widest mt-2">{Math.round((1 - level.price / level.originalPrice) * 100)}% de réduction</p>
                )}
            </div>

            {/* Divider */}
            <div className={`w-12 h-px mb-8 ${isPopular ? 'bg-cosmic-gold/30' : 'bg-white/10'}`} />

            {/* Features */}
            <ul className="space-y-4 mb-10 w-full text-left flex-grow relative z-10">
                {level.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 group/item">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 duration-300 ${isPopular ? 'text-cosmic-gold' : 'text-white/30 group-hover/item:text-white'}`} />
                        <span className={`text-sm font-light leading-relaxed duration-300 ${isPopular ? 'text-white/90' : 'text-white/60 group-hover/item:text-white/80'}`}>
                            {feature}
                        </span>
                    </li>
                ))}
            </ul>

            {/* Action Button */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-4 rounded-xl text-xs uppercase tracking-[0.2em] font-bold border transition-all duration-500 flex items-center justify-center gap-2 relative z-10 overflow-hidden group/btn ${isPopular
                    ? 'bg-cosmic-gold text-[#0A0510] border-cosmic-gold hover:bg-white hover:border-white shadow-[0_0_20px_rgba(255,215,0,0.3)]'
                    : 'bg-transparent border-white/10 text-white hover:bg-white/5 hover:border-white/20'
                    }`}
            >
                <span className="relative z-10">{isPopular ? 'Commencer l\'Ascension' : 'Découvrir'}</span>
                {isPopular && <Sparkles className="w-4 h-4 relative z-10" />}
            </motion.button>
        </motion.div>
    )
}
