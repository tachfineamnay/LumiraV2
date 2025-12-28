'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react'

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

                    {/* Right: Thinking Woman Figure */}
                    <div className="hidden lg:flex relative h-full min-h-[500px] items-center justify-center">
                        {/* Background glow */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent rounded-full blur-[100px] opacity-20 animate-pulse"></div>

                        {/* Thinking Woman SVG */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.5, delay: 0.3 }}
                            className="relative w-[300px] h-[400px] opacity-30"
                        >
                            <svg
                                viewBox="0 0 100 140"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="w-full h-full stroke-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                            >
                                {/* Base/Pedestal */}
                                <rect x="30" y="125" width="40" height="3" strokeWidth="0.3" className="opacity-40" />
                                <rect x="35" y="120" width="30" height="5" strokeWidth="0.3" className="opacity-40" />

                                {/* Sitting pose - body mass */}
                                <ellipse cx="50" cy="110" rx="18" ry="12" strokeWidth="0.5" className="opacity-60" />

                                {/* Legs - folded position */}
                                {/* Left leg */}
                                <path d="M38 110 L35 120" strokeWidth="0.6" strokeLinecap="round" />
                                <path d="M35 120 L32 125" strokeWidth="0.6" strokeLinecap="round" />

                                {/* Right leg */}
                                <path d="M62 110 L65 120" strokeWidth="0.6" strokeLinecap="round" />
                                <path d="M65 120 L68 125" strokeWidth="0.6" strokeLinecap="round" />

                                {/* Torso - curved, leaning forward */}
                                <path d="M50 110 Q48 95 50 75" strokeWidth="0.7" strokeLinecap="round" />

                                {/* Right arm - supporting elbow on knee */}
                                <path d="M55 85 L62 95" strokeWidth="0.6" strokeLinecap="round" />
                                <path d="M62 95 L65 105" strokeWidth="0.5" strokeLinecap="round" />

                                {/* Left arm - hand to face (thinking pose) */}
                                <path d="M45 80 L38 75" strokeWidth="0.6" strokeLinecap="round" />
                                <path d="M38 75 L35 65" strokeWidth="0.6" strokeLinecap="round" />
                                <path d="M35 65 L42 58" strokeWidth="0.5" strokeLinecap="round" />

                                {/* Head - tilted down in contemplation */}
                                <circle cx="48" cy="55" r="8" strokeWidth="0.6" />

                                {/* Hair flow - feminine touch */}
                                <path d="M40 52 Q35 50 38 45" strokeWidth="0.3" className="opacity-70" />
                                <path d="M42 50 Q37 48 39 43" strokeWidth="0.3" className="opacity-70" />
                                <path d="M54 52 Q58 50 56 46" strokeWidth="0.3" className="opacity-70" />

                                {/* Shoulders */}
                                <path d="M44 75 L56 75" strokeWidth="0.4" strokeLinecap="round" className="opacity-80" />

                                {/* Energy points - subtle chakra hints */}
                                <motion.circle
                                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                                    transition={{ duration: 3, repeat: Infinity, delay: 0 }}
                                    cx="48" cy="55" r="0.8" fill="#FFFFFF"
                                /> {/* Third eye - thinking */}
                                <motion.circle
                                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                                    transition={{ duration: 3, repeat: Infinity, delay: 1 }}
                                    cx="50" cy="85" r="0.6" fill="#FFFFFF"
                                /> {/* Heart */}

                                {/* Geometric container - subtle frame */}
                                <circle cx="50" cy="80" r="55" strokeWidth="0.2" className="opacity-20" strokeDasharray="2,4" />
                            </svg>
                        </motion.div>
                    </div>
                </div>
            </div>
        </section>
    )
}
