const sharedConfig = require('@packages/config/tailwind');

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...sharedConfig,
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ═══════════════════════════════════════════════════════════
        // SUBLIME CELESTIAL PALETTE - Inner Peace & Discovery
        // Inspired by: Milky Way + Dawn Horizon
        // ═══════════════════════════════════════════════════════════

        // Deep peaceful navy blues (from the night sky)
        abyss: {
          900: '#040610', // Absolute depth
          800: '#080C1A', // Deep void
          700: '#0C1225', // Primary background
          600: '#101830', // Elevated surfaces
          500: '#18223D', // Cards
          400: '#1E2A4A', // Hover states
        },

        // Serene teal/cyan (from milky way core)
        serenity: {
          700: '#0A2E3D', // Deep teal
          600: '#0F3D50', // Rich teal
          500: '#145266', // Mid teal
          400: '#1A6680', // Bright teal
          300: '#2D8AA0', // Light teal
          200: '#4BA8BE', // Soft cyan
        },

        // Warm amber/gold (from horizon glow)
        horizon: {
          600: '#B87333', // Deep amber
          500: '#D4943C', // Rich gold
          400: '#E8A838', // Primary gold
          300: '#F4B942', // Warm amber
          200: '#FFCC5C', // Light gold
          100: '#FFE4A0', // Soft glow
        },

        // Ethereal whites (from stars)
        stellar: {
          100: '#FFFFFF', // Pure white
          200: '#F8FAFC', // Off-white
          300: '#E2E8F0', // Light gray
          400: '#94A3B8', // Muted
          500: '#64748B', // Dimmed
          600: '#475569', // Subtle
        },

        // ═══════════════════════════════════════════════════════════
        // L'AUBE DU SANCTUAIRE — Dawn palette (scoped to /sanctuaire)
        // ═══════════════════════════════════════════════════════════

        // Bleu brume — depth opening to clarity
        brume: {
          800: '#0F1D38',
          700: '#152648',
          600: '#1C3058',
          500: '#253D6B',
          400: '#2F4D7E',
          300: '#3E6298',
          200: '#5B82B5',
        },

        // Ivoire d'aube — warm light halos
        ivoire: {
          500: '#D4C5A0',
          400: '#E8D8B8',
          300: '#F0E8D0',
          200: '#F8F2E4',
          100: '#FFFCF5',
        },

        // Rose d'aube — use very sparingly
        aurore: {
          500: '#A86888',
          400: '#C8889A',
          300: '#DCA0B0',
          200: '#EBBCC8',
          100: '#F5D8E0',
        },

        // Lavande — subtle elevation
        lavande: {
          500: '#7B68A8',
          400: '#9580C0',
          300: '#B0A0D4',
          200: '#C8B8E0',
          100: '#E0D8F0',
        },

        // Legacy compatibility aliases
        cosmic: {
          void: '#0C1225',
          deep: '#101830',
          nebula: '#0F3D50',
          galaxy: '#145266',
          stardust: '#1A6680',
          aurora: '#2D8AA0',
          celestial: '#4BA8BE',
          ethereal: '#E2E8F0',
          divine: '#F8FAFC',
          gold: '#E8A838',
          'gold-warm': '#F4B942',
          'gold-bright': '#FFCC5C',
          violet: '#8B5CF6',
          purple: '#A855F7',
          magenta: '#D946EF',
        },

        // Shorthand aliases for easy use
        void: '#0C1225',
        deep: '#101830',
        gold: '#E8A838',
        'gold-light': '#F4B942',
        divine: '#F8FAFC',
        ethereal: '#E2E8F0',
        mystic: '#8B5CF6',

        // Admin palette
        slate: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },

        // Desk admin light theme
        desk: {
          bg: '#f8fafc',
          surface: '#ffffff',
          card: '#f1f5f9',
          hover: '#e2e8f0',
          input: '#ffffff',
          border: '#e2e8f0',
          'border-subtle': '#f1f5f9',
          text: '#0f172a',
          muted: '#64748b',
          subtle: '#94a3b8',
          accent: '#f59e0b',
          success: '#10b981',
          danger: '#ef4444',
          info: '#3b82f6',
        },
      },
      fontFamily: {
        playfair: ['var(--font-playfair)', 'Georgia', 'Times New Roman', 'serif'],
        inter: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'Times New Roman', 'serif'],
      },
      backgroundImage: {
        // Sublime gradients
        'celestial-gradient':
          'linear-gradient(180deg, #040610 0%, #0C1225 20%, #0F3D50 60%, #145266 100%)',
        'gold-gradient': 'linear-gradient(135deg, #E8A838, #F4B942, #FFCC5C)',
        'horizon-glow': 'linear-gradient(180deg, transparent 0%, #E8A838 50%, #D4943C 100%)',
        'abyss-fade': 'linear-gradient(180deg, #040610 0%, #0C1225 50%, #101830 100%)',
        'aube-gradient':
          'linear-gradient(180deg, #050A18 0%, #0A1528 25%, #0F1A35 55%, #142242 100%)',
      },
      boxShadow: {
        'gold-glow': '0 0 40px rgba(232, 168, 56, 0.3)',
        'gold-soft': '0 0 60px rgba(232, 168, 56, 0.15)',
        'serenity-glow': '0 0 40px rgba(20, 82, 102, 0.4)',
        abyss: '0 20px 40px rgba(4, 6, 16, 0.6)',
        stellar: '0 8px 32px rgba(4, 6, 16, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        'ivoire-soft': '0 0 40px rgba(240, 232, 208, 0.08)',
        'aube-glow': '0 8px 32px rgba(5, 10, 24, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
      },
      animation: {
        'mandala-rotate': 'mandala-rotate 60s linear infinite',
        'mandala-pulse': 'mandala-pulse 4s ease-in-out infinite',
        'float-gentle': 'float-gentle 8s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 4s ease-in-out infinite',
        twinkle: 'twinkle 3s ease-in-out infinite',
        shimmer: 'shimmer 0.7s ease-in-out',
        breathe: 'breathe 6s ease-in-out infinite',
        'dawn-breathe': 'dawn-breathe 8s ease-in-out infinite',
        'light-reveal': 'light-reveal 0.8s ease-out forwards',
      },
      keyframes: {
        'mandala-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'mandala-pulse': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.02)' },
        },
        'float-gentle': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(232, 168, 56, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(232, 168, 56, 0.4)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'dawn-breathe': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
        'light-reveal': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
};
