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
                "void-deep": "#05050D",
                gold: "#FFD700",
                "gold-light": "#FFC947",
                "gold-deep": "#B8860B",
                divine: "#F0E6FF",
                ethereal: "#D4C5E8",
                mystic: "#8B5CF6",
                slate: {
                    900: "#0f172a",
                    800: "#1e293b",
                },
                amber: {
                    400: "#fbbf24",
                }
            },
            fontFamily: {
                sans: ["var(--font-inter)", "sans-serif"],
                serif: ["var(--font-playfair)", "serif"],
            },
            backgroundImage: {
                "cosmic-gradient": "radial-gradient(circle at center, #1A1B3A 0%, #0B0B1A 100%)",
                "gold-gradient": "linear-gradient(135deg, #FFD700 0%, #FFC947 100%, #FFD700 100%)",
            },
            boxShadow: {
                "gold-glow": "0 0 40px rgba(255, 215, 0, 0.4)",
                "aurora": "0 0 50px rgba(139, 92, 246, 0.3)",
            },
            animation: {
                "mandala-rotate": "mandala-rotate 60s linear infinite",
                "mandala-pulse": "mandala-pulse 4s ease-in-out infinite",
                "float-gentle": "float-gentle 6s ease-in-out infinite",
                "glow-pulse": "glow-pulse 3s ease-in-out infinite",
                "twinkle": "twinkle 2s ease-in-out infinite",
                "shimmer": "shimmer 2s linear infinite",
            },
            keyframes: {
                "mandala-rotate": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                },
                "mandala-pulse": {
                    "0%, 100%": { scale: "1", opacity: "0.15" },
                    "50%": { scale: "1.05", opacity: "0.25" },
                },
                "float-gentle": {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-15px)" },
                },
                "glow-pulse": {
                    "0%, 100%": { boxShadow: "0 0 20px rgba(255, 215, 0, 0.2)" },
                    "50%": { boxShadow: "0 0 40px rgba(255, 215, 0, 0.6)" },
                },
                "twinkle": {
                    "0%, 100%": { opacity: "1", scale: "1" },
                    "50%": { opacity: "0.3", scale: "0.8" },
                },
                "shimmer": {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(100%)" },
                },
            }
        },
    },
};
