'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { Mandala } from '../components/ui/Mandala';
import { useRef } from 'react';
import {
  Crown,
  Sparkles,
  MessageCircle,
  Star,
  Check,
  ShieldCheck,
  FileText,
  Headphones,
  Palette,
  Compass,
  PenLine,
  ChevronDown,
} from 'lucide-react';
import { Header } from '../components/landing/Header';
import { Footer } from '../components/landing/Footer';
import { TestimonialsCarousel } from '../components/landing/TestimonialsCarousel';
import { HowItWorks } from '../components/landing/HowItWorks';
import { WhatYouGet } from '../components/landing/WhatYouGet';
import { BeforeAfterSection } from '../components/landing/BeforeAfterSection';
import { FinalCTA } from '../components/landing/FinalCTA';
import { SUBSCRIPTION } from '../lib/products';
import Link from 'next/link';

export default function Home() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  return (
    <main
      ref={containerRef}
      className="relative bg-cosmic-void min-h-screen overflow-x-hidden starfield"
    >
      <Header />

      {/* 🌌 THE COSMIC PORTAL (Mandala Background) */}
      <div className="fixed inset-0 flex items-center justify-center z-0 pointer-events-none">
        <Mandala />
      </div>

      {/* ═══════════════════════════════════════
          HERO — L'ACCROCHE ÉMOTIONNELLE
      ═══════════════════════════════════════ */}
      <section className="relative min-h-[100svh] flex flex-col items-center justify-center text-center px-4 pt-24 md:pt-32 pb-16 md:pb-20 overflow-hidden z-10 selection:bg-cosmic-gold/20">
        {/* Subtle noise overlay for Hero focus */}
        <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none mix-blend-overlay" />

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative max-w-[1600px] mx-auto w-full flex flex-col items-center"
        >
          {/* Social Proof — en français */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mb-8 md:mb-12 flex items-center gap-3"
          >
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-white/10 to-white/5 border border-white/20 backdrop-blur-md"
                />
              ))}
            </div>
            <p className="text-cosmic-ethereal/60 text-[10px] md:text-xs tracking-[0.15em] md:tracking-[0.2em] uppercase font-medium">
              2 500+ âmes éveillées · 4.9/5
            </p>
          </motion.div>

          {/* Main Title */}
          <motion.div
            initial={{ opacity: 0, y: 50, filter: 'blur(20px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <motion.h1
              initial={{ color: '#FFFFFF', textShadow: '0 0 0px rgba(255,215,0,0)' }}
              animate={{
                color: ['#FFFFFF', '#FFF8E1', '#FFD700'],
                textShadow: [
                  '0 0 0px rgba(255,215,0,0)',
                  '0 0 20px rgba(255,215,0,0.3)',
                  '0 0 50px rgba(255,215,0,0.6)',
                ],
              }}
              transition={{ duration: 5, ease: 'easeInOut', delay: 0.5 }}
              className="text-[clamp(3rem,13vw,10rem)] leading-[0.85] font-playfair italic mix-blend-overlay opacity-90 tracking-[-0.05em] select-none pointer-events-none"
            >
              Oracle
            </motion.h1>
            <motion.h1
              initial={{ backgroundImage: 'linear-gradient(to bottom, #FFFFFF, #FFFFFF)' }}
              animate={{
                backgroundImage: 'linear-gradient(to bottom, #FFD700, #FFFFFF)',
              }}
              transition={{ duration: 5, ease: 'easeInOut', delay: 0.5 }}
              className="text-[clamp(3rem,13vw,10rem)] leading-[0.85] font-playfair italic text-transparent bg-clip-text tracking-[-0.05em] -mt-1 md:-mt-6 select-none pointer-events-none"
            >
              Lumira
            </motion.h1>

            {/* Tagline — message clair et vendeur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="mt-8 md:mt-12 max-w-xl mx-auto px-2"
            >
              <p className="text-base md:text-xl lg:text-2xl text-white/85 font-light leading-relaxed tracking-wide">
                Ce que les autres mettent des années à comprendre sur eux-mêmes —
              </p>
              <p className="text-base md:text-xl lg:text-2xl text-cosmic-gold/90 font-light leading-relaxed tracking-wide mt-2">
                Lumira vous le révèle en 24 heures.
              </p>
              <p className="text-white/40 text-[11px] md:text-sm mt-4 md:mt-5 uppercase tracking-[0.15em] md:tracking-[0.2em]">
                Analyse vibratoire · Intelligence IA · Expert humain
              </p>
            </motion.div>
          </motion.div>

          {/* CTA Group */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="mt-10 md:mt-16 flex flex-col items-center gap-4 md:gap-6 w-full px-4"
          >
            <Link
              href="#niveaux"
              className="group relative pointer-events-auto w-full max-w-xs md:max-w-none md:w-auto"
            >
              <div className="absolute inset-0 bg-cosmic-gold/30 rounded-full blur-[50px] opacity-0 group-hover:opacity-70 transition-opacity duration-700 scale-150" />
              <div className="relative px-8 md:px-16 py-4 md:py-6 rounded-full border border-white/10 bg-white/[0.02] backdrop-blur-2xl text-white tracking-[0.2em] md:tracking-[0.25em] text-xs uppercase font-bold group-hover:bg-white/[0.08] group-hover:border-cosmic-gold/50 transition-all duration-500 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_30px_rgba(255,215,0,0.2)] text-center w-full">
                <span className="relative z-10 group-hover:text-cosmic-gold transition-colors duration-500">
                  Découvrir ma lecture
                </span>
                <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-cosmic-gold to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500 opacity-50" />
              </div>
            </Link>

            {/* Micro Stats */}
            <div className="flex items-center gap-5 md:gap-8 mt-4 md:mt-6 opacity-50 hover:opacity-100 transition-opacity duration-500">
              <div className="flex flex-col items-center">
                <span className="text-white font-playfair text-lg md:text-xl italic">4.9</span>
                <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-widest">
                  Note
                </span>
              </div>
              <div className="w-px h-6 md:h-8 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-white font-playfair text-lg md:text-xl italic">24h</span>
                <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-widest">
                  Livraison
                </span>
              </div>
              <div className="w-px h-6 md:h-8 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-white font-playfair text-lg md:text-xl italic">29€</span>
                <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-widest">
                  accès à vie
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20"
        >
          <span className="text-[9px] uppercase tracking-[0.3em]">Découvrir</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
          PROOF OF CONCEPT — Ce que c'est vraiment
      ═══════════════════════════════════════ */}
      <section className="relative py-24 z-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-playfair italic text-3xl md:text-5xl text-white/80 leading-relaxed max-w-3xl mx-auto">
              "Lumira, c'est comme si quelqu'un avait lu en vous —
              <span className="text-amber-300/90"> et avait osé vous dire la vérité."</span>
            </h2>
            <div className="mt-8 flex items-center justify-center gap-4 text-white/30 text-xs uppercase tracking-widest">
              <div className="w-12 h-px bg-white/10" />
              <span>Retour de nos premiers utilisateurs</span>
              <div className="w-12 h-px bg-white/10" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          HOW IT WORKS — Process simplifié
      ═══════════════════════════════════════ */}
      <HowItWorks />

      {/* ═══════════════════════════════════════
          WHAT YOU GET — Les livrables en détail
      ═══════════════════════════════════════ */}
      <WhatYouGet />

      {/* ═══════════════════════════════════════
          PRICING — L'offre
      ═══════════════════════════════════════ */}
      <section id="niveaux" className="py-16 md:py-24 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-cosmic-gold text-xs font-bold tracking-widest uppercase">
              L'offre de lancement
            </span>
            <h2 className="font-playfair italic text-4xl md:text-5xl lg:text-6xl text-cosmic-divine mt-4 mb-6">
              Tout. Pour le prix d'un déjeuner.
            </h2>
            <p className="text-cosmic-ethereal max-w-2xl mx-auto text-lg leading-relaxed font-light">
              Nous aurions pu facturer chaque livrable séparément. Nous avons choisi l'accès complet
              à <span className="text-white/80 font-medium">29€ une seule fois</span> — parce que
              votre transformation ne devrait pas avoir de prix d'entrée prohibitif.
            </p>
          </motion.div>

          {/* Offer Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative group"
          >
            {/* Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-amber-500/20 rounded-3xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-700" />

            <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-abyss-600/80 via-abyss-700/90 to-abyss-600/80 backdrop-blur-xl">
              {/* Top: Price + CTA */}
              <div className="p-5 sm:p-8 md:p-12 pb-0 md:pb-0">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
                  <div>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-bold tracking-widest uppercase text-amber-300">
                        {SUBSCRIPTION.name}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl text-white/30 line-through font-light">97€</span>
                      <span className="text-5xl md:text-6xl font-playfair italic text-white">
                        {SUBSCRIPTION.price}€
                      </span>
                      <span className="text-lg text-white/40">paiement unique</span>
                    </div>
                    <p className="mt-2 text-white/50 text-sm">
                      Accès à vie · Aucun renouvellement · Offre de lancement
                    </p>
                  </div>
                  <div className="flex flex-col items-start md:items-end gap-3">
                    <Link
                      href="/commande"
                      className="group/btn relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-abyss-900 font-bold text-base hover:from-amber-400 hover:to-amber-500 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(245,158,11,0.4)]"
                    >
                      <Sparkles className="w-5 h-5" />
                      Commencer mon voyage — {SUBSCRIPTION.price}€
                    </Link>
                    <div className="flex items-center gap-1.5 text-emerald-400/70 text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{SUBSCRIPTION.guaranteeText}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-8 md:mx-12 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Feature Groups */}
              <div className="p-5 sm:p-8 md:p-12 pt-6 md:pt-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {SUBSCRIPTION.featureGroups.map((group, gi) => {
                    const groupIcons = [
                      [FileText, Headphones, Palette],
                      [MessageCircle, Compass, PenLine],
                    ];
                    return (
                      <div key={group.title}>
                        <h3 className="text-sm font-bold tracking-widest uppercase text-amber-400/80 mb-5 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-amber-500/10 flex items-center justify-center text-xs text-amber-400">
                            {gi + 1}
                          </span>
                          {group.title}
                        </h3>
                        <div className="space-y-4">
                          {group.items.map((item, i) => {
                            const Icon = groupIcons[gi]?.[i] || Star;
                            return (
                              <motion.div
                                key={item.label}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: gi * 0.1 + i * 0.08 }}
                                viewport={{ once: true }}
                                className="flex gap-3"
                              >
                                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <Icon className="w-4 h-4 text-amber-400/70" />
                                </div>
                                <div>
                                  <span className="text-sm font-medium text-white/90 block">
                                    {item.label}
                                  </span>
                                  <span className="text-xs text-white/45 leading-relaxed">
                                    {item.detail}
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Trust Bar */}
              <div className="mx-8 md:mx-12 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="p-4 md:p-6 md:px-12 flex flex-wrap items-center justify-center gap-x-4 md:gap-x-6 gap-y-2 text-white/40 text-xs">
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400/60" />
                  <span>Accès immédiat au sanctuaire</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400/60" />
                  <span>Paiement sécurisé Stripe</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400/60" />
                  <span>Lecture livrée sous 24h</span>
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400/60" />
                  <span>Révisée par un expert humain</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          BEFORE / AFTER — La transformation
      ═══════════════════════════════════════ */}
      <BeforeAfterSection />

      {/* ═══════════════════════════════════════
          TESTIMONIALS — Preuve sociale
      ═══════════════════════════════════════ */}
      <TestimonialsCarousel />

      {/* ═══════════════════════════════════════
          FINAL CTA — Le closing
      ═══════════════════════════════════════ */}
      <FinalCTA />

      <Footer />
    </main>
  );
}
