'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ClientIdentity } from './ClientIdentity';
import { CreationEngine } from './CreationEngine';
import { ClientContinuum } from './ClientContinuum';

// =============================================================================
// TYPES
// =============================================================================

export interface OrderDetails {
    id: string;
    orderNumber: string;
    status: 'PENDING' | 'PAID' | 'PROCESSING' | 'AWAITING_VALIDATION' | 'COMPLETED' | 'FAILED';
    level: number;
    amount: number;
    createdAt: string;
    deliveredAt?: string;
    generatedContent?: {
        pdfUrl?: string;
        pdfKey?: string;
        synthesis?: {
            archetype: string;
            keywords: string[];
            emotional_state: string;
            key_blockage?: string;
        };
        pdf_content?: {
            introduction: string;
            archetype_reveal: string;
            sections: Array<{ domain: string; title: string; content: string }>;
            karmic_insights: string[];
            life_mission: string;
            rituals: Array<{ name: string; description: string; instructions: string[] }>;
            conclusion: string;
        };
        timeline?: Array<{
            day: number;
            title: string;
            action: string;
            mantra: string;
            actionType: string;
        }>;
    };
    user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        profile?: {
            birthDate?: string;
            birthTime?: string;
            birthPlace?: string;
            specificQuestion?: string;
            objective?: string;
            facePhotoUrl?: string;
            palmPhotoUrl?: string;
        };
    };
    files: Array<{
        id: string;
        name: string;
        url: string;
        type: 'FACE_PHOTO' | 'PALM_PHOTO';
    }>;
}

export interface SpiritualPathData {
    id: string;
    archetype: string;
    synthesis: string;
    keyBlockage?: string;
    startedAt: string;
    steps: Array<{
        id: string;
        dayNumber: number;
        title: string;
        description: string;
        synthesis: string;
        actionType: string;
        isCompleted: boolean;
        unlockedAt?: string;
    }>;
}

export interface ChatSessionData {
    id: string;
    messages: Array<{
        role: 'user' | 'assistant' | 'expert';
        content: string;
        timestamp: string;
    }>;
    lastMessageAt?: string;
}

interface ExpertWorkspaceProps {
    order: OrderDetails;
    spiritualPath?: SpiritualPathData;
    chatSession?: ChatSessionData;
    onGenerate: () => Promise<void>;
    onValidate: () => Promise<void>;
    onReject: (reason: string) => Promise<void>;
    isGenerating: boolean;
    generationResult?: {
        pdfUrl: string;
        archetype: string;
        stepsCreated: number;
    };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ExpertWorkspace({
    order,
    spiritualPath,
    chatSession,
    onGenerate,
    onValidate,
    onReject,
    isGenerating,
    generationResult,
}: ExpertWorkspaceProps) {
    return (
        <div className="min-h-screen bg-slate-900 p-6">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <span className="text-amber-400">🔮</span>
                            Le Garage
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Commande {order.orderNumber} • {order.user.firstName} {order.user.lastName}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <StatusBadge status={order.status} />
                        <span className="text-slate-500 text-sm">
                            Niveau {order.level}
                        </span>
                    </div>
                </div>
            </motion.header>

            {/* 3-Column Bento Grid */}
            <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
                {/* Left Panel: The Identity */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="col-span-3"
                >
                    <ClientIdentity
                        user={order.user}
                        files={order.files}
                        spiritualPath={spiritualPath}
                    />
                </motion.div>

                {/* Center Panel: The Creation Engine */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="col-span-6"
                >
                    <CreationEngine
                        order={order}
                        isGenerating={isGenerating}
                        generationResult={generationResult}
                        onGenerate={onGenerate}
                        onValidate={onValidate}
                        onReject={onReject}
                    />
                </motion.div>

                {/* Right Panel: The Continuum */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="col-span-3"
                >
                    <ClientContinuum
                        spiritualPath={spiritualPath}
                        chatSession={chatSession}
                        order={order}
                    />
                </motion.div>
            </div>
        </div>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatusBadge({ status }: { status: OrderDetails['status'] }) {
    const styles: Record<string, string> = {
        PENDING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        PAID: 'bg-green-500/20 text-green-400 border-green-500/30',
        PROCESSING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        AWAITING_VALIDATION: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    const labels: Record<string, string> = {
        PENDING: 'En attente',
        PAID: 'Payée',
        PROCESSING: 'En cours',
        AWAITING_VALIDATION: 'Validation',
        COMPLETED: 'Terminée',
        FAILED: 'Échouée',
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
            {labels[status]}
        </span>
    );
}

export default ExpertWorkspace;
