"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Mandala } from "../components/ui/Mandala";
import { Button } from "../components/ui/Button";
import { GlassCard } from "../components/ui/GlassCard";
import { useRef } from "react";

export default function Home() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const yText = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacityText = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <main ref={ref} className="relative min-h-screen flex flex-col items-center overflow-x-hidden selection:bg-gold/20">

      {/* 🌌 THE PORTAL BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-cosmic-mesh opacity-60" />
        <Mandala />
        {/* Starfield Layer 1 (Static but twinkling) */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay" />
        {/* Vignette */}
        <div className="absolute inset-0 bg-radial-gradient-vignette opacity-80" />
      </div>

      {/* 🔮 HERO SECTION (THE ALTAR) */}
      <section className="relative w-full h-screen flex flex-col items-center justify-center text-center px-4 pt-20">

        <motion.div
          style={{ y: yText, opacity: opacityText }}
          className="flex flex-col items-center gap-12 max-w-5xl mx-auto z-10"
        >
          {/* SUPRA-TITLE */}
          <motion.span
            initial={{ opacity: 0, letterSpacing: "1em" }}
            animate={{ opacity: 1, letterSpacing: "0.5em" }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="text-gold/80 text-xs md:text-sm font-sans tracking-[0.5em] uppercase"
          >
            L'Architecture Sacrée de votre Âme
          </motion.span>

          {/* MASSIVE TITLE */}
          <motion.h1
            initial={{ scale: 0.8, opacity: 0, filter: "blur(10px)" }}
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.2, duration: 1.2, ease: "circOut" }}
            className="text-6xl md:text-9xl font-serif italic text-transparent bg-clip-text bg-gradient-to-b from-divine via-white to-ethereal/50 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]"
          >
            Oracle <br className="md:hidden" />
            <span className="text-liquid-gold font-normal">Lumira</span>
          </motion.h1>

          {/* SUBTITLE */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 1 }}
            className="text-lg md:text-xl text-ethereal/80 font-light max-w-xl leading-relaxed"
          >
            Une expérience <strong>"One-Shot"</strong>. Une lecture fractale unique de votre code originel, fusionnant sagesse ancestrale et technologie quantique.
          </motion.p>

          {/* CTA CLUSTER */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="flex flex-col md:flex-row gap-6 mt-8"
          >
            <Button variant="gold" size="lg" className="min-w-[240px] text-deep">
              Initier l'Exploration
            </Button>
            <Button variant="stardust" size="lg" className="min-w-[240px]">
              Découvrir le Protocole
            </Button>
          </motion.div>

        </motion.div>

        {/* SCROLL INDICATOR */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] text-ethereal/40">Scroll</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-gold/0 via-gold/50 to-gold/0" />
        </motion.div>

      </section>

      {/* 🧩 PREVIEW SECTION (THE ARTIFACTS) */}
      <section className="relative w-full py-32 px-4 z-10 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "Cartographie Vibratoire", icon: "✦", desc: "Décodage de votre signature énergétique unique." },
            { title: "Soins Quantiques", icon: "✧", desc: "Harmonisation des fréquences dissonantes." },
            { title: "Guidance 2026", icon: "✺", desc: "Projection temporelle et alignement de destinée." }
          ].map((item, i) => (
            <GlassCard key={i} hoverEffect className="group flex flex-col items-center text-center gap-6 py-12 border-white/5">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-gold text-3xl group-hover:scale-110 group-hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] transition-all duration-500">
                {item.icon}
              </div>
              <div className="space-y-2">
                <h3 className="text-xl md:text-2xl font-serif text-divine group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gold transition-all duration-300">
                  {item.title}
                </h3>
                <p className="text-sm text-ethereal/60 leading-relaxed max-w-[250px] mx-auto">
                  {item.desc}
                </p>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* 🌀 SANCTUARY PREVIEW (THE ORB) */}
      <section className="relative w-full py-24 z-10 flex flex-col items-center text-center">
        <h2 className="text-4xl md:text-5xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-gold via-warm-gold to-transparent mb-16 opacity-80">
          Le Sanctuaire
        </h2>

        {/* Abstract Orb Representation */}
        <div className="relative w-64 h-64 md:w-96 md:h-96">
          <div className="absolute inset-0 rounded-full border border-white/10 animate-[spin_30s_linear_infinite]" />
          <div className="absolute inset-4 rounded-full border border-white/5 animate-[spin_20s_linear_infinite_reverse]" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-aurora-violet/20 to-transparent blur-3xl animate-pulse" />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2 backdrop-blur-md p-6 rounded-full bg-black/20 border border-white/5">
              <span className="text-3xl">🔒</span>
              <p className="text-xs uppercase tracking-widest text-gold/80">Accès Réservé</p>
            </div>
          </div>

          {/* Satellite Icons */}
          {[0, 1, 2, 3].map((i) => (
            <div key={i}
              className="absolute w-12 h-12 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-center top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                transform: `rotate(${i * 90}deg) translateY(-140px) rotate(-${i * 90}deg)`
              }}
            >
              <div className="w-2 h-2 bg-gold/50 rounded-full shadow-[0_0_10px_gold]" />
            </div>
          ))}
        </div>
      </section>

      <footer className="w-full py-12 text-center relative z-10 border-t border-white/5">
        <p className="text-ethereal/30 text-[10px] uppercase tracking-[0.3em] font-sans">
          Orchestrated by Lumira • 2026 Edition
        </p>
      </footer>
    </main>
  );
}
