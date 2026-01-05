'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, Sparkles } from 'lucide-react';

interface FreeOrderButtonProps {
    onSubmit: () => Promise<void>;
    disabled?: boolean;
}

export function FreeOrderButton({ onSubmit, disabled }: FreeOrderButtonProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClick = async () => {
        if (isSubmitting || disabled) return;
        setIsSubmitting(true);
        try {
            await onSubmit();
        } catch {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="space-y-4"
        >
            {/* Free Order Message */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    <span className="text-emerald-300 font-medium">Offre Découverte Gratuite</span>
                </div>
                <p className="text-cosmic-ethereal text-sm">
                    Accédez immédiatement à votre lecture initiale sans engagement.
                </p>
            </div>

            {/* Submit Button */}
            <motion.button
                onClick={handleClick}
                disabled={isSubmitting || disabled}
                className={`
                    w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300
                    ${isSubmitting || disabled
                        ? 'bg-cosmic-deep/60 text-cosmic-stardust cursor-not-allowed border border-white/10'
                        : 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 text-white shadow-[0_0_30px_rgba(52,211,153,0.3)] hover:shadow-[0_0_50px_rgba(52,211,153,0.4)] cursor-pointer relative overflow-hidden group'
                    }
                `}
                whileTap={{ scale: isSubmitting || disabled ? 1 : 0.98 }}
            >
                {/* Shimmer effect */}
                {!isSubmitting && !disabled && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                )}

                <span className="relative z-10 flex items-center gap-2">
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Création de votre compte...</span>
                        </>
                    ) : (
                        <>
                            <CheckCircle className="w-5 h-5" />
                            <span>Valider ma commande gratuite</span>
                        </>
                    )}
                </span>
            </motion.button>
        </motion.div>
    );
}
