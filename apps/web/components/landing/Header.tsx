'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navItems = [
    { name: 'Niveaux', href: '#niveaux' },
    { name: 'Manifesto', href: '#comment-ca-marche' },
    { name: 'Témoignages', href: '#temoignages' },
  ]

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 w-full z-50 transition-all duration-700 ${scrolled
          ? 'bg-void/80 backdrop-blur-md border-b border-white/5 py-4'
          : 'bg-transparent py-8'
        }`}
    >
      <nav className="max-w-[1400px] mx-auto px-6 md:px-12 flex items-center justify-between">

        {/* Logo Text Minimalist */}
        <Link href="/" className="group relative z-50">
          <span className="font-playfair italic text-xl md:text-2xl text-white tracking-tight group-hover:text-cosmic-gold transition-colors duration-500">
            Oracle Lumira
          </span>
        </Link>

        {/* Navigation Desktop - Centered & Clean */}
        <div className="hidden lg:flex items-center gap-12 absolute left-1/2 -translate-x-1/2">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="relative text-sm font-medium tracking-widest uppercase text-white/70 hover:text-white transition-colors group"
            >
              {item.name}
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-px bg-cosmic-gold group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </div>

        {/* CTAs Droite - Sophisticated */}
        <div className="flex items-center gap-8 relative z-50">
          <Link
            href="/sanctuaire"
            className="hidden sm:block text-sm font-medium text-white/90 hover:text-cosmic-gold transition-colors"
          >
            Connexion
          </Link>

          <Link
            href="#niveaux"
            className="hidden md:flex items-center justify-center px-6 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cosmic-gold/30 text-white text-xs uppercase tracking-widest font-bold transition-all duration-500 backdrop-blur-sm group"
          >
            <span className="group-hover:text-cosmic-gold transition-colors">Commencer</span>
          </Link>

          {/* Menu Mobile Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-white hover:text-cosmic-gold transition-colors"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Menu Mobile Overlay - Full Screen Cinematic */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void/98 backdrop-blur-3xl z-40 flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-8">
              {navItems.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 + i * 0.1 }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="font-playfair italic text-4xl text-white hover:text-cosmic-gold transition-colors"
                  >
                    {item.name}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8 flex flex-col gap-4 text-center"
              >
                <Link href="/sanctuaire" onClick={() => setMobileOpen(false)} className="text-white/60 text-sm uppercase tracking-widest">Connexion</Link>
                <Link href="#niveaux" onClick={() => setMobileOpen(false)} className="text-cosmic-gold text-sm uppercase tracking-widest border-b border-cosmic-gold/30 pb-1">Commencer l'expérience</Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

