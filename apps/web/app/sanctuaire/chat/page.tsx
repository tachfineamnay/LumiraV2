"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, User, Bot, Loader2 } from "lucide-react";
import { GlassCard } from "../../../components/ui/GlassCard";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

export default function OracleChatPage() {
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "Salutations, âme voyageuse. Je suis l'Oracle de Lumira. Quelle question brûle en vous aujourd'hui ?",
            timestamp: new Date(),
        },
    ]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        // Simulate AI response
        setTimeout(() => {
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "Les étoiles s'alignent pour vous répondre... Votre chemin est marqué par une grande transformation. Ayez confiance en l'inconnu.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMsg]);
            setIsLoading(false);
        }, 2000);
    };

    return (
        <div className="w-full min-h-screen p-4 md:p-8 flex flex-col items-center justify-center relative">
            {/* 🌌 Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-20 right-20 w-96 h-96 bg-purple-900/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-20 left-20 w-96 h-96 bg-amber-900/10 rounded-full blur-[100px]" />
            </div>

            <GlassCard className="w-full max-w-4xl h-[800px] flex flex-col relative z-10 border-white/10 !p-0 overflow-hidden">
                {/* 🏷️ Header */}
                <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-900/20 flex items-center justify-center border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                            <Sparkles className="w-6 h-6 text-indigo-300 animate-pulse-slow" />
                        </div>
                        <div>
                            <h1 className="text-xl font-playfair italic text-white">L'Oracle de Lumira</h1>
                            <p className="text-xs text-indigo-200/50 uppercase tracking-widest flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Connecté au Flux
                            </p>
                        </div>
                    </div>
                </div>

                {/* 📜 Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    <AnimatePresence>
                        {messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.3 }}
                                className={`flex items-start gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                            >
                                {/* Avatar */}
                                <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border ${msg.role === "assistant"
                                        ? "bg-indigo-900/20 border-indigo-500/30"
                                        : "bg-amber-900/20 border-amber-500/30"
                                    }`}>
                                    {msg.role === "assistant" ? <Bot className="w-5 h-5 text-indigo-300" /> : <User className="w-5 h-5 text-amber-300" />}
                                </div>

                                {/* Bubble */}
                                <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg backdrop-blur-sm ${msg.role === "assistant"
                                        ? "bg-white/5 border border-indigo-500/20 text-indigo-100 rounded-tl-none"
                                        : "bg-gradient-to-br from-amber-900/40 to-amber-950/40 border border-amber-500/20 text-amber-100 rounded-tr-none"
                                    }`}>
                                    {msg.content}
                                    <div className={`text-[10px] mt-2 opacity-40 uppercase tracking-wider font-bold text-right`}>
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-3 text-indigo-300/50 text-xs uppercase tracking-widest pl-14"
                        >
                            <Loader2 className="w-4 h-4 animate-spin" />
                            L'Oracle consulte les astres...
                        </motion.div>
                    )}
                    <div ref={scrollRef} />
                </div>

                {/* ⌨️ Input Area */}
                <div className="p-6 pt-4 border-t border-white/5 bg-white/5">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="relative flex items-center gap-2 bg-cosmic-void/80 border border-white/10 rounded-xl p-2 pr-2 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder="Posez votre question à l'univers..."
                                className="flex-1 bg-transparent border-none text-white placeholder-white/30 text-sm px-4 py-3 focus:ring-0 focus:outline-none font-medium"
                                disabled={isLoading}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className="p-3 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 text-white hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    <p className="text-center text-[10px] text-white/20 mt-3">
                        L'Oracle offre des guidances spirituelles. Interprétez ses messages avec votre propre intuition.
                    </p>
                </div>
            </GlassCard>
        </div>
    );
}
