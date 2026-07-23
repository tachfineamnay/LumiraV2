'use client';

import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export function CheckoutHeader() {
  return (
    <header className="relative z-10 py-8 px-6">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 transition-colors mb-8 group"
          style={{ color: 'rgba(160,200,255,0.5)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(220,235,255,0.85)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(160,200,255,0.5)';
          }}
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm uppercase tracking-widest">Retour</span>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3"
        >
          <div className="relative">
            <Sparkles className="w-7 h-7" style={{ color: 'rgba(232,168,56,0.85)' }} />
            <div
              className="absolute inset-0 w-7 h-7 rounded-full blur-lg"
              style={{ background: 'rgba(232,168,56,0.2)' }}
            />
          </div>
          <h1
            className="text-3xl md:text-4xl font-playfair italic"
            style={{
              background: 'linear-gradient(135deg, #c8dcff 0%, #ffffff 45%, #d4e8ff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Finaliser votre commande
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-3 text-sm max-w-lg"
          style={{ color: 'rgba(160,200,255,0.55)' }}
        >
          Accédez à votre lecture spirituelle personnalisée et commencez votre voyage intérieur
        </motion.p>
      </div>
    </header>
  );
}
