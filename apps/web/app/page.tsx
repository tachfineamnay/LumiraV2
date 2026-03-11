"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Mandala } from "../components/ui/Mandala";
import { useRef } from "react";
import { Crown, Sparkles, MessageCircle, BookOpen, Moon, Star, Check } from "lucide-react";
import { Header } from "../components/landing/Header";
import { Footer } from "../components/landing/Footer";
import { TestimonialsCarousel } from "../components/landing/TestimonialsCarousel";
import { HowItWorks } from "../components/landing/HowItWorks";
import { SUBSCRIPTION } from "../lib/products";
import Link from "next/link";

export default function Home() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  // Products are now imported from lib/products.ts

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
            <motion.h1
              initial={{ color: "#FFFFFF", textShadow: "0 0 0px rgba(255,215,0,0)" }}
              animate={{
                color: ["#FFFFFF", "#FFF8E1", "#FFD700"],
                textShadow: ["0 0 0px rgba(255,215,0,0)", "0 0 20px rgba(255,215,0,0.3)", "0 0 50px rgba(255,215,0,0.6)"]
              }}
              transition={{ duration: 5, ease: "easeInOut", delay: 0.5 }}
              className="text-[13vw] leading-[0.8] font-playfair italic mix-blend-overlay opacity-90 tracking-[-0.05em] select-none pointer-events-none"
            >
              Oracle
            </motion.h1>
            <motion.h1
              initial={{ backgroundImage: "linear-gradient(to bottom, #FFFFFF, #FFFFFF)" }}
              animate={{
                backgroundImage: "linear-gradient(to bottom, #FFD700, #FFFFFF)"
              }}
              transition={{ duration: 5, ease: "easeInOut", delay: 0.5 }}
              className="text-[13vw] leading-[0.8] font-playfair italic text-transparent bg-clip-text tracking-[-0.05em] -mt-2 md:-mt-6 select-none pointer-events-none"
            >
              Lumira
            </motion.h1>

            {/* Supporting Text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="mt-12 text-lg md:text-xl text-cosmic-ethereal/80 max-w-lg mx-auto font-light leading-relaxed tracking-wide"
            >
              Cartographie vibratoire & Algorithmes sacrés. <br />
              <span className="text-white/50 text-sm mt-3 block uppercase tracking-[0.2em]">L'architecture de votre âme, décodée.</span>
            </motion.p>
          </motion.div>

          {/* CTA Group - The Portal Entry */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="mt-20 flex flex-col items-center gap-6"
          >
            <Link href="#niveaux" className="group relative pointer-events-auto">
              <div className="absolute inset-0 bg-cosmic-gold/30 rounded-full blur-[50px] opacity-0 group-hover:opacity-70 transition-opacity duration-700 scale-150"></div>
              <div className="relative px-16 py-6 rounded-full border border-white/10 bg-white/[0.02] backdrop-blur-2xl text-white tracking-[0.25em] text-xs uppercase font-bold group-hover:bg-white/[0.08] group-hover:border-cosmic-gold/50 transition-all duration-500 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_30px_rgba(255,215,0,0.2)]">
                <span className="relative z-10 group-hover:text-cosmic-gold transition-colors duration-500">Ouvrir le Portail</span>
                <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-cosmic-gold to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500 opacity-50"></div>
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

      {/* 🏛️ SINGLE OFFER (Pricing) */}
      <section id="niveaux" className="py-24 relative z-10">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-cosmic-gold text-xs font-bold tracking-widest uppercase">
              Votre Parcours Spirituel
            </span>
            <h2 className="font-playfair italic text-4xl md:text-5xl lg:text-6xl text-cosmic-divine mt-4 mb-6">
              Tout est inclus. Sans exception.
            </h2>
            <p className="text-cosmic-ethereal max-w-2xl mx-auto text-lg leading-relaxed font-light">
              Un seul abonnement pour accéder à l'ensemble de votre voyage spirituel avec Oracle Lumira.
            </p>
          </motion.div>

          {/* Single Offer Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative group"
          >
            {/* Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-amber-500/20 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

            <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-abyss-600/80 via-abyss-700/90 to-abyss-600/80 backdrop-blur-xl p-8 md:p-12">
              {/* Badge */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-amber-500/10 border border-amber-500/30">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold tracking-widest uppercase text-amber-300">
                    {SUBSCRIPTION.name}
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="text-center mb-10">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-6xl md:text-7xl font-playfair italic text-white">{SUBSCRIPTION.price}€</span>
                  <span className="text-xl text-white/40">/mois</span>
                </div>
                <p className="mt-3 text-white/50 text-sm">
                  Annulation possible à tout moment · Sans engagement
                </p>
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto mb-10">
                {SUBSCRIPTION.features.map((feature, i) => {
                  const icons = [BookOpen, MessageCircle, Moon, Star, Sparkles, Crown];
                  const Icon = icons[i % icons.length];
                  return (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      viewport={{ once: true }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-amber-400" />
                      </div>
                      <span className="text-sm text-white/80">{feature}</span>
                    </motion.div>
                  );
                })}
              </div>

              {/* CTA */}
              <div className="text-center">
                <Link
                  href="/commande"
                  className="group/btn relative inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-abyss-900 font-bold text-lg hover:from-amber-400 hover:to-amber-500 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(245,158,11,0.4)]"
                >
                  <Sparkles className="w-5 h-5" />
                  {SUBSCRIPTION.ctaLabel}
                </Link>

                <div className="flex items-center justify-center gap-4 mt-6 text-white/40 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400/60" />
                    <span>Accès immédiat</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400/60" />
                    <span>Paiement sécurisé</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400/60" />
                    <span>Sans engagement</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 🌟 TESTIMONIALS CAROUSEL */}
      <TestimonialsCarousel />

      <Footer />
    </main>
  );
}
