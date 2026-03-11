import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ContextDispatcher } from '../../services/factory/ContextDispatcher';

// Chat quota for free users
const FREE_CHAT_QUOTA = 3;

// Custom error codes
export const CHAT_ERROR_CODES = {
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    NO_ACCESS: 'NO_ACCESS',
} as const;

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

@Injectable()
export class ClientService {
    private readonly logger = new Logger(ClientService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly contextDispatcher: ContextDispatcher,
    ) { }

    /**
     * Get the user's spiritual path with all steps
     */
    async getSpiritualPath(userId: string) {
        const spiritualPath = await this.prisma.spiritualPath.findUnique({
            where: { userId },
            include: {
                steps: {
                    orderBy: { dayNumber: 'asc' },
                },
            },
        });

        if (!spiritualPath) {
            return null;
        }

        return {
            id: spiritualPath.id,
            archetype: spiritualPath.archetype,
            synthesis: spiritualPath.synthesis,
            keyBlockage: spiritualPath.keyBlockage,
            startedAt: spiritualPath.startedAt,
            completedAt: spiritualPath.completedAt,
            steps: spiritualPath.steps.map(step => ({
                id: step.id,
                dayNumber: step.dayNumber,
                title: step.title,
                description: step.description,
                synthesis: step.synthesis,
                archetype: step.archetype,
                actionType: step.actionType,
                ritualPrompt: step.ritualPrompt,
                isCompleted: step.isCompleted,
                completedAt: step.completedAt,
                unlockedAt: step.unlockedAt,
            })),
        };
    }

    /**
     * Mark a spiritual path step as completed
     */
    async completeStep(userId: string, stepId: string) {
        // Verify the step belongs to this user
        const step = await this.prisma.pathStep.findFirst({
            where: {
                id: stepId,
                spiritualPath: { userId },
            },
        });

        if (!step) {
            throw new NotFoundException('Étape non trouvée');
        }

        const updated = await this.prisma.pathStep.update({
            where: { id: stepId },
            data: {
                isCompleted: true,
                completedAt: new Date(),
            },
        });

        this.logger.log(`✅ Step ${step.dayNumber} completed for user ${userId}`);

        return updated;
    }

    /**
     * Get the user's profile with their latest reading data
     */
    async getClientProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                profile: true,
                orders: {
                    where: { status: 'COMPLETED' },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        orderNumber: true,
                        generatedContent: true,
                        deliveredAt: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('Utilisateur non trouvé');
        }

        const latestReading = user.orders[0];
        let archetype = null;
        let readingData = null;

        if (latestReading?.generatedContent) {
            const content = latestReading.generatedContent as any;
            archetype = content.archetype || null;
            readingData = {
                orderId: latestReading.id,
                orderNumber: latestReading.orderNumber,
                deliveredAt: latestReading.deliveredAt,
                archetype: content.archetype,
                introduction: content.introduction,
                sections: content.sections,
                karmicInsights: content.karmicInsights,
                lifeMission: content.lifeMission,
                conclusion: content.conclusion,
            };
        }

        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            dateOfBirth: user.dateOfBirth,
            subscriptionStatus: user.subscriptionStatus,
            totalOrders: user.totalOrders,
            createdAt: user.createdAt,
            profile: user.profile ? {
                birthDate: user.profile.birthDate,
                birthTime: user.profile.birthTime,
                birthPlace: user.profile.birthPlace,
                specificQuestion: user.profile.specificQuestion,
                objective: user.profile.objective,
                profileCompleted: user.profile.profileCompleted,
            } : null,
            archetype,
            latestReading: readingData,
        };
    }

    /**
     * Get all readings for a user (for the sanctuary)
     * Includes both completed and in-progress readings
     */
    async getCompletedReadings(userId: string) {
        // Get completed readings
        const completedOrders = await this.prisma.order.findMany({
            where: {
                userId,
                status: 'COMPLETED',
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                generatedContent: true,
                deliveredAt: true,
                createdAt: true,
            },
        });

        // Get in-progress readings (PENDING, PROCESSING, AWAITING_VALIDATION)
        const pendingOrders = await this.prisma.order.findMany({
            where: {
                userId,
                status: { in: ['PENDING', 'PROCESSING', 'AWAITING_VALIDATION', 'PAID'] },
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                generatedContent: true,
                deliveredAt: true,
                createdAt: true,
            },
        });

        // Map completed readings
        const completedReadings = completedOrders.map(order => {
            const content = order.generatedContent as Record<string, unknown> | null;
            const synthesis = content?.synthesis as Record<string, unknown> | undefined;
            
            // Archetype can be at root level (legacy) or in synthesis (new AI structure)
            const archetype = (content?.archetype as string) || 
                              (synthesis?.archetype as string) || 
                              null;
            
            return {
                id: order.id,
                orderNumber: order.orderNumber,
                status: 'COMPLETED' as const,
                deliveredAt: order.deliveredAt,
                createdAt: order.createdAt,
                archetype,
                title: archetype 
                    ? `Lecture d'Âme - ${archetype}`
                    : `Lecture d'Âme #${order.orderNumber}`,
                intention: (content?.specificQuestion as string) || null,
                keywords: (content?.keywords as string[]) || (synthesis?.keywords as string[]) || [],
                assets: {
                    pdf: (content?.pdfUrl as string) || null,
                    audio: (content?.audioUrl as string) || null,
                },
            };
        });

        // Map in-progress readings
        const inProgressReadings = pendingOrders.map(order => ({
            id: order.id,
            orderNumber: order.orderNumber,
            status: order.status as 'PENDING' | 'PROCESSING' | 'AWAITING_VALIDATION' | 'PAID',
            deliveredAt: null,
            createdAt: order.createdAt,
            archetype: null,
            title: `Lecture d'Âme #${order.orderNumber}`,
            intention: null,
            keywords: [],
            assets: {
                pdf: null,
                audio: null,
            },
            inProgress: true,
        }));

        return {
            readings: completedReadings,
            pending: inProgressReadings,
        };
    }

    /**
     * Get the full content of a specific reading
     */
    async getReadingContent(userId: string, orderId: string) {
        const order = await this.prisma.order.findFirst({
            where: {
                id: orderId,
                userId,
                status: 'COMPLETED',
            },
        });

        if (!order) {
            throw new NotFoundException('Lecture non trouvée');
        }

        const content = order.generatedContent as any;

        return {
            id: order.id,
            orderNumber: order.orderNumber,
            deliveredAt: order.deliveredAt,
            createdAt: order.createdAt,
            userName: order.userName,
            archetype: content?.archetype,
            archetypeDescription: content?.archetypeDescription,
            introduction: content?.introduction,
            sections: content?.sections,
            karmicInsights: content?.karmicInsights,
            lifeMission: content?.lifeMission,
            rituals: content?.rituals,
            conclusion: content?.conclusion,
            timeline: content?.timeline,
        };
    }

    /**
     * Get the user's chat quota status
     * Returns remaining messages and subscription status
     */
    async getChatQuota(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                subscriptionStatus: true,
                orders: {
                    where: { status: 'COMPLETED' },
                    take: 1,
                    select: { id: true },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('Utilisateur non trouvé');
        }

        const hasCompletedReading = user.orders.length > 0;
        const isSubscribed = user.subscriptionStatus === 'ACTIVE';

        // If subscribed, unlimited messages
        if (isSubscribed) {
            return {
                isSubscribed: true,
                hasAccess: true,
                messagesUsed: 0,
                messagesRemaining: -1, // -1 = unlimited
                quota: -1,
            };
        }

        // If no completed reading, no access at all
        if (!hasCompletedReading) {
            return {
                isSubscribed: false,
                hasAccess: false,
                messagesUsed: 0,
                messagesRemaining: 0,
                quota: FREE_CHAT_QUOTA,
            };
        }

        // Count user messages across all sessions
        const sessions = await this.prisma.chatSession.findMany({
            where: { userId },
            select: { messages: true },
        });

        let totalUserMessages = 0;
        for (const session of sessions) {
            const messages = session.messages as unknown as ChatMessage[] | null;
            if (messages && Array.isArray(messages)) {
                totalUserMessages += messages.filter(m => m.role === 'user').length;
            }
        }

        const messagesRemaining = Math.max(0, FREE_CHAT_QUOTA - totalUserMessages);

        return {
            isSubscribed: false,
            hasAccess: messagesRemaining > 0,
            messagesUsed: totalUserMessages,
            messagesRemaining,
            quota: FREE_CHAT_QUOTA,
        };
    }

    /**
     * Chat with Oracle Lumira using the CONFIDANT agent
     * Verifies user has access (completed reading or active subscription)
     * Enforces quota for free users (3 messages max)
     */
    async chatWithOracle(userId: string, message: string, sessionId?: string) {
        // Get quota status
        const quotaStatus = await this.getChatQuota(userId);

        // Check if user has any access
        if (!quotaStatus.isSubscribed && quotaStatus.messagesRemaining === 0 && quotaStatus.messagesUsed === 0) {
            const error = new ForbiddenException({
                message: 'Vous devez avoir complété au moins une lecture pour accéder au chat avec l\'Oracle.',
                code: CHAT_ERROR_CODES.NO_ACCESS,
            });
            throw error;
        }

        // Check quota for non-subscribers
        if (!quotaStatus.isSubscribed && quotaStatus.messagesRemaining <= 0) {
            this.logger.warn(`⚠️ User ${userId} exceeded chat quota (${quotaStatus.messagesUsed}/${FREE_CHAT_QUOTA})`);
            const error = new ForbiddenException({
                message: 'L\'Oracle doit se reposer... Rejoignez le Cercle pour continuer vos échanges.',
                code: CHAT_ERROR_CODES.QUOTA_EXCEEDED,
                quotaStatus: {
                    messagesUsed: quotaStatus.messagesUsed,
                    quota: FREE_CHAT_QUOTA,
                },
            });
            throw error;
        }

        this.logger.log(`💬 Chat request from user ${userId}: "${message.substring(0, 50)}..." (${quotaStatus.messagesUsed + 1}/${quotaStatus.isSubscribed ? '∞' : FREE_CHAT_QUOTA})`);

        try {
            // Use ContextDispatcher to route to CONFIDANT agent
            const response = await this.contextDispatcher.dispatchChatRequest(
                userId,
                message,
                sessionId,
            );

            // Calculate new remaining after this message
            const newMessagesRemaining = quotaStatus.isSubscribed 
                ? -1 
                : Math.max(0, quotaStatus.messagesRemaining - 1);

            return {
                success: true,
                response: response.reply,
                sessionId: response.sessionId,
                contextUsed: response.contextUsed,
                timestamp: new Date().toISOString(),
                // Include quota info for frontend
                quota: {
                    isSubscribed: quotaStatus.isSubscribed,
                    messagesRemaining: newMessagesRemaining,
                    messagesUsed: quotaStatus.messagesUsed + 1,
                    total: FREE_CHAT_QUOTA,
                },
            };
        } catch (error) {
            this.logger.error(`❌ Chat error for user ${userId}:`, error);
            throw error;
        }
    }
}
