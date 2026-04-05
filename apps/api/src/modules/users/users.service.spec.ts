import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock @packages/shared
jest.mock('@packages/shared', () => ({
    aggregateCapabilities: jest.fn((levels: number[]) =>
        levels.length > 0 ? ['content.basic', 'readings.pdf', 'chat_unlimited', 'dreams'] : [],
    ),
    getHighestLevel: jest.fn((levels: number[]) =>
        levels.length > 0 ? Math.max(...levels) : 0,
    ),
}));

describe('UsersService', () => {
    let service: UsersService;
    let prisma: Record<string, any>;

    const mockUser = {
        id: 'user-1',
        email: 'marie@test.com',
        firstName: 'Marie',
        lastName: 'Dubois',
        phone: '+33612345678',
        stripeCustomerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        profile: {
            userId: 'user-1',
            birthDate: '1990-06-15',
            birthTime: '14:30',
            birthPlace: 'Lyon',
            specificQuestion: 'Ma mission ?',
            objective: 'Croissance',
            profileCompleted: true,
            submittedAt: new Date(),
        },
    };

    beforeEach(async () => {
        prisma = {
            user: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                upsert: jest.fn(),
                update: jest.fn(),
            },
            expert: {
                findUnique: jest.fn(),
            },
            subscription: {
                findUnique: jest.fn(),
            },
            order: {
                findFirst: jest.fn(),
                findMany: jest.fn(),
                count: jest.fn(),
            },
            userProfile: {
                upsert: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
    });

    // =========================================================================
    // getEntitlements
    // =========================================================================

    describe('getEntitlements', () => {
        it('should return level 4 capabilities for ACTIVE subscription', async () => {
            prisma.subscription.findUnique.mockResolvedValue({ status: 'ACTIVE' });

            const result = await service.getEntitlements('user-1');

            expect(result.highestLevel).toBe(4);
            expect(result.capabilities.length).toBeGreaterThan(0);
            expect(result.products).toContain('subscription');
            expect(result.orderCount).toBe(1);
        });

        it('should return level 0 with no capabilities for no subscription', async () => {
            prisma.subscription.findUnique.mockResolvedValue(null);

            const result = await service.getEntitlements('user-1');

            expect(result.highestLevel).toBe(0);
            expect(result.capabilities).toEqual([]);
            expect(result.products).toEqual([]);
            expect(result.orderCount).toBe(0);
        });

        it('should return level 0 for CANCELED subscription', async () => {
            prisma.subscription.findUnique.mockResolvedValue({ status: 'CANCELED' });

            const result = await service.getEntitlements('user-1');

            expect(result.highestLevel).toBe(0);
            expect(result.products).toEqual([]);
        });

        it('should return level 0 for PAST_DUE subscription', async () => {
            prisma.subscription.findUnique.mockResolvedValue({ status: 'PAST_DUE' });

            const result = await service.getEntitlements('user-1');

            expect(result.highestLevel).toBe(0);
        });
    });

    // =========================================================================
    // findUserWithPaidOrder
    // =========================================================================

    describe('findUserWithPaidOrder', () => {
        it('should return user when paid order exists', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'PAID', amount: 2900 });

            const result = await service.findUserWithPaidOrder('marie@test.com');

            expect(result).toBeTruthy();
            expect(result!.email).toBe('marie@test.com');
        });

        it('should return null when no user found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const result = await service.findUserWithPaidOrder('nobody@test.com');

            expect(result).toBeNull();
        });

        it('should return null when user has no valid orders', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.order.findFirst.mockResolvedValue(null);
            prisma.order.findMany.mockResolvedValue([]); // debug logging

            const result = await service.findUserWithPaidOrder('marie@test.com');

            expect(result).toBeNull();
        });

        it('should normalize email (lowercase + trim)', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await service.findUserWithPaidOrder('  MARIE@Test.COM  ');

            expect(prisma.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { email: 'marie@test.com' },
                }),
            );
        });

        it('should accept COMPLETED orders', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'COMPLETED', amount: 2900 });

            const result = await service.findUserWithPaidOrder('marie@test.com');
            expect(result).toBeTruthy();
        });

        it('should accept PENDING orders with amount > 0 (awaiting webhook)', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'PENDING', amount: 2900 });

            const result = await service.findUserWithPaidOrder('marie@test.com');
            expect(result).toBeTruthy();
        });
    });

    // =========================================================================
    // upsertByEmail
    // =========================================================================

    describe('upsertByEmail', () => {
        it('should upsert user with normalized email', async () => {
            prisma.user.upsert.mockResolvedValue(mockUser);

            await service.upsertByEmail('MARIE@Test.com', 'Marie', 'Dubois', '+33612345678');

            expect(prisma.user.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { email: 'marie@test.com' },
                    create: expect.objectContaining({ email: 'marie@test.com', firstName: 'Marie' }),
                    update: expect.objectContaining({ firstName: 'Marie', lastName: 'Dubois' }),
                }),
            );
        });

        it('should set phone to null when not provided', async () => {
            prisma.user.upsert.mockResolvedValue(mockUser);

            await service.upsertByEmail('marie@test.com', 'Marie', 'Dubois');

            expect(prisma.user.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({ phone: null }),
                }),
            );
        });
    });

    // =========================================================================
    // getUserProfile
    // =========================================================================

    describe('getUserProfile', () => {
        it('should return user with profile and stats', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.order.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);

            const result = await service.getUserProfile('user-1');

            expect(result).toBeTruthy();
            expect(result!.user.email).toBe('marie@test.com');
            expect(result!.profile).toBeTruthy();
            expect(result!.stats).toEqual({ totalOrders: 3, completedOrders: 2 });
        });

        it('should return null for non-existent user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const result = await service.getUserProfile('nonexistent');
            expect(result).toBeNull();
        });
    });

    // =========================================================================
    // getCompletedOrders
    // =========================================================================

    describe('getCompletedOrders', () => {
        it('should return orders in success states sorted by date desc', async () => {
            const orders = [
                { id: 'o1', orderNumber: 'LU260401001', status: 'COMPLETED', deliveredAt: new Date(), createdAt: new Date() },
                { id: 'o2', orderNumber: 'LU260401002', status: 'PROCESSING', deliveredAt: null, createdAt: new Date() },
            ];
            prisma.order.findMany.mockResolvedValue(orders);

            const result = await service.getCompletedOrders('user-1');

            expect(result).toHaveLength(2);
            expect(prisma.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        userId: 'user-1',
                        status: { in: ['COMPLETED', 'AWAITING_VALIDATION', 'PROCESSING', 'PAID'] },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
            );
        });
    });

    // =========================================================================
    // findByEmail
    // =========================================================================

    describe('findByEmail', () => {
        it('should return user with profile when found', async () => {
            prisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await service.findByEmail('marie@test.com');

            expect(result).toBeTruthy();
            expect(prisma.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { email: 'marie@test.com' },
                    include: { profile: true },
                }),
            );
        });

        it('should return null when user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            const result = await service.findByEmail('nobody@test.com');
            expect(result).toBeNull();
        });
    });
});
