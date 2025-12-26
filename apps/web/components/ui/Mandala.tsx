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
        </div>
    );
};
