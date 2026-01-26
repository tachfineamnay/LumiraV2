'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, FileText, GripVertical } from 'lucide-react';
import { DirectorChat, ChatMessage } from './DirectorChat';
import { LiveDocument } from './LiveDocument';

interface StudioLayoutProps {
    orderId: string;
    orderNumber: string;
    clientName: string;
    clientRefId?: string;
    initialContent: string;
    onSeal: (content: string) => Promise<void>;
    onAIRequest: (prompt: string, currentContent: string) => Promise<string>;
}

export function StudioLayout({
    orderId,
    orderNumber,
    clientName,
    clientRefId,
    initialContent,
    onSeal,
    onAIRequest,
}: StudioLayoutProps) {
    const [activeTab, setActiveTab] = useState<'chat' | 'document'>('document');
    const [splitPosition, setSplitPosition] = useState(40); // percentage
    const [isDragging, setIsDragging] = useState(false);
    const [documentContent, setDocumentContent] = useState(initialContent);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'assistant',
            content: `Bienvenue dans le Studio de Co-Création pour la commande **${orderNumber}**.\n\nJe suis prêt à vous aider à affiner le contenu pour ${clientName}. Utilisez les actions rapides ou décrivez vos souhaits.`,
            timestamp: new Date(),
        },
    ]);
    const [isProcessing, setIsProcessing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Handle split pane dragging
    const handleMouseDown = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!isDragging || !containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
            setSplitPosition(Math.min(Math.max(newPosition, 25), 75));
        },
        [isDragging]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Handle chat messages and AI requests
    const handleSendMessage = async (message: string) => {
        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: message,
            timestamp: new Date(),
        };

        setChatMessages((prev) => [...prev, userMessage]);
        setIsProcessing(true);

        try {
            const response = await onAIRequest(message, documentContent);

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setChatMessages((prev) => [...prev, assistantMessage]);

            // If the response contains updated content, apply it
            if (response.includes('---CONTENT_UPDATE---')) {
                const [chatPart, contentPart] = response.split('---CONTENT_UPDATE---');
                assistantMessage.content = chatPart.trim();
                setDocumentContent(contentPart.trim());
            }
        } catch (error) {
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Désolé, une erreur s'est produite. Veuillez réessayer.",
                timestamp: new Date(),
            };
            setChatMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsProcessing(false);
        }
    };

    // Quick actions
    const handleQuickAction = async (action: string) => {
        const prompts: Record<string, string> = {
            shorten: 'Raccourcis ce texte en gardant l\'essentiel spirituel. Garde le même ton mystique.',
            mystify: 'Rends ce texte plus mystique et poétique. Ajoute des métaphores spirituelles.',
            tone: 'Corrige le ton pour qu\'il soit plus chaleureux et bienveillant, tout en restant professionnel.',
            expand: 'Développe davantage les insights spirituels. Ajoute plus de profondeur.',
            simplify: 'Simplifie le langage tout en préservant la profondeur spirituelle.',
        };

        const prompt = prompts[action] || action;
        await handleSendMessage(prompt);
    };

    const handleSeal = async () => {
        setIsProcessing(true);
        try {
            await onSeal(documentContent);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div
            ref={containerRef}
            className="h-[calc(100vh-180px)] flex flex-col bg-void-dark rounded-xl border border-gold/20 overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Mobile Tab Switcher */}
            <div className="lg:hidden flex border-b border-gold/20">
                <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                        activeTab === 'chat'
                            ? 'text-gold bg-gold/10 border-b-2 border-gold'
                            : 'text-divine/60 hover:text-divine'
                    }`}
                >
                    <MessageSquare className="w-4 h-4" />
                    Direction IA
                </button>
                <button
                    onClick={() => setActiveTab('document')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                        activeTab === 'document'
                            ? 'text-gold bg-gold/10 border-b-2 border-gold'
                            : 'text-divine/60 hover:text-divine'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    Document
                </button>
            </div>

            {/* Desktop Split View */}
            <div className="flex-1 flex overflow-hidden">
                {/* Chat Panel */}
                <motion.div
                    className={`${
                        activeTab === 'chat' ? 'flex' : 'hidden'
                    } lg:flex flex-col bg-void border-r border-gold/20`}
                    style={{ width: `${splitPosition}%` }}
                    initial={false}
                >
                    <DirectorChat
                        messages={chatMessages}
                        onSendMessage={handleSendMessage}
                        onQuickAction={handleQuickAction}
                        isProcessing={isProcessing}
                    />
                </motion.div>

                {/* Resize Handle */}
                <div
                    className="hidden lg:flex items-center justify-center w-2 bg-void-dark hover:bg-gold/20 cursor-col-resize transition-colors group"
                    onMouseDown={handleMouseDown}
                >
                    <GripVertical className="w-4 h-4 text-divine/30 group-hover:text-gold transition-colors" />
                </div>

                {/* Document Panel */}
                <motion.div
                    className={`${
                        activeTab === 'document' ? 'flex' : 'hidden'
                    } lg:flex flex-col flex-1 bg-void-darker`}
                    initial={false}
                >
                    <LiveDocument
                        content={documentContent}
                        onChange={setDocumentContent}
                        orderNumber={orderNumber}
                        clientName={clientName}
                        clientRefId={clientRefId}
                        onSeal={handleSeal}
                        isProcessing={isProcessing}
                    />
                </motion.div>
            </div>
        </div>
    );
}
