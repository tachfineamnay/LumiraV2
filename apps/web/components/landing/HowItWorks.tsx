'use client'

import { motion } from 'framer-motion'
import { CheckCircle, ShieldCheck, Zap, HeartHandshake } from 'lucide-react'

export function HowItWorks() {
    const steps = [
        {
            step: '01',
            title: 'Sélectionnez votre profondeur',
            description: 'Choisissez parmi nos 4 niveaux de lecture celui qui résonne avec votre quête actuelle.',
            icon: '🎯',
        },
        {
            step: '02',
            title: 'Partagez vos vecteurs',
            description: 'Vos coordonnées astrales (date, heure, lieu) et vos questions guident notre algorithme sacré.',
            icon: '📝',
        },
        {
            step: '03',
            title: 'Recevez votre cartographie',
            description: 'Accédez à votre PDF, vos fréquences sonores et votre mandala unique sous 24 heures.',
            icon: '✨',
        },
    ]

    const guarantees = [
        { icon: <ShieldCheck className="w-5 h-5" />, label: 'Paiement 100% Sécurisé' },
        { icon: <Zap className="w-5 h-5" />, label: 'Livraison Express 24h' },
        { icon: <CheckCircle className="w-5 h-5" />, label: 'Satisfaction Garantie' },
        { icon: <HeartHandshake className="w-5 h-5" />, label: 'Support Éveillé 24/7' },
    ]

    return (
        <section id="comment-ca-marche" className="py-24 relative overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">

                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-20"
                >
                    <span className="text-cosmic-gold text-xs font-bold tracking-widest uppercase">
                        Le Voyage Initiatique
                    </span>
                    <h2 className="font-playfair italic text-4xl md:text-5xl text-cosmic-divine mt-4 mb-6">
                        Comment Ça Marche
                    </h2>
                    <div className="w-24 h-1 bg-gradient-to-r from-cosmic-gold to-transparent mx-auto" />
                </motion.div>

                {/* Steps Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {steps.map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.2 }}
                            whileHover={{ y: -8 }}
                            className="glass-card p-10 text-center group border border-white/5 hover:border-cosmic-gold/30 transition-all duration-500"
                        >
                            <div className="relative mb-10">
                                <span className="text-7xl block group-hover:scale-110 transition-transform duration-500">
                                    {item.icon}
                                </span>
                                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-4xl font-playfair italic font-black text-white/5 group-hover:text-cosmic-gold/10 transition-colors">
                                    {item.step}
                                </span>
                            </div>

                            <h3 className="font-playfair italic text-2xl text-cosmic-divine mt-4 mb-4">
                                {item.title}
                            </h3>
                            <p className="text-cosmic-ethereal leading-relaxed font-light opacity-80">
                                {item.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Trust Guarantees */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-20"
                >
                    {guarantees.map((item, i) => (
                        <div key={i} className="flex flex-col items-center gap-3 p-6 glass-card border border-white/5 bg-white/[0.02] text-center">
                            <div className="text-cosmic-gold">
                                {item.icon}
                            </div>
                            <span className="text-cosmic-ethereal text-[10px] uppercase font-bold tracking-widest">
                                {item.label}
                            </span>
                        </div>
                    ))}
                </motion.div>
            </div>

            {/* Background Decorative Element */}
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cosmic-gold/5 blur-[120px] rounded-full pointer-events-none" />
        </section>
    )
}
