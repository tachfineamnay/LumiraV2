'use client';

import { motion } from 'framer-motion';
import { Shield, Zap, RefreshCw } from 'lucide-react';

const badges = [
    {
        icon: Shield,
        title: 'Paiement 100% sécurisé',
        description: 'Cryptage SSL',
    },
    {
        icon: Zap,
        title: 'Accès immédiat',
        description: 'Dès confirmation',
    },
    {
        icon: RefreshCw,
        title: 'Satisfait ou remboursé',
        description: 'Garantie 14 jours',
    },
];

export function TrustBadges() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="grid grid-cols-3 gap-3"
        >
            {badges.map((badge, index) => (
                <motion.div
                    key={badge.title}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
                    className="bg-abyss-500/50 backdrop-blur-sm border border-horizon-400/20 rounded-xl p-3 text-center group hover:border-horizon-400/40 transition-all duration-300"
                >
                    <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-horizon-400/10 mb-2 group-hover:bg-horizon-400/20 transition-colors">
                        <badge.icon className="w-5 h-5 text-horizon-400" />
                    </div>
                    <p className="text-stellar-200 text-xs font-medium leading-tight">{badge.title}</p>
                    <p className="text-stellar-500 text-[10px] mt-0.5">{badge.description}</p>
                </motion.div>
            ))}
        </motion.div>
    );
}
