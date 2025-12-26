'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react'

const TESTIMONIALS = [
    {
        id: 1,
        name: 'Sophie M.',
        level: 'Mystique',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&h=200&auto=format&fit=crop',
        rating: 5,
        text: "Une révélation ! L'Oracle Lumira a mis des mots sur ce que je ressentais depuis des années. La lecture était d'une précision troublante et d'une grande poésie.",
        date: 'Il y a 3 jours',
    },
    {
        id: 2,
        name: 'Jean-Pierre D.',
        level: 'Intégral',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop',
        rating: 5,
        text: "L'accompagnement avec l'expert Lumira a transformé ma vision de ma carrière. La Synthèse Alpha est un document que je relis chaque semaine.",
        date: 'Il y a 1 semaine',
    },
    {
        id: 3,
        name: 'Élodie L.',
        level: 'Initié',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&h=200&auto=format&fit=crop',
        rating: 5,
        text: "Le format audio est magique. Je l'écoute avant de dormir et je me sens beaucoup plus alignée le lendemain. Un investissement pour soi-même.",
        date: 'Il y a 2 jours',
    },
]

export function TestimonialsCarousel() {
    const [current, setCurrent] = useState(0)
    const [direction, setDirection] = useState(0)

    // Auto-play
    useEffect(() => {
        const timer = setInterval(() => {
            setDirection(1)
            setCurrent(prev => (prev + 1) % TESTIMONIALS.length)
        }, 8000)
        return () => clearInterval(timer)
    }, [])

    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 300 : -300,
            opacity: 0,
            scale: 0.9,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 300 : -300,
            opacity: 0,
            scale: 0.9,
        }),
    }

    const navigate = (newDirection: number) => {
        setDirection(newDirection)
        setCurrent(prev => (prev + newDirection + TESTIMONIALS.length) % TESTIMONIALS.length)
    }

    return (
        <section id="temoignages" className="py-24 relative overflow-hidden">
            {/* Background Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cosmic-gold/5 to-transparent pointer-events-none" />

            <div className="max-w-6xl mx-auto px-6 relative">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                >
                    <span className="text-cosmic-gold text-xs font-bold tracking-widest uppercase">
                        Ce qu'ils disent de l'Oracle
                    </span>
                    <h2 className="font-playfair italic text-4xl md:text-5xl text-cosmic-divine mt-4">
                        Témoignages Stellaires
                    </h2>

                    {/* Rating Summary */}
                    <div className="flex items-center justify-center gap-3 mt-8">
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Star key={i} className="w-5 h-5 text-cosmic-gold fill-cosmic-gold shadow-stellar" />
                            ))}
                        </div>
                        <div className="h-6 w-px bg-white/20" />
                        <div className="text-left">
                            <p className="text-cosmic-divine font-bold leading-none">4.9 / 5</p>
                            <p className="text-cosmic-ethereal text-[10px] uppercase font-bold tracking-widest opacity-60">
                                Sur la base de 500+ consultations
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Carousel Container */}
                <div className="relative min-h-[400px] flex items-center justify-center">

                    {/* Main Card */}
                    <div className="relative w-full max-w-3xl h-full">
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={current}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{
                                    x: { type: "spring", stiffness: 300, damping: 30 },
                                    opacity: { duration: 0.4 },
                                    scale: { duration: 0.4 }
                                }}
                                className="glass-card p-10 md:p-16 relative overflow-hidden backdrop-blur-2xl border border-white/10"
                            >
                                {/* Background Decoration */}
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <Quote className="w-32 h-32 text-cosmic-gold" />
                                </div>

                                {/* Rating */}
                                <div className="flex gap-1 mb-8">
                                    {[...Array(TESTIMONIALS[current].rating)].map((_, i) => (
                                        <Star key={i} className="w-4 h-4 text-cosmic-gold fill-cosmic-gold" />
                                    ))}
                                </div>

                                {/* Text */}
                                <blockquote className="text-cosmic-divine text-xl md:text-2xl font-light leading-relaxed mb-12 italic font-playfair">
                                    "{TESTIMONIALS[current].text}"
                                </blockquote>

                                {/* Author Info */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-full border-2 border-cosmic-gold/30 p-1 flex-shrink-0">
                                            <img
                                                src={TESTIMONIALS[current].avatar}
                                                alt={TESTIMONIALS[current].name}
                                                className="w-full h-full rounded-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                                            />
                                        </div>
                                        <div>
                                            <p className="text-cosmic-divine font-bold text-lg">
                                                {TESTIMONIALS[current].name}
                                            </p>
                                            <p className="text-cosmic-gold text-xs font-bold uppercase tracking-widest">
                                                Niveau {TESTIMONIALS[current].level}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <p className="text-cosmic-stardust text-[10px] font-bold uppercase tracking-widest opacity-50">
                                            Vérifié
                                        </p>
                                        <p className="text-cosmic-ethereal/40 text-xs">
                                            {TESTIMONIALS[current].date}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Navigation Arrows */}
                    <div className="absolute inset-0 flex items-center justify-between pointer-events-none z-20">
                        <button
                            onClick={() => navigate(-1)}
                            className="pointer-events-auto p-4 rounded-full bg-white/5 border border-white/10 hover:bg-cosmic-gold/20 hover:border-cosmic-gold/50 transition-all group scale-75 md:scale-100 -translate-x-2 md:-translate-x-12"
                        >
                            <ChevronLeft className="w-6 h-6 text-cosmic-gold group-hover:-translate-x-0.5 transition-transform" />
                        </button>
                        <button
                            onClick={() => navigate(1)}
                            className="pointer-events-auto p-4 rounded-full bg-white/5 border border-white/10 hover:bg-cosmic-gold/20 hover:border-cosmic-gold/50 transition-all group scale-75 md:scale-100 translate-x-2 md:translate-x-12"
                        >
                            <ChevronRight className="w-6 h-6 text-cosmic-gold group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* Indicators */}
                <div className="flex justify-center gap-3 mt-12">
                    {TESTIMONIALS.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setDirection(i > current ? 1 : -1)
                                setCurrent(i)
                            }}
                            className={`h-1 rounded-full transition-all duration-500 ${i === current
                                    ? 'w-12 bg-cosmic-gold'
                                    : 'w-4 bg-white/10 hover:bg-white/30'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}
