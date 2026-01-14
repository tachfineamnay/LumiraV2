'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Eye, EyeOff, Sparkles, User, MapPin, Clock } from 'lucide-react';
import type { OrderDetails, SpiritualPathData } from './ExpertWorkspace';

// =============================================================================
// TYPES
// =============================================================================

interface ClientIdentityProps {
    user: OrderDetails['user'];
    files: OrderDetails['files'];
    spiritualPath?: SpiritualPathData;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ClientIdentity({ user, files, spiritualPath }: ClientIdentityProps) {
    const [showAnnotations, setShowAnnotations] = useState(false);

    const facePhoto = files.find(f => f.type === 'FACE_PHOTO');
    const palmPhoto = files.find(f => f.type === 'PALM_PHOTO');

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Client Header Card */}
            <GlassCard className="p-5">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                        <User className="w-6 h-6 text-slate-900" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">
                            {user.firstName} {user.lastName}
                        </h3>
                        <p className="text-slate-400 text-sm">{user.email}</p>
                    </div>
                </div>

                {/* Birth Data */}
                {user.profile && (
                    <div className="space-y-2 text-sm">
                        {user.profile.birthDate && (
                            <div className="flex items-center gap-2 text-slate-300">
                                <Clock className="w-4 h-4 text-amber-400/60" />
                                <span>{user.profile.birthDate}</span>
                                {user.profile.birthTime && (
                                    <span className="text-slate-500">à {user.profile.birthTime}</span>
                                )}
                            </div>
                        )}
                        {user.profile.birthPlace && (
                            <div className="flex items-center gap-2 text-slate-300">
                                <MapPin className="w-4 h-4 text-amber-400/60" />
                                <span>{user.profile.birthPlace}</span>
                            </div>
                        )}
                    </div>
                )}
            </GlassCard>

            {/* Photos Section */}
            <GlassCard className="flex-1 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        Photos d&apos;Analyse
                    </h4>
                    <button
                        onClick={() => setShowAnnotations(!showAnnotations)}
                        className="p-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                        title={showAnnotations ? 'Masquer annotations' : 'Afficher annotations'}
                    >
                        {showAnnotations ? (
                            <EyeOff className="w-4 h-4 text-slate-400" />
                        ) : (
                            <Eye className="w-4 h-4 text-amber-400" />
                        )}
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <PhotoCard
                        label="Visage"
                        url={facePhoto?.url || user.profile?.facePhotoUrl}
                        showAnnotations={showAnnotations}
                    />
                    <PhotoCard
                        label="Paume"
                        url={palmPhoto?.url || user.profile?.palmPhotoUrl}
                        showAnnotations={showAnnotations}
                    />
                </div>
            </GlassCard>

            {/* Spiritual Path Card */}
            <GlassCard className="p-4">
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    🔮 Chemin Spirituel
                </h4>

                {spiritualPath ? (
                    <div className="space-y-3">
                        {/* Archetype */}
                        <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
                            <span className="text-xs text-amber-400/80 uppercase tracking-wider">Archétype</span>
                            <p className="text-lg font-semibold text-amber-400 mt-1">
                                {spiritualPath.archetype}
                            </p>
                        </div>

                        {/* Key Blockage */}
                        {spiritualPath.keyBlockage && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                <span className="text-xs text-red-400/80 uppercase tracking-wider">Blocage Clé</span>
                                <p className="text-sm text-red-300 mt-1">
                                    {spiritualPath.keyBlockage}
                                </p>
                            </div>
                        )}

                        {/* Progress */}
                        <div className="text-xs text-slate-400">
                            {spiritualPath.steps.filter(s => s.isCompleted).length} / {spiritualPath.steps.length} étapes complétées
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <span className="text-slate-500 text-sm">Pas encore de parcours</span>
                        <p className="text-xs text-slate-600 mt-1">
                            Générez une lecture pour créer le chemin
                        </p>
                    </div>
                )}
            </GlassCard>

            {/* Objective / Question */}
            {(user.profile?.objective || user.profile?.specificQuestion) && (
                <GlassCard className="p-4">
                    <h4 className="text-sm font-medium text-white mb-2">
                        💭 Intention
                    </h4>
                    {user.profile.objective && (
                        <p className="text-sm text-slate-300 mb-2">{user.profile.objective}</p>
                    )}
                    {user.profile.specificQuestion && (
                        <p className="text-xs text-amber-400/80 italic">
                            &quot;{user.profile.specificQuestion}&quot;
                        </p>
                    )}
                </GlassCard>
            )}
        </div>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`
      backdrop-blur-xl bg-slate-800/60 
      border border-slate-700/50 
      rounded-xl 
      ${className}
    `}>
            {children}
        </div>
    );
}

function PhotoCard({
    label,
    url,
    showAnnotations,
}: {
    label: string;
    url?: string;
    showAnnotations: boolean;
}) {
    return (
        <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-800 group">
            {url ? (
                <>
                    <Image
                        src={url}
                        alt={label}
                        fill
                        className="object-cover"
                    />
                    <AnimatePresence>
                        {showAnnotations && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2"
                            >
                                <span className="text-xs text-amber-400 font-medium">
                                    ✨ Analyse AI disponible
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <span className="text-slate-600 text-xs">{label}</span>
                </div>
            )}
            <div className="absolute top-2 left-2">
                <span className="text-xs bg-black/50 px-2 py-0.5 rounded text-slate-300">
                    {label}
                </span>
            </div>
        </div>
    );
}

export default ClientIdentity;
