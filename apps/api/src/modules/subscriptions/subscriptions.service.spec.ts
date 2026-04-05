import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock Stripe
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        customers: {
            create: jest.fn().mockResolvedValue({ id: 'cus_test_123' }),
        },
        checkout: {
            sessions: {
                create: jest.fn().mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/test' }),
            },
        },
        subscriptions: {
            update: jest.fn().mockResolvedValue({ id: 'sub_test_123' }),
        },
    }));
});

describe('SubscriptionsService', () => {
    let service: SubscriptionsService;
    let prisma: Record<string, any>;

    beforeEach(async () => {
        prisma = {
            subscription: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
            user: {
                findUnique: jest.fn(),
                update: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SubscriptionsService,
                { provide: PrismaService, useValue: prisma },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            const config: Record<string, string> = {
                                STRIPE_SECRET_KEY: 'sk_test_mock',
                                STRIPE_PRICE_29: 'price_test_29',
                            };
                            return config[key];
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<SubscriptionsService>(SubscriptionsService);
    });

    // =========================================================================
    // getStatus
    // =========================================================================

    describe('getStatus', () => {
        it('should return subscription data when exists', async () => {
            const mockSub = {
                id: 'sub-1',
                userId: 'user-1',
                status: 'ACTIVE',
                currentPeriodEnd: new Date(),
                cancelAtPeriodEnd: false,
            };
            prisma.subscription.findUnique.mockResolvedValue(mockSub);

            const result = await service.getStatus('user-1');

            expect(result.hasSubscription).toBe(true);
            expect(result.subscription).toEqual(mockSub);
        });

        it('should return no subscription when none exists', async () => {
            prisma.subscription.findUnique.mockResolvedValue(null);

            const result = await service.getStatus('user-1');

            expect(result.hasSubscription).toBe(false);
            expect(result.subscription).toBeNull();
        });
    });

    // =========================================================================
    // createCheckoutSession
    // =========================================================================

    describe('createCheckoutSession', () => {
        it('should prevent duplicate active subscriptions', async () => {
            prisma.subscription.findUnique.mockResolvedValue({ status: 'ACTIVE' });

            await expect(
                service.createCheckoutSession('user-1', 'https://success', 'https://cancel'),
            ).rejects.toThrow(ConflictException);
        });

        it('should throw NotFoundException when user not found', async () => {
            prisma.subscription.findUnique.mockResolvedValue(null);
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(
                service.createCheckoutSession('nonexistent', 'https://success', 'https://cancel'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should create checkout session for valid user', async () => {
            prisma.subscription.findUnique.mockResolvedValue(null);
            prisma.user.findUnique.mockResolvedValue({
                email: 'marie@test.com',
                firstName: 'Marie',
                lastName: 'Dubois',
                stripeCustomerId: 'cus_existing',
            });

            const result = await service.createCheckoutSession(
                'user-1',
                'https://lumira.com/success',
                'https://lumira.com/cancel',
            );

            expect(result.url).toContain('checkout.stripe.com');
        });

        it('should create Stripe customer if none exists', async () => {
            prisma.subscription.findUnique.mockResolvedValue(null);
            prisma.user.findUnique.mockResolvedValue({
                email: 'new@test.com',
                firstName: 'New',
                lastName: 'User',
                stripeCustomerId: null,
            });
            prisma.user.update.mockResolvedValue({});

            await service.createCheckoutSession('user-1', 'https://success', 'https://cancel');

            expect(prisma.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'user-1' },
                    data: { stripeCustomerId: 'cus_test_123' },
                }),
            );
        });
    });

    // =========================================================================
    // cancel
    // =========================================================================

    describe('cancel', () => {
        it('should throw when no subscription exists', async () => {
            prisma.subscription.findUnique.mockResolvedValue(null);

            await expect(service.cancel('user-1')).rejects.toThrow();
        });

        it('should throw ConflictException when already scheduled for cancellation', async () => {
            prisma.subscription.findUnique.mockResolvedValue({
                status: 'ACTIVE',
                cancelAtPeriodEnd: true,
                stripeSubscriptionId: 'sub_test',
            });

            await expect(service.cancel('user-1')).rejects.toThrow(ConflictException);
        });
    });

    // =========================================================================
    // resume
    // =========================================================================

    describe('resume', () => {
        it('should throw when no subscription exists', async () => {
            prisma.subscription.findUnique.mockResolvedValue(null);

            await expect(service.resume('user-1')).rejects.toThrow();
        });
    });
});
