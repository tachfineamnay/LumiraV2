const sharedConfig = require("@packages/config/tailwind");

/** @type {import('tailwindcss').Config} */
module.exports = {
    ...sharedConfig,
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // ═══════════════════════════════════════════════════════════
                // CELESTIAL PALETTE - Inspired by Milky Way & Dawn
                // Evokes: Awakening, Hope, Self-Discovery
                // ═══════════════════════════════════════════════════════════
                cosmos: {
                    deep: "#0A1628",      // Deepest night sky
                    night: "#0D1B2A",     // Primary background
                    twilight: "#1B2838",  // Cards, surfaces
                    teal: "#1E4D5C",      // Accent gradient start
                    cyan: "#2D6A7A",      // Secondary accent
                    mist: "#3A5F6F",      // Hover states
                },
                dawn: {
                    gold: "#E8A838",      // Primary CTA, stars
                    amber: "#F4B942",     // Hover states
                    orange: "#FF6B35",    // Energy, warnings
                    peach: "#FFAA5C",     // Soft highlights
                    glow: "#FFD93D",      // Bright accents
                },
                star: {
                    white: "#F0F4F8",     // Primary text
                    silver: "#C9D1D9",    // Secondary text
                    dim: "#8B9BB4",       // Muted text
                    navy: "#4A6785",      // Subtle elements
                },
                // Legacy aliases (backward compat)
                cosmic: {
                    void: "#0D1B2A",
                    deep: "#1B2838",
                    nebula: "#1E4D5C",
                    galaxy: "#2D6A7A",
                    stardust: "#3A5F6F",
                    aurora: "#4A6785",
                    celestial: "#6B8CAE",
                    ethereal: "#C9D1D9",
                    divine: "#F0F4F8",
                    gold: "#E8A838",
                    "gold-warm": "#F4B942",
                    "gold-bright": "#FFD93D",
                    violet: "#8B5CF6",
                    purple: "#A855F7",
                    magenta: "#D946EF",
                },
                // Shorthand aliases
                void: "#0D1B2A",
                deep: "#1B2838",
                gold: "#E8A838",
                "gold-light": "#F4B942",
                divine: "#F0F4F8",
                ethereal: "#C9D1D9",
                mystic: "#8B5CF6",
                // Admin palette
                slate: {
                    900: "#0f172a",
                    800: "#1e293b",
                    700: "#334155",
                },
                amber: {
                    400: "#fbbf24",
                    500: "#f59e0b",
                    600: "#d97706",
                },
            },
            fontFamily: {
                playfair: ["var(--font-playfair)", "serif"],
                inter: ["var(--font-inter)", "sans-serif"],
                sans: ["var(--font-inter)", "sans-serif"],
                serif: ["var(--font-playfair)", "serif"],
            },
            backgroundImage: {
                "cosmic-gradient": "linear-gradient(135deg, #0A1628 0%, #0D1B2A 25%, #1B2838 50%, #1E4D5C 75%, #0D1B2A 100%)",
                "gold-gradient": "linear-gradient(135deg, #E8A838, #F4B942, #FFD93D)",
                "dawn-gradient": "linear-gradient(180deg, #0D1B2A 0%, #1E4D5C 50%, #E8A838 100%)",
                "milky-way": "radial-gradient(ellipse at 50% 0%, #2D6A7A 0%, #0D1B2A 50%, #0A1628 100%)",
            },
            boxShadow: {
                "gold-glow": "0 0 40px rgba(232, 168, 56, 0.4)",
                "dawn-glow": "0 0 60px rgba(244, 185, 66, 0.3)",
                cosmic: "0 20px 40px rgba(0, 0, 0, 0.3), 0 0 40px rgba(45, 106, 122, 0.2)",
                stellar: "0 0 60px rgba(232, 168, 56, 0.3), 0 20px 40px rgba(0, 0, 0, 0.3)",
                aurora: "0 0 80px rgba(168, 85, 247, 0.4), 0 20px 60px rgba(0, 0, 0, 0.4)",
                celestial: "0 8px 32px rgba(13, 27, 42, 0.6), inset 0 1px 0 rgba(240, 244, 248, 0.05)",
            },
            animation: {
                "mandala-rotate": "mandala-rotate 20s linear infinite",
                "mandala-pulse": "mandala-pulse 4s ease-in-out infinite",
                "float-gentle": "float-gentle 6s ease-in-out infinite",
                "glow-pulse": "glow-pulse 3s ease-in-out infinite",
                "twinkle": "twinkle 2s ease-in-out infinite",
                "shimmer": "shimmer 0.7s ease-in-out",
                "orbit": "orbit 20s linear infinite",
            },
            keyframes: {
                "mandala-rotate": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                },
                "mandala-pulse": {
                    "0%, 100%": { opacity: "0.3", transform: "scale(1)" },
                    "50%": { opacity: "0.6", transform: "scale(1.05)" },
                },
                "float-gentle": {
                    "0%, 100%": { transform: "translateY(0px)" },
                    "50%": { transform: "translateY(-15px)" },
                },
                "glow-pulse": {
                    "0%, 100%": { boxShadow: "0 0 20px rgba(232, 168, 56, 0.3)" },
                    "50%": { boxShadow: "0 0 40px rgba(232, 168, 56, 0.6)" },
                },
                "twinkle": {
                    "0%, 100%": { opacity: "0.3", transform: "scale(1)" },
                    "50%": { opacity: "1", transform: "scale(1.4)" },
                },
                "shimmer": {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(100%)" },
                },
                "orbit": {
                    "0%": { transform: "rotate(0deg) translateX(100px) rotate(0deg)" },
                    "100%": { transform: "rotate(360deg) translateX(100px) rotate(-360deg)" },
                },
            },
        },
    },
};
