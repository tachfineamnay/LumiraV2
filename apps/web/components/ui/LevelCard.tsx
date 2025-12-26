"use client";

import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";

interface LevelCardProps {
    id: string; // Roman numeral
    title: string;
    price: string;
    features: string[];
    popular?: boolean;
    levelColor?: "blue" | "purple" | "amber" | "emerald";
    onSelect?: () => void;
}

const levelColors = {
    blue: {
        border: "border-blue-400/30",
        badge: "from-blue-400/30 to-blue-600/20",
        icon: "text-blue-400",
        number: "border-blue-400/50 from-blue-400/30 to-blue-600/20",
    },
    purple: {
        border: "border-purple-400/30",
        badge: "from-purple-400/30 to-purple-600/20",
        icon: "text-purple-400",
        number: "border-purple-400/50 from-purple-400/30 to-purple-600/20",
    },
    amber: {
        border: "border-amber-400/30",
        badge: "from-amber-400/30 to-amber-600/20",
        icon: "text-amber-400",
        number: "border-amber-400/50 from-amber-400/30 to-amber-600/20",
    },
    emerald: {
        border: "border-emerald-400/30",
        badge: "from-emerald-400/30 to-emerald-600/20",
        icon: "text-emerald-400",
        number: "border-emerald-400/50 from-emerald-400/30 to-emerald-600/20",
    },
};

export const LevelCard = ({
    id,
    title,
    price,
    features,
    popular = false,
    levelColor = "purple",
    onSelect,
}: LevelCardProps) => {
    const colors = levelColors[levelColor];

    return (
        <motion.div
            whileHover={{ scale: 1.02, boxShadow: "0 0 80px rgba(168, 85, 247, 0.4)" }}
            whileTap={{ scale: 0.98 }}
            onClick={onSelect}
            className={`relative p-8 rounded-2xl bg-gradient-to-br from-purple-400/10 to-blue-400/10 backdrop-blur-lg border ${popular ? "border-[#FFD700]/50" : colors.border} shadow-cosmic cursor-pointer transition-all duration-500 group`}
        >
            {/* Populaire Badge */}
            {popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#FFD700] to-[#FFC947] text-[#0B0B1A] px-5 py-2 rounded-full text-sm font-bold shadow-stellar z-20">
                    ⭐ Populaire ⭐
                </div>
            )}

            {/* Roman Numeral */}
            <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${colors.number} border-2 flex items-center justify-center mb-6 animate-glow-pulse`}>
                <span className="text-3xl font-playfair italic text-cosmic-gold font-bold">{id}</span>
            </div>

            {/* Title */}
            <h3 className="font-playfair italic text-2xl text-cosmic-divine mb-2 group-hover:text-cosmic-gold transition-colors duration-300">
                {title}
            </h3>

            {/* Price */}
            <span className="text-4xl font-bold text-cosmic-gold">{price}</span>

            {/* Features */}
            <ul className="mt-6 space-y-3">
                {features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-cosmic-ethereal">
                        <Check className={`w-4 h-4 ${colors.icon} shrink-0 mt-0.5`} />
                        {feature}
                    </li>
                ))}
            </ul>

            {/* CTA */}
            <button className="mt-8 w-full px-6 py-3 rounded-xl bg-gradient-to-r from-[#FFD700]/20 via-[#FFC947]/30 to-[#FFD700]/20 border border-[#FFD700]/50 text-cosmic-divine font-medium hover:from-[#FFD700]/30 hover:border-[#FFD700]/70 transition-all duration-500">
                Choisir ce niveau
            </button>
        </motion.div>
    );
};
