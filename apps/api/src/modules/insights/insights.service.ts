import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InsightCategory, Insight } from '@prisma/client';
import { UpsertInsightsDto } from './dto/upsert-insights.dto';

// Category metadata for frontend
export const INSIGHT_CATEGORIES_METADATA = {
    SPIRITUEL: {
        label: 'Spirituel',
        description: 'Éveil, connexion au divin, intuition, synchronicités',
        icon: 'Sparkles',
        color: 'horizon',
    },
    RELATIONS: {
        label: 'Relations',
        description: 'Amour, famille, amitiés, liens karmiques',
        icon: 'Heart',
        color: 'rose',
    },
    MISSION: {
        label: 'Mission',
        description: 'But de vie, vocation, contribution au monde',
        icon: 'Compass',
        color: 'serenity',
    },
    CREATIVITE: {
        label: 'Créativité',
        description: 'Expression artistique, projets, innovation',
        icon: 'Palette',
        color: 'orange',
    },
    EMOTIONS: {
        label: 'Émotions',
        description: 'État intérieur, guérison, équilibre émotionnel',
        icon: 'Cloud',
        color: 'violet',
    },
    TRAVAIL: {
        label: 'Travail',
        description: 'Carrière, projets professionnels, abondance',
        icon: 'Briefcase',
        color: 'emerald',
    },
    SANTE: {
        label: 'Santé',
        description: 'Bien-être physique, énergie vitale, habitudes',
        icon: 'Activity',
        color: 'green',
    },
    FINANCE: {
        label: 'Finance',
        description: 'Prospérité, rapport à l\'argent, flux d\'abondance',
        icon: 'Wallet',
        color: 'amber',
    },
} as const;

export interface InsightWithMetadata extends Insight {
    metadata: (typeof INSIGHT_CATEGORIES_METADATA)[keyof typeof INSIGHT_CATEGORIES_METADATA];
    isNew: boolean;
}

@Injectable()
export class InsightsService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get all insights for a user with category metadata
     */
    async getUserInsights(userId: string): Promise<InsightWithMetadata[]> {
        const insights = await this.prisma.insight.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        return insights.map((insight) => ({
            ...insight,
            metadata: INSIGHT_CATEGORIES_METADATA[insight.category],
            isNew: insight.viewedAt === null,
        }));
    }

    /**
     * Get all categories with their insights (or null if not generated yet)
     */
    async getAllCategoriesWithInsights(userId: string): Promise<
        Array<{
            category: InsightCategory;
            metadata: (typeof INSIGHT_CATEGORIES_METADATA)[keyof typeof INSIGHT_CATEGORIES_METADATA];
            insight: Insight | null;
            isNew: boolean;
        }>
    > {
        const insights = await this.prisma.insight.findMany({
            where: { userId },
        });

        const insightMap = new Map(insights.map((i) => [i.category, i]));

        return Object.entries(INSIGHT_CATEGORIES_METADATA).map(([category, metadata]) => {
            const insight = insightMap.get(category as InsightCategory) || null;
            return {
                category: category as InsightCategory,
                metadata,
                insight,
                isNew: insight ? insight.viewedAt === null : false,
            };
        });
    }

    /**
     * Get a single insight by category
     */
    async getInsightByCategory(
        userId: string,
        category: InsightCategory,
    ): Promise<InsightWithMetadata | null> {
        const insight = await this.prisma.insight.findUnique({
            where: {
                userId_category: { userId, category },
            },
        });

        if (!insight) return null;

        return {
            ...insight,
            metadata: INSIGHT_CATEGORIES_METADATA[insight.category],
            isNew: insight.viewedAt === null,
        };
    }

    /**
     * Mark an insight as viewed (removes "Nouveau" badge)
     */
    async markAsViewed(userId: string, category: InsightCategory): Promise<Insight | null> {
        try {
            return await this.prisma.insight.update({
                where: {
                    userId_category: { userId, category },
                },
                data: {
                    viewedAt: new Date(),
                },
            });
        } catch {
            return null;
        }
    }

    /**
     * Upsert insights from n8n webhook
     * Creates or updates insights for the given user
     */
    async upsertInsights(dto: UpsertInsightsDto): Promise<{ count: number }> {
        const { userId, orderId, insights } = dto;

        // Validate user exists
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new Error(`User ${userId} not found`);
        }

        // Upsert each insight
        const operations = insights.map((insight) =>
            this.prisma.insight.upsert({
                where: {
                    userId_category: { userId, category: insight.category },
                },
                create: {
                    userId,
                    orderId,
                    category: insight.category,
                    short: insight.short,
                    full: insight.full,
                    viewedAt: null, // New insights are unread
                },
                update: {
                    orderId,
                    short: insight.short,
                    full: insight.full,
                    viewedAt: null, // Reset to "new" when content is updated
                    updatedAt: new Date(),
                },
            }),
        );

        await this.prisma.$transaction(operations);

        return { count: insights.length };
    }

    /**
     * Delete all insights for a user (for testing/reset)
     */
    async deleteUserInsights(userId: string): Promise<{ count: number }> {
        const result = await this.prisma.insight.deleteMany({
            where: { userId },
        });
        return { count: result.count };
    }
}
