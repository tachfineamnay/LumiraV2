'use client'

import { motion } from 'framer-motion'
import { CheckCircle, ShieldCheck, Zap, HeartHandshake, ArrowRight } from 'lucide-react'

export function HowItWorks() {
    return (
        <section id="comment-ca-marche" className="py-32 relative overflow-hidden bg-void">
            <div className="max-w-[1400px] mx-auto px-6 md:px-12">

                {/* Editorial Header */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
                    <div>
                        <span className="text-white/40 text-[10px] uppercase tracking-[0.3em] font-bold block mb-4">Le Protocole</span>
                        <h2 className="font-playfair italic text-5xl md:text-7xl text-white">
                            L'Algorithme <br /><span className="text-cosmic-gold opacity-80">Sacré</span>
                        </h2>
                    </div>
                    <p className="text-white/50 max-w-sm text-sm leading-relaxed font-light">
                        Une méthodologie en trois étapes fusionnant l'analyse de données astrales et la prédiction quantique.
                    </p>
                </div>

                {/* Asymmetrical Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 h-auto md:h-[600px]">

                    {/* Main Step 01 - Large */}
                    <motion.div
                        className="md:col-span-7 bg-white/[0.03] border border-white/5 p-12 rounded-[2rem] relative overflow-hidden group hover:border-white/10 transition-colors duration-500 flex flex-col justify-end"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="absolute top-8 right-8 text-[120px] font-playfair leading-none text-white/[0.02] group-hover:text-white/[0.05] transition-colors duration-500 select-none">1</div>
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center mb-6 text-2xl">🎯</div>
                            <h3 className="text-3xl font-playfair italic text-white mb-4">Initialisation</h3>
                            <p className="text-white/60 text-lg font-light leading-relaxed max-w-md">
                                Sélectionnez votre niveau de profondeur. De l'initiation superficielle à l'immersion totale, définissez l'intensité de votre révélation.
                            </p>
                        </div>
                    </motion.div>

                    {/* Side Stack */}
                    <div className="md:col-span-5 flex flex-col gap-6 md:gap-8">

                        {/* Step 02 */}
                        <motion.div
                            className="flex-1 bg-white/[0.03] border border-white/5 p-10 rounded-[2rem] relative overflow-hidden group hover:border-white/10 transition-colors duration-500 flex flex-col justify-center"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.2 }}
                        >
                            <div className="absolute top-4 right-6 text-[80px] font-playfair leading-none text-white/[0.02] group-hover:text-white/[0.05] transition-colors duration-500 select-none">2</div>
                            <h3 className="text-2xl font-playfair italic text-white mb-2 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-sm">📝</span>
                                Transmission
                            </h3>
                            <p className="text-white/50 text-sm font-light">Partagez vos coordonnées astrales. Laissez l'oracle trianguler votre position vibratoire.</p>
                        </motion.div>

                        {/* Step 03 - Highlight */}
                        <motion.div
                            className="flex-1 bg-gradient-to-br from-cosmic-gold/[0.05] to-transparent border border-cosmic-gold/20 p-10 rounded-[2rem] relative overflow-hidden group hover:bg-cosmic-gold/[0.08] transition-colors duration-500 flex flex-col justify-center"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className="absolute top-4 right-6 text-[80px] font-playfair leading-none text-cosmic-gold/[0.05] group-hover:text-cosmic-gold/[0.1] transition-colors duration-500 select-none">3</div>
                            <h3 className="text-2xl font-playfair italic text-white mb-2 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full border border-cosmic-gold/30 flex items-center justify-center text-sm text-cosmic-gold">✨</span>
                                Révélation
                            </h3>
                            <p className="text-white/70 text-sm font-light">Réception sous 24h. PDF chiffré, Audio binaural 432Hz et Mandala unique.</p>
                            <ArrowRight className="absolute bottom-10 right-10 text-cosmic-gold opacity-50 w-6 h-6 -rotate-45" />
                        </motion.div>
                    </div>
                </div>

                {/* Minimalist Trust Footer */}
                <div className="mt-20 border-t border-white/5 pt-10 grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div className="flex items-center gap-3 text-white/40">
                        <ShieldCheck className="w-4 h-4" /> <span className="text-[10px] uppercase tracking-widest">Secured 256-bit</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/40">
                        <Zap className="w-4 h-4" /> <span className="text-[10px] uppercase tracking-widest">Instant Delivery</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/40">
                        <HeartHandshake className="w-4 h-4" /> <span className="text-[10px] uppercase tracking-widest">Satisfied or Refunded</span>
                    </div>
                    <div className="flex items-center gap-3 text-white/40">
                        <CheckCircle className="w-4 h-4" /> <span className="text-[10px] uppercase tracking-widest">Verified Alchemist</span>
                    </div>
                </div>
            </div>
        </section>
    )
}
