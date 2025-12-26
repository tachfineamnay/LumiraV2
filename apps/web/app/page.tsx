"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Mandala } from "../components/ui/Mandala";
import { RoyalButton } from "../components/ui/RoyalButton";
import { GlassCard } from "../components/ui/GlassCard";
import { useRef } from "react";
import { Star, Sparkles, Wand2, ArrowDown, Check, StarIcon } from "lucide-react";

export default function Home() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.9]);

  const dimensions = [
    {
      id: "I",
      title: "Éveil du Lotus",
      price: "111€",
      popular: false,
      features: ["Cartographie de base", "Alignement énergétique", "Support 7 jours"],
    },
    {
      id: "II",
      title: "Dimension Stellaire",
      price: "222€",
      popular: true,
      features: ["Cartographie complète", "Lecture fractale Alpha", "Soin quantique à distance", "Support 14 jours"],
    },
    {
      id: "III",
      title: "Vortex Ascensionnel",
      price: "444€",
      popular: false,
      features: ["Tout le niveau II", "Projection temporelle 2026", "Session de guidance 1h", "Accès prioritaire"],
    },
    {
      id: "IV",
      title: "Oracle Absolu",
      price: "888€",
      popular: false,
      features: ["Immersion totale", "Consultation illimitée", "Réajustement perpétuel", "L'Arche Lumira"],
    },
  ];

  return (
    <main ref={containerRef} className="relative bg-cosmic-void min-h-screen overflow-x-hidden starfield">

      {/* 🌌 THE COSMIC PORTAL (Mandala Background) */}
      <div className="fixed inset-0 flex items-center justify-center z-0 pointer-events-none">
        <Mandala />
      </div>

      {/* 🏠 HERO SECTION */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 z-10 pt-20">
        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="max-w-4xl"
        >
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-gold-light uppercase tracking-[0.5em] text-xs md:text-sm font-sans mb-8 block"
          >
            Explore les lois cachées de ton identité cosmique
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-playfair italic text-cosmic-divine mb-6 text-glow-hero"
          >
            Oracle <span className="text-cosmic-gold">Lumira</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="text-ethereal max-w-2xl mx-auto text-lg md:text-xl font-light leading-relaxed mb-12"
          >
            Une fusion entre algorithmes mystiques et résonances stellaires pour cartographier votre vibration originelle.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.8 }}
          >
            <RoyalButton
              label="Lancer mon exploration cosmique"
              icon={Sparkles}
              className="text-lg"
            />
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-12 flex flex-col items-center gap-3"
        >
          <span className="text-gold-light/40 text-[10px] uppercase tracking-widest">Découvrir les mystères</span>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-gold"
          >
            <ArrowDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </section>

      {/* 🏛️ THE GALLERY OF DIMENSIONS */}
      <section className="relative py-32 px-6 z-10 max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-5xl font-serif text-divine mb-4">La Galerie des Dimensions</h2>
          <div className="w-24 h-[1px] bg-gold/50 mx-auto" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {dimensions.map((dim, i) => (
            <motion.div
              key={dim.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              viewport={{ once: true }}
            >
              <GlassCard className="h-full flex flex-col relative">
                {dim.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gold-gradient text-void px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                    RECOMMANDÉ
                  </div>
                )}

                <div className="w-12 h-12 rounded-full border border-gold/30 flex items-center justify-center text-gold font-serif text-xl mb-6 mandala-pulse">
                  {dim.id}
                </div>

                <h3 className="text-2xl font-serif text-divine mb-2">{dim.title}</h3>
                <div className="text-3xl font-bold text-gold mb-8 drop-shadow-md">{dim.price}</div>

                <ul className="space-y-4 mb-10 flex-grow">
                  {dim.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-ethereal/80">
                      <Check className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <RoyalButton
                  label="Entrer dans cette dimension"
                  variant="secondary"
                  className="w-full"
                />
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 🌟 TESTIMONIALS */}
      <section className="relative py-24 px-6 z-10 bg-void/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center">
          <Sparkles className="w-12 h-12 text-gold/30 mx-auto mb-8" />
          <p className="text-2xl md:text-3xl font-serif italic text-ethereal leading-relaxed mb-12">
            "Une expérience qui transcende la lecture traditionnelle. Lumira a mis des mots sur des sensations que je portais depuis toujours."
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-gold/40 p-1">
              <div className="w-full h-full rounded-full bg-mystic/20" />
            </div>
            <div className="text-left">
              <div className="text-divine font-medium">Elena S.</div>
              <div className="flex text-gold">
                {[...Array(5)].map((_, i) => <StarIcon key={i} className="w-3 h-3 fill-current" />)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🌙 FOOTER */}
      <footer className="relative py-20 px-6 z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
          <div className="space-y-4">
            <h4 className="text-xl font-serif text-divine">Oracle Lumira</h4>
            <p className="text-ethereal/50 text-sm leading-relaxed">
              Votre portail vers l'architecture invisible de l'âme. <br />
              Codé avec intention, manifesté dans les étoiles.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-gold/50 text-xs uppercase tracking-widest font-sans mb-2">Navigation</span>
            <a href="#" className="text-ethereal/70 hover:text-gold transition-colors">Le Sanctuaire</a>
            <a href="#" className="text-ethereal/70 hover:text-gold transition-colors">L'Expert Desk</a>
            <a href="#" className="text-ethereal/70 hover:text-gold transition-colors">Politique de Confidentialité</a>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-gold/50 text-xs uppercase tracking-widest font-sans mb-2">Nous Contacter</span>
            <p className="text-ethereal/70">cosmos@lumira.oracle</p>
            <div className="flex justify-center md:justify-start gap-4 mt-2">
              <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:border-gold transition-colors cursor-pointer">
                <span className="text-xs">IG</span>
              </div>
              <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:border-gold transition-colors cursor-pointer">
                <span className="text-xs">TW</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-20 text-center text-ethereal/20 text-[10px] uppercase tracking-[0.5em]">
          Design System by Lumira Team 2025
        </div>
      </footer>
    </main>
  );
}
