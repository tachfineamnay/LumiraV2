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
                void: "#0B0B1A",
                deep: "#1A1B3A",
                gold: "#FFD700",
                "warm-gold": "#FFC947",
                "aurora-violet": "#8B7BD8",
                divine: "#F0E6FF",
                ethereal: "#D4C5E8",
            },
            fontFamily: {
                sans: ["var(--font-inter)", "sans-serif"],
                serif: ["var(--font-playfair)", "serif"],
            },
            backgroundImage: {
                "cosmic-mesh": "radial-gradient(at 50% 50%, #1A1B3A 0%, #0B0B1A 100%)",
                "gold-gradient": "linear-gradient(135deg, #FFD700 0%, #FFC947 100%)",
            },
            boxShadow: {
                "gold-glow": "0 0 40px rgba(255, 215, 0, 0.4)",
            },
            animation: {
                "spin-slow": "spin 20s linear infinite",
                float: "float 6s ease-in-out infinite",
                pulse: "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                shimmer: "shimmer 2s linear infinite",
            },
            keyframes: {
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-20px)" },
                },
                shimmer: {
                    "0%": { backgroundPosition: "200% 0" },
                    "100%": { backgroundPosition: "-200% 0" },
                },
            }
        },
    },
};
