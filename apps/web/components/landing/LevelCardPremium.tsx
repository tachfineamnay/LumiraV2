'use client'

import { motion } from 'framer-motion'
import { Check, Star } from 'lucide-react'

export interface Level {
    id: number
    name: string
    subtitle: string
    price: number
    originalPrice?: number
    features: string[]
    popular?: boolean
    color: 'blue' | 'purple' | 'amber' | 'emerald'
    icon: string // emoji
}

interface LevelCardPremiumProps {
    level: Level
}

const COLORS = {
    blue: {
        gradient: 'from-blue-500/20 via-blue-400/10 to-transparent',
        border: 'border-blue-400/40 group-hover:border-blue-400/80',
        glow: 'group-hover:shadow-[0_0_60px_rgba(59,130,246,0.3)]',
        text: 'text-blue-400',
        badge: 'bg-blue-400/20 text-blue-300',
    },
    purple: {
        gradient: 'from-purple-500/20 via-purple-400/10 to-transparent',
        border: 'border-purple-400/40 group-hover:border-purple-400/80',
        glow: 'group-hover:shadow-[0_0_60px_rgba(168,85,247,0.3)]',
        text: 'text-purple-400',
        badge: 'bg-purple-400/20 text-purple-300',
    },
    amber: {
        gradient: 'from-amber-500/20 via-amber-400/10 to-transparent',
        border: 'border-amber-400/40 group-hover:border-amber-400/80',
        glow: 'group-hover:shadow-[0_0_60px_rgba(251,191,36,0.3)]',
        text: 'text-amber-400',
        badge: 'bg-amber-400/20 text-amber-300',
    },
    emerald: {
        gradient: 'from-emerald-500/20 via-emerald-400/10 to-transparent',
        border: 'border-emerald-400/40 group-hover:border-emerald-400/80',
        glow: 'group-hover:shadow-[0_0_60px_rgba(52,211,153,0.3)]',
        text: 'text-emerald-400',
        badge: 'bg-emerald-400/20 text-emerald-300',
    },
}

export function LevelCardPremium({ level }: LevelCardPremiumProps) {
    const colors = COLORS[level.color]
    const romanNumerals = ['I', 'II', 'III', 'IV']

    return (
        <motion.div
            whileHover={{ y: -8, scale: 1.02 }}
            className={`group relative p-8 rounded-3xl bg-gradient-to-br ${colors.gradient} backdrop-blur-xl border-2 ${colors.border} ${colors.glow} transition-all duration-500 cursor-pointer overflow-hidden h-full flex flex-col`}
        >
            {/* Background Glow Effect */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-radial from-white/5 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Popular Badge */}
            {level.popular && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-6 py-1.5 bg-gradient-to-r from-cosmic-gold to-amber-500 text-cosmic-void text-xs font-black uppercase tracking-tighter rounded-full shadow-stellar z-10 whitespace-nowrap"
                >
                    ⭐ RECOMMANDÉ ⭐
                </motion.div>
            )}

            {/* Header */}
            <div className="text-center mb-8 relative z-10">
                {/* Level Number */}
                <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.8 }}
                    className={`w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br ${colors.gradient} border-2 ${colors.border} flex items-center justify-center`}
                >
                    <span className={`text-2xl font-playfair italic font-bold ${colors.text}`}>
                        {romanNumerals[level.id - 1]}
                    </span>
                </motion.div>

                {/* Icon */}
                <span className="text-4xl mb-2 block">{level.icon}</span>

                {/* Name */}
                <h3 className="font-playfair italic text-2xl text-cosmic-divine mb-1">
                    {level.name}
                </h3>
                <p className="text-cosmic-ethereal text-xs uppercase tracking-widest font-bold opacity-60">
                    {level.subtitle}
                </p>
            </div>

            {/* Price */}
            <div className="text-center mb-8 relative z-10">
                <div className="flex items-baseline justify-center gap-1">
                    {level.originalPrice && (
                        <span className="text-cosmic-stardust line-through text-sm opacity-50">
                            {level.originalPrice}€
                        </span>
                    )}
                    <span className={`text-5xl font-bold font-playfair ${colors.text}`}>
                        {level.price}
                    </span>
                    <span className={`text-xl font-medium ${colors.text}`}>€</span>
                </div>
            </div>

            {/* Features */}
            <ul className="space-y-4 mb-10 flex-grow relative z-10">
                {level.features.map((feature, i) => (
                    <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-3"
                    >
                        <Check className={`w-4 h-4 ${colors.text} flex-shrink-0 mt-0.5`} />
                        <span className="text-cosmic-ethereal text-sm leading-tight">{feature}</span>
                    </motion.li>
                ))}
            </ul>

            {/* CTA */}
            <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all duration-300 relative z-10 ${level.popular
                        ? 'bg-gradient-to-r from-cosmic-gold to-amber-500 text-cosmic-void shadow-stellar hover:shadow-aurora'
                        : `bg-white/5 border ${colors.border} text-cosmic-divine hover:bg-white/10 group-hover:border-cosmic-gold/50`
                    }`}
            >
                Choisir ce niveau
            </motion.button>

            {/* Guarantee */}
            <div className="text-center flex items-center justify-center gap-2 mt-4 opacity-40 text-[10px] text-cosmic-stardust uppercase tracking-widest font-bold">
                <span>🔒 Paiement Sécurisé</span>
                <span>•</span>
                <span>Satisfait ou Remboursé 14j</span>
            </div>
        </motion.div>
    )
}
