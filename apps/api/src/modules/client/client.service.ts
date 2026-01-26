import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClientService {
    private readonly logger = new Logger(ClientService.name);

    constructor(private readonly prisma: PrismaService) { }

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
                        level: true,
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
                level: latestReading.level,
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
     * Get all completed readings for a user (for the sanctuary)
     */
    async getCompletedReadings(userId: string) {
        const orders = await this.prisma.order.findMany({
            where: {
                userId,
                status: 'COMPLETED',
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                orderNumber: true,
                level: true,
                generatedContent: true,
                deliveredAt: true,
                createdAt: true,
            },
        });

        return orders.map(order => {
            const content = order.generatedContent as Record<string, unknown> | null;
            return {
                id: order.id,
                orderNumber: order.orderNumber,
                level: order.level,
                deliveredAt: order.deliveredAt,
                createdAt: order.createdAt,
                archetype: (content?.archetype as string) || null,
                title: content?.archetype 
                    ? `Lecture d'Âme - ${content.archetype}`
                    : `Lecture d'Âme #${order.orderNumber}`,
                intention: (content?.specificQuestion as string) || null,
                keywords: (content?.keywords as string[]) || [],
                assets: {
                    pdf: (content?.pdfUrl as string) || null,
                    audio: (content?.audioUrl as string) || null,
                },
            };
        });
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
            level: order.level,
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
}
