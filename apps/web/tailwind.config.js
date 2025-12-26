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
                cosmic: {
                    void: "#0B0B1A",
                    deep: "#1A1B3A",
                    nebula: "#2D2B5A",
                    galaxy: "#4A4B7A",
                    stardust: "#6B6B9A",
                    aurora: "#8B7BD8",
                    celestial: "#B19CD9",
                    ethereal: "#D4C5E8",
                    divine: "#F0E6FF",
                    gold: "#FFD700",
                    "gold-warm": "#FFC947",
                    "gold-bright": "#FFEB3B",
                    violet: "#8B5CF6",
                    purple: "#A855F7",
                    magenta: "#D946EF",
                },
                // Shorthand aliases
                void: "#0B0B1A",
                deep: "#1A1B3A",
                gold: "#FFD700",
                "gold-light": "#FFC947",
                divine: "#F0E6FF",
                ethereal: "#D4C5E8",
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
                "cosmic-gradient": "linear-gradient(135deg, #0B0B1A 0%, #1A1B3A 25%, #2D2B5A 50%, #4A4B7A 75%, #2D2B5A 100%)",
                "gold-gradient": "linear-gradient(to right, #FFD700, #FFC947, #FFD700)",
            },
            boxShadow: {
                "gold-glow": "0 0 40px rgba(255, 215, 0, 0.4)",
                cosmic: "0 20px 40px rgba(0, 0, 0, 0.3), 0 0 40px rgba(139, 123, 216, 0.2)",
                stellar: "0 0 60px rgba(255, 215, 0, 0.3), 0 20px 40px rgba(0, 0, 0, 0.3)",
                aurora: "0 0 80px rgba(168, 85, 247, 0.4), 0 20px 60px rgba(0, 0, 0, 0.4)",
            },
            animation: {
                "mandala-rotate": "mandala-rotate 20s linear infinite",
                "mandala-pulse": "mandala-pulse 4s ease-in-out infinite",
                "float-gentle": "float-gentle 6s ease-in-out infinite",
                "glow-pulse": "glow-pulse 3s ease-in-out infinite",
                "twinkle": "twinkle 2s ease-in-out infinite",
                "shimmer": "shimmer 0.7s ease-in-out",
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
                    "0%, 100%": { boxShadow: "0 0 20px rgba(255, 215, 0, 0.3)" },
                    "50%": { boxShadow: "0 0 40px rgba(255, 215, 0, 0.6)" },
                },
                "twinkle": {
                    "0%, 100%": { opacity: "0.3", transform: "scale(1)" },
                    "50%": { opacity: "1", transform: "scale(1.4)" },
                },
                "shimmer": {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(100%)" },
                },
            },
        },
    },
};
