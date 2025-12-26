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

      {/* 🏠 HERO SECTION */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20 overflow-hidden z-10">
        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="max-w-5xl"
        >
          {/* Social Proof Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cosmic-gold/10 border border-cosmic-gold/30 rounded-full mb-8 backdrop-blur-md"
          >
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-cosmic-void shadow-stellar" />
              ))}
            </div>
            <span className="text-cosmic-gold text-[10px] font-bold tracking-widest uppercase">
              +2,500 âmes éveillées
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-playfair italic text-cosmic-divine mb-6 text-glow-hero leading-tight">
              Oracle <span className="text-cosmic-gold">Lumira</span>
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-xl md:text-2xl text-cosmic-ethereal max-w-3xl mx-auto italic mb-10 leading-relaxed font-light"
            >
              "Naviguez à travers les lois invisibles de votre architecture spirituelle dès aujourd'hui."
            </motion.p>
          </motion.div>

          {/* CTA Group */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col items-center gap-8"
          >
            <Link href="#niveaux">
              <RoyalButton
                label="Commencer mon Voyage"
                className="px-12 py-6 text-xl shadow-aurora"
              />
            </Link>

            {/* Stats Bar */}
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 text-cosmic-ethereal mt-4">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-4 h-4 text-cosmic-gold fill-cosmic-gold" />)}
                </div>
                <div className="text-left">
                  <p className="text-cosmic-divine font-bold text-sm leading-none">4.9/5</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">500+ consultations</p>
                </div>
              </div>
              <div className="hidden sm:block w-px h-8 bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-cosmic-gold" />
                </div>
                <div className="text-left">
                  <p className="text-cosmic-divine font-bold text-sm leading-none">Livraison 24h</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-40">Analyse prioritaire</p>
                </div>
              </div>
            </div>

            {/* Ethical Urgency */}
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/5 border border-amber-400/20 rounded-full"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest">
                Portails actifs : 12 explorateurs connectés
              </span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-10 flex flex-col items-center gap-3"
        >
          <span className="text-cosmic-gold/30 text-[10px] uppercase tracking-[0.3em] font-bold">Descendre dans l'abysse</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-cosmic-gold/50"
          >
            <ArrowDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
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
