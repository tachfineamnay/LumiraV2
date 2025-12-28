"use client";

import { motion } from "framer-motion";

export const Mandala = () => {
    return (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden pointer-events-none select-none">
            <motion.div
                animate={{
                    rotate: 360,
                }}
                transition={{
                    duration: 60,
                    repeat: Infinity,
                    ease: "linear",
                }}
                className="relative w-[800px] h-[800px] opacity-[0.15]"
            >
                <svg
                    viewBox="0 0 200 200"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full stroke-gold"
                >
                    {/* Sacred Geometry: Concentric circles and lines */}
                    <circle cx="100" cy="100" r="90" strokeWidth="0.5" />
                    <circle cx="100" cy="100" r="70" strokeWidth="0.3" />
                    <circle cx="100" cy="100" r="50" strokeWidth="0.2" />

                    <path d="M100 10V190" strokeWidth="0.2" />
                    <path d="M10 100H190" strokeWidth="0.2" />
                    <path d="M36.4 36.4L163.6 163.6" strokeWidth="0.2" />
                    <path d="M36.4 163.6L163.6 36.4" strokeWidth="0.2" />

                    {/* Hexagon pattern */}
                    <path
                        d="M100 30L160.6 65V135L100 170L39.4 135V65L100 30Z"
                        strokeWidth="0.4"
                    />

                    {/* Cardinale Spheres */}
                    <motion.circle
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        cx="100" cy="10" r="3" fill="#FFD700"
                    />
                    <motion.circle
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                        transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                        cx="190" cy="100" r="3" fill="#8B5CF6"
                    />
                    <motion.circle
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                        transition={{ duration: 4, repeat: Infinity, delay: 2 }}
                        cx="100" cy="190" r="3" fill="#FFFFFF"
                    />
                    <motion.circle
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                        transition={{ duration: 4, repeat: Infinity, delay: 3 }}
                        cx="10" cy="100" r="3" fill="#F0E6FF"
                    />

                    {/* Intricate petals */}
                    {[...Array(12)].map((_, i) => (
                        <ellipse
                            key={i}
                            cx="100"
                            cy="100"
                            rx="60"
                            ry="15"
                            transform={`rotate(${i * 30} 100 100)`}
                            strokeWidth="0.2"
                        />
                    ))}
                </svg>
            </motion.div>

            {/* Vitruvian Man Core (Static Center) - Artistic Integration */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2, delay: 0.5 }}
                className="absolute w-[400px] h-[400px] flex items-center justify-center pointer-events-none mix-blend-screen"
            >
                <svg
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full stroke-gold/50 drop-shadow-[0_0_10px_rgba(255,215,0,0.1)]"
                >
                    {/* Circle Container - Very subtle */}
                    <circle cx="50" cy="50" r="45" strokeWidth="0.1" className="opacity-20" />

                    {/* Square Container - Very subtle */}
                    <rect x="15" y="15" width="70" height="70" strokeWidth="0.1" className="opacity-20" />

                    {/* The Man - Artistic Single Pose */}
                    <g className="opacity-60">
                        {/* Head - continuous line style */}
                        <path d="M47 28 C47 26 48.5 24 50 24 C51.5 24 53 26 53 28 C53 30 51.5 32 50 32 C48.5 32 47 30 47 28" strokeWidth="0.3" />

                        {/* Torso & Spine - Fluid curve */}
                        <path d="M50 32 Q50 38 50 48 Q50 58 50 65" strokeWidth="0.3" />

                        {/* Arms - Single outcast gesture (welcoming/universal) */}
                        {/* Shoulders to Arms flow */}
                        <path d="M50 35 Q65 35 78 30" strokeWidth="0.2" />
                        <path d="M50 35 Q35 35 22 30" strokeWidth="0.2" />

                        {/* Legs - Standing grounded */}
                        <path d="M50 65 Q45 78 42 92" strokeWidth="0.2" />
                        <path d="M50 65 Q55 78 58 92" strokeWidth="0.2" />

                        {/* Geometric Construct Lines - The "Blueprint" look */}
                        <line x1="50" y1="24" x2="50" y2="92" strokeWidth="0.05" className="opacity-30" /> {/* Center axis */}
                        <line x1="22" y1="30" x2="78" y2="30" strokeWidth="0.05" className="opacity-30" /> {/* Arm axis */}
                        <circle cx="50" cy="48" r="25" strokeWidth="0.05" className="opacity-10" /> {/* Center energy field */}
                    </g>
                </svg>
            </motion.div>
        </div>
    );
};
