'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Quote } from 'lucide-react'

const TESTIMONIALS = [
    {
        id: 1,
        name: 'Sophie M.',
        title: 'Architecte d\'Intérieur',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&h=200&auto=format&fit=crop',
        rating: 5,
        text: "Une expérience d'une rare élégance. L'Oracle a su capter des fréquences de mon passé que je pensais oubliées. La justesse de l'analyse est troublante.",
        date: 'Initiée le 12 Dec',
    },
    {
        id: 2,
        name: 'Jean-Pierre D.',
        title: 'Dirigeant Tech',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop',
        rating: 5,
        text: "Au-delà du mysticisme, il y a une mathématique implacable dans ces lectures. Un outil de connaissance de soi d'une puissance redoutable.",
        date: 'Initié le 08 Dec',
    },
    {
        id: 3,
        name: 'Élodie L.',
        title: 'Artiste Sonore',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&h=200&auto=format&fit=crop',
        rating: 5,
        text: "Les fréquences binaurales fournies avec la lecture sont devenues mon rituel quotidien. Une qualité de production sonore digne des plus grands studios.",
        date: 'Initiée le 15 Dec',
    },
]

export function TestimonialsCarousel() {
    const [current, setCurrent] = useState(0)

    // Auto-play slow
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrent(prev => (prev + 1) % TESTIMONIALS.length)
        }, 10000)
        return () => clearInterval(timer)
    }, [])

    return (
        <section id="temoignages" className="py-40 relative bg-void overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 relative z-10">

                {/* Editorial Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

                    {/* Left: Text & Nav */}
                    <div className="relative">
                        <span className="text-white/20 text-[10px] uppercase tracking-[0.3em] font-bold block mb-12">Résonances</span>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={current}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.8 }}
                            >
                                <Quote className="w-12 h-12 text-cosmic-gold opacity-30 mb-8" />
                                <p className="font-playfair italic text-3xl md:text-5xl text-white leading-tight mb-12">
                                    "{TESTIMONIALS[current].text}"
                                </p>

                                <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 rounded-full overflow-hidden grayscale hover:grayscale-0 transition-all duration-700">
                                        <img src={TESTIMONIALS[current].avatar} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div>
                                        <div className="text-white font-playfair text-xl">{TESTIMONIALS[current].name}</div>
                                        <div className="text-white/40 text-xs uppercase tracking-widest mt-1">{TESTIMONIALS[current].title}</div>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        {/* Minimal Nav Dots */}
                        <div className="flex gap-4 mt-20">
                            {TESTIMONIALS.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrent(i)}
                                    className={`h-[2px] transition-all duration-500 ${current === i ? 'w-16 bg-white' : 'w-8 bg-white/10 hover:bg-white/30'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Right: Visual Abstract - Optional Decorative Element */}
                    <div className="hidden lg:block relative h-full min-h-[500px]">
                        <div className="absolute inset-0 bg-gradient-to-tr from-cosmic-gold/10 to-transparent rounded-full blur-[100px] opacity-20 animate-pulse delay-700"></div>
                        {/* This could be a 3D spline or another Mandala in the future */}
                    </div>
                </div>
            </div>
        </section>
    )
}
