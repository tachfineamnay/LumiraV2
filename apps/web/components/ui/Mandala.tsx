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

            {/* Vitruvian Man Core (Static Center) */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2, delay: 0.5 }}
                className="absolute w-[400px] h-[400px] flex items-center justify-center opacity-40 pointer-events-none mix-blend-screen"
            >
                <svg
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full stroke-gold drop-shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                >
                    {/* Circle Container */}
                    <circle cx="50" cy="50" r="45" strokeWidth="0.3" className="opacity-50" />

                    {/* Square Container */}
                    <rect x="15" y="15" width="70" height="70" strokeWidth="0.3" className="opacity-50" />

                    {/* The Man - Abstract Geometric Lines */}

                    {/* Head */}
                    <circle cx="50" cy="28" r="6" strokeWidth="0.6" />

                    {/* Torso Line */}
                    <path d="M50 34 L50 70" strokeWidth="0.6" />

                    {/* Arms - Horizontal */}
                    <path d="M22 45 L78 45" strokeWidth="0.5" />

                    {/* Arms - Angled (Vitruvian variants) */}
                    <path d="M24 38 L76 38" strokeWidth="0.3" opacity="0.7" />
                    <path d="M50 38 L24 25" strokeWidth="0.3" opacity="0.0" /> {/* Hidden guide, just visualizing */}

                    {/* Legs - Standing */}
                    <path d="M50 70 L40 92" strokeWidth="0.5" />
                    <path d="M50 70 L60 92" strokeWidth="0.5" />

                    {/* Legs - Spread (Vitruvian variants) */}
                    <path d="M50 70 L30 85" strokeWidth="0.3" opacity="0.7" />
                    <path d="M50 70 L70 85" strokeWidth="0.3" opacity="0.7" />

                    {/* Connecting Energy Lines (Chakras hint) */}
                    <circle cx="50" cy="45" r="1" fill="#FFD700" className="animate-pulse" /> {/* Heart */}
                    <circle cx="50" cy="38" r="0.5" fill="#FFFFFF" /> {/* Throat */}
                    <circle cx="50" cy="28" r="0.5" fill="#FFFFFF" /> {/* Third Eye */}
                    <circle cx="50" cy="55" r="0.5" fill="#FFFFFF" /> {/* Solar Plexus */}

                </svg>
            </motion.div>
        </div>
    );
};
