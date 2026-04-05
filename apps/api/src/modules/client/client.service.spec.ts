import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ClientService } from './client.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ContextDispatcher } from '../../services/factory/ContextDispatcher';

describe('ClientService', () => {
    let service: ClientService;
    let prisma: Record<string, any>;
    let contextDispatcher: jest.Mocked<Partial<ContextDispatcher>>;

    beforeEach(async () => {
        prisma = {
            spiritualPath: { findUnique: jest.fn() },
            pathStep: { findFirst: jest.fn(), update: jest.fn() },
            orderFile: { findFirst: jest.fn() },
            user: { findUnique: jest.fn() },
            order: { findMany: jest.fn(), findFirst: jest.fn() },
            chatSession: { findMany: jest.fn() },
            userProfile: { update: jest.fn() },
        };

        contextDispatcher = {
            dispatchChatRequest: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClientService,
                { provide: PrismaService, useValue: prisma },
                { provide: ContextDispatcher, useValue: contextDispatcher },
            ],
        }).compile();

        service = module.get<ClientService>(ClientService);
    });

    // =========================================================================
    // getSpiritualPath
    // =========================================================================

    describe('getSpiritualPath', () => {
        it('should return spiritual path with ordered steps', async () => {
            const mockPath = {
                id: 'path-1',
                userId: 'user-1',
                archetype: 'Le Guérisseur',
                synthesis: 'Synthèse.',
                keyBlockage: 'Peur',
                startedAt: new Date(),
                completedAt: null,
                steps: [
                    { id: 's1', dayNumber: 1, title: 'Jour 1', description: 'Desc', synthesis: 'Syn', archetype: 'Le Guérisseur', actionType: 'MEDITATION', ritualPrompt: 'Prompt', isCompleted: true, completedAt: new Date(), unlockedAt: new Date() },
                    { id: 's2', dayNumber: 2, title: 'Jour 2', description: 'Desc', synthesis: 'Syn', archetype: 'Le Guérisseur', actionType: 'MANTRA', ritualPrompt: 'Prompt', isCompleted: false, completedAt: null, unlockedAt: new Date() },
                ],
            };
            prisma.spiritualPath.findUnique.mockResolvedValue(mockPath);
            prisma.orderFile.findFirst.mockResolvedValue({ url: 'https://s3.example.com/audio.mp3' });

            const result = await service.getSpiritualPath('user-1');

            expect(result).toBeTruthy();
            expect(result!.archetype).toBe('Le Guérisseur');
            expect(result!.steps).toHaveLength(2);
            expect(result!.steps[0].dayNumber).toBe(1);
            expect(result!.steps[0].isCompleted).toBe(true);
            expect(result!.steps[1].isCompleted).toBe(false);
            expect(result!.synthesisAudioUrl).toBe('https://s3.example.com/audio.mp3');
        });

        it('should return null when no path exists', async () => {
            prisma.spiritualPath.findUnique.mockResolvedValue(null);

            const result = await service.getSpiritualPath('user-1');
            expect(result).toBeNull();
        });

        it('should return null synthesisAudioUrl when no audio file', async () => {
            prisma.spiritualPath.findUnique.mockResolvedValue({
                id: 'path-1', archetype: 'Test', synthesis: 'S', keyBlockage: 'K',
                startedAt: new Date(), completedAt: null, steps: [],
            });
            prisma.orderFile.findFirst.mockResolvedValue(null);

            const result = await service.getSpiritualPath('user-1');
            expect(result!.synthesisAudioUrl).toBeNull();
        });
    });

    // =========================================================================
    // completeStep
    // =========================================================================

    describe('completeStep', () => {
        it('should mark step as completed', async () => {
            prisma.pathStep.findFirst.mockResolvedValue({
                id: 'step-1', dayNumber: 1, isCompleted: false,
            });
            prisma.pathStep.update.mockResolvedValue({
                id: 'step-1', dayNumber: 1, isCompleted: true, completedAt: new Date(),
            });

            const result = await service.completeStep('user-1', 'step-1');

            expect(result.isCompleted).toBe(true);
            expect(result.completedAt).toBeTruthy();
            expect(prisma.pathStep.update).toHaveBeenCalledWith({
                where: { id: 'step-1' },
                data: { isCompleted: true, completedAt: expect.any(Date) },
            });
        });

        it('should throw NotFoundException for step not belonging to user', async () => {
            prisma.pathStep.findFirst.mockResolvedValue(null);

            await expect(service.completeStep('user-1', 'step-wrong'))
                .rejects
                .toThrow(NotFoundException);
        });

        it('should verify step ownership via spiritual path userId', async () => {
            prisma.pathStep.findFirst.mockResolvedValue(null);

            try {
                await service.completeStep('user-1', 'step-1');
            } catch {}

            expect(prisma.pathStep.findFirst).toHaveBeenCalledWith({
                where: {
                    id: 'step-1',
                    spiritualPath: { userId: 'user-1' },
                },
            });
        });
    });

    // =========================================================================
    // getChatQuota
    // =========================================================================

    describe('getChatQuota', () => {
        it('should return unlimited for subscribed users', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                subscriptionStatus: 'ACTIVE',
                orders: [{ id: 'order-1' }],
            });

            const result = await service.getChatQuota('user-1');

            expect(result.isSubscribed).toBe(true);
            expect(result.messagesRemaining).toBe(-1);
            expect(result.hasAccess).toBe(true);
        });

        it('should return 3 free messages for unsubscribed users with completed reading', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                subscriptionStatus: null,
                orders: [{ id: 'order-1' }],
            });
            prisma.chatSession.findMany.mockResolvedValue([]);

            const result = await service.getChatQuota('user-1');

            expect(result.isSubscribed).toBe(false);
            expect(result.hasAccess).toBe(true);
            expect(result.messagesRemaining).toBe(3);
            expect(result.quota).toBe(3);
        });

        it('should return no access for users without completed reading', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                subscriptionStatus: null,
                orders: [],
            });

            const result = await service.getChatQuota('user-1');

            expect(result.hasAccess).toBe(false);
            expect(result.messagesRemaining).toBe(0);
        });

        it('should count user messages from chat sessions', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                subscriptionStatus: null,
                orders: [{ id: 'order-1' }],
            });
            prisma.chatSession.findMany.mockResolvedValue([
                {
                    messages: [
                        { role: 'user', content: 'Q1', timestamp: '' },
                        { role: 'assistant', content: 'A1', timestamp: '' },
                        { role: 'user', content: 'Q2', timestamp: '' },
                        { role: 'assistant', content: 'A2', timestamp: '' },
                    ],
                },
            ]);

            const result = await service.getChatQuota('user-1');

            expect(result.messagesUsed).toBe(2);
            expect(result.messagesRemaining).toBe(1); // 3 - 2 = 1
        });

        it('should return 0 remaining when quota exhausted', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                subscriptionStatus: null,
                orders: [{ id: 'order-1' }],
            });
            prisma.chatSession.findMany.mockResolvedValue([
                {
                    messages: [
                        { role: 'user', content: 'Q1', timestamp: '' },
                        { role: 'assistant', content: 'A1', timestamp: '' },
                        { role: 'user', content: 'Q2', timestamp: '' },
                        { role: 'assistant', content: 'A2', timestamp: '' },
                        { role: 'user', content: 'Q3', timestamp: '' },
                        { role: 'assistant', content: 'A3', timestamp: '' },
                    ],
                },
            ]);

            const result = await service.getChatQuota('user-1');

            expect(result.messagesRemaining).toBe(0);
            expect(result.hasAccess).toBe(false);
        });

        it('should throw NotFoundException for unknown user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.getChatQuota('nonexistent'))
                .rejects
                .toThrow(NotFoundException);
        });
    });

    // =========================================================================
    // chatWithOracle
    // =========================================================================

    describe('chatWithOracle', () => {
        beforeEach(() => {
            contextDispatcher.dispatchChatRequest!.mockResolvedValue({
                reply: 'Chère âme, voici ma guidance.',
                sessionId: 'session-1',
                contextUsed: 'CONFIDANT',
            } as any);
        });

        it('should dispatch chat request for subscribed user', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                subscriptionStatus: 'ACTIVE',
                orders: [{ id: 'order-1' }],
            });

            const result = await service.chatWithOracle('user-1', 'Ma question');

            expect(result.success).toBe(true);
            expect(result.response).toBe('Chère âme, voici ma guidance.');
            expect(result.quota.isSubscribed).toBe(true);
        });

        it('should throw ForbiddenException when no completed reading (NO_ACCESS)', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                subscriptionStatus: null,
                orders: [],
            });

            await expect(service.chatWithOracle('user-1', 'Question'))
                .rejects
                .toThrow(ForbiddenException);
        });

        it('should throw ForbiddenException when quota exceeded', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                subscriptionStatus: null,
                orders: [{ id: 'order-1' }],
            });
            prisma.chatSession.findMany.mockResolvedValue([
                {
                    messages: [
                        { role: 'user', content: 'Q1', timestamp: '' },
                        { role: 'assistant', content: 'A1', timestamp: '' },
                        { role: 'user', content: 'Q2', timestamp: '' },
                        { role: 'assistant', content: 'A2', timestamp: '' },
                        { role: 'user', content: 'Q3', timestamp: '' },
                        { role: 'assistant', content: 'A3', timestamp: '' },
                    ],
                },
            ]);

            await expect(service.chatWithOracle('user-1', 'Question 4'))
                .rejects
                .toThrow(ForbiddenException);
        });

        it('should decrement remaining messages in response for free users', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                subscriptionStatus: null,
                orders: [{ id: 'order-1' }],
            });
            prisma.chatSession.findMany.mockResolvedValue([
                {
                    messages: [
                        { role: 'user', content: 'Q1', timestamp: '' },
                        { role: 'assistant', content: 'A1', timestamp: '' },
                    ],
                },
            ]);

            const result = await service.chatWithOracle('user-1', 'Question 2');

            expect(result.quota.messagesUsed).toBe(2); // 1 existing + 1 new
            expect(result.quota.messagesRemaining).toBe(1); // 3 - 1 existing - 1 new
        });
    });

    // =========================================================================
    // getClientProfile
    // =========================================================================

    describe('getClientProfile', () => {
        it('should return profile with latest reading', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1',
                email: 'marie@test.com',
                firstName: 'Marie',
                lastName: 'Dubois',
                phone: null,
                dateOfBirth: null,
                subscriptionStatus: 'ACTIVE',
                totalOrders: 1,
                createdAt: new Date(),
                profile: { birthDate: '1990-06-15', birthTime: '14:30', birthPlace: 'Lyon', specificQuestion: 'Ma mission ?', objective: 'Croissance', profileCompleted: true, preferredVoice: 'FEMININE' },
                orders: [{
                    id: 'order-1',
                    orderNumber: 'LU260401001',
                    generatedContent: { archetype: 'Le Guérisseur', introduction: 'Intro' },
                    deliveredAt: new Date(),
                    createdAt: new Date(),
                }],
            });

            const result = await service.getClientProfile('user-1');

            expect(result.email).toBe('marie@test.com');
            expect(result.archetype).toBe('Le Guérisseur');
            expect(result.latestReading).toBeTruthy();
            expect(result.latestReading!.archetype).toBe('Le Guérisseur');
        });

        it('should throw NotFoundException for unknown user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.getClientProfile('nonexistent'))
                .rejects
                .toThrow(NotFoundException);
        });

        it('should return null archetype when no readings', async () => {
            prisma.user.findUnique.mockResolvedValue({
                id: 'user-1', email: 'new@test.com', firstName: 'New', lastName: 'User',
                phone: null, dateOfBirth: null, subscriptionStatus: null, totalOrders: 0,
                createdAt: new Date(), profile: null, orders: [],
            });

            const result = await service.getClientProfile('user-1');

            expect(result.archetype).toBeNull();
            expect(result.latestReading).toBeNull();
        });
    });

    // =========================================================================
    // getReadingContent
    // =========================================================================

    describe('getReadingContent', () => {
        it('should return reading content for completed order owned by user', async () => {
            prisma.order.findFirst.mockResolvedValue({
                id: 'order-1',
                orderNumber: 'LU260401001',
                deliveredAt: new Date(),
                createdAt: new Date(),
                userName: 'Marie Dubois',
                generatedContent: {
                    archetype: 'Le Guérisseur',
                    introduction: 'Bienvenue',
                    sections: [],
                    karmicInsights: [],
                    lifeMission: 'Guérir',
                    rituals: [],
                    conclusion: 'Fin',
                    timeline: [],
                },
            });

            const result = await service.getReadingContent('user-1', 'order-1');

            expect(result.archetype).toBe('Le Guérisseur');
            expect(result.orderNumber).toBe('LU260401001');
        });

        it('should throw NotFoundException for non-existent or non-owned order', async () => {
            prisma.order.findFirst.mockResolvedValue(null);

            await expect(service.getReadingContent('user-1', 'wrong-order'))
                .rejects
                .toThrow(NotFoundException);
        });
    });
});
