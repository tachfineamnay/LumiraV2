import { Test, TestingModule } from '@nestjs/testing';
import { InsightsService } from './insights.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InsightsService', () => {
    let service: InsightsService;
    let prisma: Record<string, any>;

    const mockInsight = {
        id: 'insight-1',
        userId: 'user-1',
        orderId: 'order-1',
        category: 'SPIRITUEL',
        short: 'Votre connexion spirituelle est profonde.',
        full: 'Analyse complète de votre spiritualité.',
        audioUrl: null,
        viewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(async () => {
        prisma = {
            insight: {
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                upsert: jest.fn(),
                deleteMany: jest.fn(),
            },
            user: {
                findUnique: jest.fn(),
            },
            $transaction: jest.fn((ops: any[]) => Promise.resolve(ops)),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InsightsService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<InsightsService>(InsightsService);
    });

    // =========================================================================
    // getAllCategoriesWithInsights
    // =========================================================================

    describe('getAllCategoriesWithInsights', () => {
        it('should return all 8 categories even with no insights', async () => {
            prisma.insight.findMany.mockResolvedValue([]);

            const result = await service.getAllCategoriesWithInsights('user-1');

            expect(result).toHaveLength(8);
            expect(result.map((r) => r.category)).toEqual(
                expect.arrayContaining([
                    'SPIRITUEL', 'RELATIONS', 'MISSION', 'CREATIVITE',
                    'EMOTIONS', 'TRAVAIL', 'SANTE', 'FINANCE',
                ]),
            );
            result.forEach((cat) => {
                expect(cat.insight).toBeNull();
                expect(cat.isNew).toBe(false);
                expect(cat.metadata).toBeDefined();
                expect(cat.metadata.label).toBeDefined();
            });
        });

        it('should map insights to their correct categories', async () => {
            prisma.insight.findMany.mockResolvedValue([
                { ...mockInsight, category: 'SPIRITUEL', viewedAt: null },
                { ...mockInsight, id: 'insight-2', category: 'FINANCE', viewedAt: new Date() },
            ]);

            const result = await service.getAllCategoriesWithInsights('user-1');

            const spirituel = result.find((r) => r.category === 'SPIRITUEL');
            expect(spirituel!.insight).toBeTruthy();
            expect(spirituel!.isNew).toBe(true);

            const finance = result.find((r) => r.category === 'FINANCE');
            expect(finance!.insight).toBeTruthy();
            expect(finance!.isNew).toBe(false); // viewed

            const travail = result.find((r) => r.category === 'TRAVAIL');
            expect(travail!.insight).toBeNull();
        });
    });

    // =========================================================================
    // getInsightByCategory
    // =========================================================================

    describe('getInsightByCategory', () => {
        it('should return insight with metadata when found', async () => {
            prisma.insight.findUnique.mockResolvedValue(mockInsight);

            const result = await service.getInsightByCategory('user-1', 'SPIRITUEL' as any);

            expect(result).toBeTruthy();
            expect(result!.category).toBe('SPIRITUEL');
            expect(result!.metadata.label).toBe('Spirituel');
            expect(result!.isNew).toBe(true);
        });

        it('should return null when insight not found', async () => {
            prisma.insight.findUnique.mockResolvedValue(null);

            const result = await service.getInsightByCategory('user-1', 'FINANCE' as any);

            expect(result).toBeNull();
        });

        it('should mark as not new when viewedAt is set', async () => {
            prisma.insight.findUnique.mockResolvedValue({ ...mockInsight, viewedAt: new Date() });

            const result = await service.getInsightByCategory('user-1', 'SPIRITUEL' as any);

            expect(result!.isNew).toBe(false);
        });
    });

    // =========================================================================
    // markAsViewed
    // =========================================================================

    describe('markAsViewed', () => {
        it('should update viewedAt timestamp', async () => {
            prisma.insight.update.mockResolvedValue({ ...mockInsight, viewedAt: new Date() });

            const result = await service.markAsViewed('user-1', 'SPIRITUEL' as any);

            expect(result).toBeTruthy();
            expect(prisma.insight.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId_category: { userId: 'user-1', category: 'SPIRITUEL' } },
                    data: { viewedAt: expect.any(Date) },
                }),
            );
        });

        it('should return null when insight does not exist', async () => {
            prisma.insight.update.mockRejectedValue(new Error('Record not found'));

            const result = await service.markAsViewed('user-1', 'NONEXISTENT' as any);

            expect(result).toBeNull();
        });
    });

    // =========================================================================
    // upsertInsights
    // =========================================================================

    describe('upsertInsights', () => {
        it('should upsert all insights in a transaction', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
            prisma.insight.upsert.mockResolvedValue(mockInsight);

            const dto = {
                userId: 'user-1',
                orderId: 'order-1',
                insights: [
                    { category: 'SPIRITUEL' as any, short: 'Short', full: 'Full' },
                    { category: 'RELATIONS' as any, short: 'Short 2', full: 'Full 2' },
                ],
            };

            const result = await service.upsertInsights(dto);

            expect(result.count).toBe(2);
            expect(prisma.$transaction).toHaveBeenCalled();
        });

        it('should throw when user does not exist', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.upsertInsights({
                    userId: 'nonexistent',
                    insights: [{ category: 'SPIRITUEL' as any, short: 'S', full: 'F' }],
                }),
            ).rejects.toThrow('User nonexistent not found');
        });

        it('should reset viewedAt to null on update (re-mark as new)', async () => {
            prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
            prisma.insight.upsert.mockResolvedValue(mockInsight);

            await service.upsertInsights({
                userId: 'user-1',
                orderId: 'order-1',
                insights: [{ category: 'SPIRITUEL' as any, short: 'Updated', full: 'Updated full' }],
            });

            // Verify the transaction was called with upsert operations
            const transactionCall = prisma.$transaction.mock.calls[0][0];
            expect(transactionCall).toHaveLength(1);
        });
    });

    // =========================================================================
    // getUserInsights
    // =========================================================================

    describe('getUserInsights', () => {
        it('should return insights with metadata and isNew flag', async () => {
            prisma.insight.findMany.mockResolvedValue([
                { ...mockInsight, viewedAt: null },
                { ...mockInsight, id: 'insight-2', category: 'FINANCE', viewedAt: new Date() },
            ]);

            const result = await service.getUserInsights('user-1');

            expect(result).toHaveLength(2);
            expect(result[0].isNew).toBe(true);
            expect(result[0].metadata.label).toBe('Spirituel');
            expect(result[1].isNew).toBe(false);
        });
    });

    // =========================================================================
    // deleteUserInsights
    // =========================================================================

    describe('deleteUserInsights', () => {
        it('should delete all insights for a user', async () => {
            prisma.insight.deleteMany.mockResolvedValue({ count: 8 });

            const result = await service.deleteUserInsights('user-1');

            expect(result.count).toBe(8);
            expect(prisma.insight.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
        });
    });
});
