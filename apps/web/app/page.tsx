"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Mandala } from "../components/ui/Mandala";
import { RoyalButton } from "../components/ui/RoyalButton";
import { useRef } from "react";
import { Star, Sparkles, Clock, ArrowDown, ChevronDown } from "lucide-react";
import { Header } from "../components/landing/Header";
import { Footer } from "../components/landing/Footer";
import { LevelCardPremium, Level } from "../components/landing/LevelCardPremium";
import { TestimonialsCarousel } from "../components/landing/TestimonialsCarousel";
import { HowItWorks } from "../components/landing/HowItWorks";
import Link from "next/link";

export default function Home() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  const levels: Level[] = [
    {
      id: 1,
      name: "Éveil du Lotus",
      subtitle: "Initié",
      price: 111,
      originalPrice: 149,
      icon: "🪷",
      color: "blue",
      features: ["Cartographie vibratoire de base", "Analyse des centres d'énergie", "Protocole d'alignement audio", "Support email 7 jours"],
    },
    {
      id: 2,
      name: "Dimension Stellaire",
      subtitle: "Mystique",
      price: 222,
      originalPrice: 299,
      icon: "✨",
      color: "purple",
      popular: true,
      features: ["Cartographie complète HD", "Lecture fractale Alpha", "Soin quantique fréquentiel", "Mandala dynamique personnalisé", "Accès Espace Oral (1 mois)"],
    },
    {
      id: 3,
      name: "Vortex Ascensionnel",
      subtitle: "Profond",
      price: 444,
      originalPrice: 599,
      icon: "🌀",
      color: "amber",
      features: ["Tout le niveau II", "Projection temporelle 2026", "Session de guidance expert (1h)", "Séquence sonore 528Hz unique", "Support prioritaire 24/7"],
    },
    {
      id: 4,
      name: "Oracle Absolu",
      subtitle: "Intégral",
      price: 888,
      originalPrice: 1111,
      icon: "👑",
      color: "emerald",
      features: ["Immersion totale & Archivage", "Consultation illimitée (1 an)", "Réajustement mensuel", "L'Arche Lumira (Espace Privé)", "Accès VIP événements"],
    },
  ];

  return (
    <main ref={containerRef} className="relative bg-cosmic-void min-h-screen overflow-x-hidden starfield">
      <Header />

      {/* 🌌 THE COSMIC PORTAL (Mandala Background) */}
      <div className="fixed inset-0 flex items-center justify-center z-0 pointer-events-none">
        <Mandala />
      </div>

      <section className="relative min-h-[110vh] flex flex-col items-center justify-center text-center px-4 pt-32 pb-20 overflow-hidden z-10 selection:bg-cosmic-gold/20">

        {/* Subtle noise overlay specifically for Hero focus */}
        <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay"></div>

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative max-w-[1600px] mx-auto w-full flex flex-col items-center"
        >
          {/* Social Proof - Stark & Clean */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mb-12 flex items-center gap-4"
          >
            <div className="flex -space-x-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/20 backdrop-blur-md" /> // Abstract avatars
              ))}
            </div>
            <p className="text-cosmic-ethereal/60 text-xs tracking-[0.2em] uppercase font-medium">
              Join 2,500+ Awakened Souls
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50, filter: 'blur(20px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <h1 className="text-[12vw] leading-[0.85] font-playfair italic text-white mix-blend-overlay opacity-90 tracking-tighter">
              Oracle
            </h1>
            <h1 className="text-[12vw] leading-[0.85] font-playfair italic text-transparent bg-clip-text bg-gradient-to-b from-cosmic-gold to-white/20 tracking-tighter -mt-2 md:-mt-6">
              Lumira
            </h1>

            {/* Supporting Text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="mt-12 text-lg md:text-xl text-cosmic-ethereal/70 max-w-lg mx-auto font-light leading-relaxed tracking-wide"
            >
              Cartographie vibratoire & Algorithmes sacrés. <br />
              <span className="text-white/40 text-sm mt-2 block">L'architecture de votre âme, décodée.</span>
            </motion.p>
          </motion.div>

          {/* CTA Group - The Portal Entry */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="mt-16 flex flex-col items-center gap-6"
          >
            <Link href="#niveaux" className="group relative pointer-events-auto">
              <div className="absolute inset-0 bg-cosmic-gold/20 rounded-full blur-2xl opacity-0 group-hover:opacity-50 transition-opacity duration-700"></div>
              <div className="relative px-12 py-5 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl text-white tracking-[0.15em] text-sm uppercase font-bold group-hover:bg-white/[0.08] group-hover:border-cosmic-gold/50 transition-all duration-500 overflow-hidden">
                <span className="relative z-10">Ouvrir le Portail</span>
                <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-cosmic-gold to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              </div>
            </Link>

            {/* Micro Stats - Minimalist */}
            <div className="flex items-center gap-8 mt-8 opacity-50 hover:opacity-100 transition-opacity duration-500">
              <div className="flex flex-col items-center">
                <span className="text-white font-playfair text-xl italic">4.9</span>
                <span className="text-[10px] text-white/40 uppercase tracking-widest">Note Moyenne</span>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="flex flex-col items-center">
                <span className="text-white font-playfair text-xl italic">24h</span>
                <span className="text-[10px] text-white/40 uppercase tracking-widest">Délai Analyse</span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator - Floating Line */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 100 }}
          transition={{ delay: 2, duration: 1.5 }}
          className="absolute bottom-0 left-1/2 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"
        />
      </section>

      {/* 🧩 HOW IT WORKS */}
      <HowItWorks />

      {/* 🏛️ LEVEL CARDS (Pricing) */}
      <section id="niveaux" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-cosmic-gold text-xs font-bold tracking-widest uppercase">
              Choisissez votre Profondeur
            </span>
            <h2 className="font-playfair italic text-4xl md:text-5xl lg:text-6xl text-cosmic-divine mt-4 mb-6">
              Vecteurs de Transformation
            </h2>
            <p className="text-cosmic-ethereal max-w-2xl mx-auto text-lg leading-relaxed font-light">
              Du simple éveil à l'immersion absolue, trouvez la clé qui ouvrira les portes de votre architecture vibratoire.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {levels.map((level, i) => (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <LevelCardPremium level={level} />
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-16">
            <button className="text-cosmic-gold/60 hover:text-cosmic-gold transition-colors flex items-center gap-2 mx-auto uppercase text-xs font-bold tracking-widest group">
              <span>Voir le comparatif détaillé</span>
              <ChevronDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* 🌟 TESTIMONIALS CAROUSEL */}
      <TestimonialsCarousel />

      <Footer />
    </main>
  );
}
