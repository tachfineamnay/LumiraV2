'use client'

import { motion } from 'framer-motion'
import { Check, Star, ArrowRight } from 'lucide-react'

export interface Level {
    id: number
    name: string
    subtitle: string
    price: number
    originalPrice?: number
    features: string[]
    popular?: boolean
    color: 'blue' | 'purple' | 'amber' | 'emerald' // Kept for logic but style will be unified
    icon: string
}

interface LevelCardPremiumProps {
    level: Level
}

export function LevelCardPremium({ level }: LevelCardPremiumProps) {
    const romanNumerals = ['I', 'II', 'III', 'IV']

    return (
        <motion.div
            whileHover={{ y: -10 }}
            className={`group relative p-10 rounded-[2rem] bg-white/[0.02] backdrop-blur-2xl border border-white/5 transition-all duration-700 hover:bg-white/[0.04] hover:border-white/10 overflow-hidden h-full flex flex-col ${level.popular ? 'shadow-[0_0_50px_rgba(255,215,0,0.05)] ring-1 ring-cosmic-gold/20' : ''
                }`}
        >
            {/* Dynamic Glow on Hover */}
            <div className="absolute -inset-1 bg-gradient-to-br from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-xl" />

            {/* Top Section */}
            <div className="relative z-10 mb-10">
                <div className="flex justify-between items-start mb-6">
                    <span className="font-playfair italic text-white/20 text-4xl font-bold">{romanNumerals[level.id - 1]}</span>
                    {level.popular && (
                        <span className="px-3 py-1 bg-cosmic-gold/10 border border-cosmic-gold/20 text-cosmic-gold text-[10px] uppercase font-bold tracking-widest rounded-full">
                            Selected
                        </span>
                    )}
                </div>

                <h3 className="font-playfair text-3xl text-white mb-1">{level.name}</h3>
                <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-medium">{level.subtitle}</p>
            </div>

            {/* Price */}
            <div className="relative z-10 mb-10 pb-10 border-b border-white/5">
                <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-light text-white tracking-tight">{level.price}€</span>
                    {level.originalPrice && (
                        <span className="text-white/20 line-through text-lg">{level.originalPrice}</span>
                    )}
                </div>
                <p className="text-white/30 text-xs mt-2 font-light">Accès immédiat & à vie</p>
            </div>

            {/* Features */}
            <ul className="space-y-5 mb-12 flex-grow relative z-10">
                {level.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-4 group/item">
                        <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover/item:border-cosmic-gold/40 transition-colors">
                            <Check className="w-3 h-3 text-white/40 group-hover/item:text-cosmic-gold transition-colors" />
                        </div>
                        <span className="text-white/70 text-sm font-light leading-relaxed group-hover/item:text-white transition-colors">
                            {feature}
                        </span>
                    </li>
                ))}
            </ul>

            {/* Action */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-5 rounded-xl text-xs uppercase tracking-[0.2em] font-bold border transition-all duration-500 flex items-center justify-center gap-3 relative z-10 overflow-hidden ${level.popular
                        ? 'bg-cosmic-gold text-cosmic-void border-cosmic-gold hover:bg-cosmic-gold-warm'
                        : 'bg-transparent border-white/10 text-white hover:bg-white/5 hover:border-white/20'
                    }`}
            >
                <span>Sélectionner</span>
                <ArrowRight className="w-4 h-4 opacity-50" />
            </motion.button>
        </motion.div>
    )
}
