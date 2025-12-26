"use client";

import { motion } from "framer-motion";
import { Mandala } from "../components/ui/Mandala";
import { Button } from "../components/ui/Button";
import { GlassCard } from "../components/ui/GlassCard";

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-cosmic-mesh opacity-80" />
      <Mandala />

      {/* Stars Effect */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 mix-blend-overlay" />

      {/* Hero Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="flex flex-col items-center gap-8"
        >
          <div className="space-y-4">
            <motion.h1
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-6xl md:text-8xl font-serif italic text-transparent bg-clip-text bg-gradient-to-br from-divine via-white to-ethereal text-shadow-gold"
            >
              Oracle Lumira
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xl md:text-2xl text-gold font-light tracking-wide max-w-2xl mx-auto"
            >
              Révélez votre cartographie vibratoire et accédez à l'alliance sacrée de votre destinée.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="flex flex-col md:flex-row gap-6 mt-8"
          >
            <Button variant="gold" size="lg" className="min-w-[200px]">
              Découvrir mon Avenir
            </Button>
            <Button variant="secondary" size="lg" className="min-w-[200px]">
              Connexion Céleste
            </Button>
          </motion.div>
        </motion.div>

        {/* Feature Cards Preview */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24"
        >
          {['Guidance Astrale', 'Soins Énergétiques', 'Cercle Initiatique'].map((feature, i) => (
            <GlassCard key={i} hoverEffect className="flex flex-col items-center text-center gap-4 py-8">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20 text-gold text-2xl">
                ✦
              </div>
              <h3 className="text-lg font-serif text-divine">{feature}</h3>
              <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
            </GlassCard>
          ))}
        </motion.div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 text-ethereal/40 text-xs tracking-[0.2em]"
      >
        LUMIRA V2 • SYSTEME ORACLE • 2024
      </motion.footer>
    </main>
  );
}
