/**
 * @fileoverview SpiritualPathBatchService
 * 
 * Cron-driven service that progressively generates PathSteps for the 30-day
 * spiritual timeline in three batches of 10 days:
 *
 *   Batch 1 (days  1-10): generated immediately on subscription creation (handled by payment webhook)
 *   Batch 2 (days 11-20): generated on day 10 of the subscription (10 days after currentPeriodStart)
 *   Batch 3 (days 21-30): generated on day 20 of the subscription (20 days after currentPeriodStart)
 *
 * The cron runs every 6 hours and queries for subscriptions where the batch
 * unlock date has passed but the corresponding steps have not yet been created.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PathActionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VertexOracle, ReadingSynthesis, TimelineDay, UserProfile } from '../factory/VertexOracle';

const BATCH_UNLOCK_DAYS: Record<2 | 3, number> = {
    2: 10, // days 11-20 unlock after 10 days
    3: 20, // days 21-30 unlock after 20 days
};

@Injectable()
export class SpiritualPathBatchService {
    private readonly logger = new Logger(SpiritualPathBatchService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly vertexOracle: VertexOracle,
    ) {}

    // =========================================================================
    // CRON: runs every 6 hours
    // =========================================================================

    @Cron(CronExpression.EVERY_6_HOURS)
    async runBatchGeneration(): Promise<void> {
        this.logger.log('⏰ [SpiritualPathBatch] Cron triggered');
        await Promise.all([
            this.processBatch(2),
            this.processBatch(3),
        ]);
    }

    // =========================================================================
    // PUBLIC: trigger a specific batch immediately (used by webhook handler)
    // =========================================================================

    async generateBatch1ForUser(userId: string): Promise<void> {
        await this.generateBatchForUser(userId, 1);
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private async processBatch(batchNumber: 2 | 3): Promise<void> {
        const unlockDays = BATCH_UNLOCK_DAYS[batchNumber];
        const startDay   = (batchNumber - 1) * 10 + 1;  // 11 or 21
        const endDay     = batchNumber * 10;              // 20 or 30
        const cutoffDate = new Date(Date.now() - unlockDays * 24 * 60 * 60 * 1000);

        this.logger.log(`🗓️ [Batch ${batchNumber}] Processing days ${startDay}-${endDay} (cutoff: ${cutoffDate.toISOString()})`);

        // Find active subscriptions that are old enough AND whose spiritual path
        // does NOT yet have a step for the first day of this batch.
        const eligible = await this.prisma.subscription.findMany({
            where: {
                status: 'ACTIVE',
                currentPeriodStart: { lte: cutoffDate },
            },
            select: {
                userId: true,
            },
        });

        this.logger.log(`📋 [Batch ${batchNumber}] ${eligible.length} subscriptions eligible`);

        for (const { userId } of eligible) {
            try {
                // Check if we already generated this batch
                const existing = await this.prisma.pathStep.findFirst({
                    where: {
                        spiritualPath: { userId },
                        dayNumber:     startDay,
                    },
                });

                if (existing) {
                    // Already generated — skip silently
                    continue;
                }

                await this.generateBatchForUser(userId, batchNumber);
            } catch (err) {
                this.logger.error(
                    `❌ [Batch ${batchNumber}] Failed for user ${userId.substring(0, 8)}: ${err instanceof Error ? err.message : String(err)}`,
                );
                // Continue to next user regardless of individual failures
            }
        }
    }

    private async generateBatchForUser(
        userId: string,
        batchNumber: 1 | 2 | 3,
    ): Promise<void> {
        const startDay = (batchNumber - 1) * 10 + 1;
        const endDay   = batchNumber * 10;
        this.logger.log(`🔮 Generating batch ${batchNumber} (days ${startDay}-${endDay}) for user ${userId.substring(0, 8)}...`);

        // Load user + profile + spiritual path (for synthesis / archetype)
        const [user, spiritualPath] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: userId },
                include: { profile: true },
            }),
            this.prisma.spiritualPath.findUnique({
                where: { userId },
                select: { id: true, archetype: true, synthesis: true, keyBlockage: true },
            }),
        ]);

        if (!spiritualPath) {
            this.logger.warn(`⚠️ No SpiritualPath found for user ${userId.substring(0, 8)} — skipping`);
            return;
        }

        const profile = user?.profile;

        // Reconstruct UserProfile from DB data
        const userProfile: UserProfile = {
            userId,
            firstName:        user?.firstName || 'Âme',
            lastName:         user?.lastName  || '',
            email:            user?.email     || '',
            birthDate:        profile?.birthDate   || '',
            birthTime:        profile?.birthTime   || undefined,
            birthPlace:       profile?.birthPlace  || undefined,
            specificQuestion: profile?.specificQuestion || undefined,
            objective:        profile?.objective   || undefined,
            highs:            profile?.highs       || undefined,
            lows:             profile?.lows        || undefined,
        };

        // Reconstruct ReadingSynthesis from stored fields
        const synthesis: ReadingSynthesis = {
            archetype:      spiritualPath.archetype,
            keywords:       [],
            emotional_state: '',
            key_blockage:   spiritualPath.keyBlockage || '',
        };

        // Gather the last 10 dreams for context enrichment in batches 2 and 3
        const pastDreams = batchNumber >= 2
            ? await this.prisma.dream.findMany({
                where: {
                    userId,
                    createdAt: { gte: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: { content: true, symbols: true, createdAt: true },
            }).then(dreams =>
                dreams.map(d => ({
                    content:   d.content,
                    symbols:   d.symbols,
                    createdAt: d.createdAt.toISOString(),
                })),
            )
            : undefined;

        // Call VertexOracle to generate this batch
        const timelineDays: TimelineDay[] = await this.vertexOracle.generateTimelineBatch(
            userProfile,
            synthesis,
            batchNumber,
            pastDreams,
        );

        // Persist as PathStep rows
        await this.prisma.$transaction(
            timelineDays.map(day =>
                this.prisma.pathStep.create({
                    data: {
                        spiritualPathId: spiritualPath.id,
                        dayNumber:       day.day || (startDay + timelineDays.indexOf(day)),
                        title:           day.title,
                        description:     day.action,
                        synthesis:       day.mantra,
                        archetype:       spiritualPath.archetype,
                        actionType:      this.mapActionType(day.actionType),
                        isCompleted:     false,
                        unlockedAt:      null,  // Unlocked progressively when user reaches that day
                    },
                }),
            ),
        );

        this.logger.log(`✅ Batch ${batchNumber}: ${timelineDays.length} steps persisted for user ${userId.substring(0, 8)}`);
    }

    private mapActionType(type: string): PathActionType {
        const map: Record<string, PathActionType> = {
            MANTRA:     'MANTRA',
            RITUAL:     'RITUAL',
            JOURNALING: 'JOURNALING',
            MEDITATION: 'MEDITATION',
            REFLECTION: 'REFLECTION',
        };
        return map[type] || 'REFLECTION';
    }
}
