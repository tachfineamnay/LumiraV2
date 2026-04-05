import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { DreamsService } from './dreams.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VertexOracle } from '../../services/factory/VertexOracle';

describe('DreamsService', () => {
    let service: DreamsService;
    let prisma: Record<string, any>;
    let vertexOracle: jest.Mocked<Partial<VertexOracle>>;

    const mockUser = { id: 'user-1' };

    const mockDream = {
        id: 'dream-1',
        userId: 'user-1',
        content: 'Je marchais dans une forêt lumineuse',
        emotion: 'sérénité',
        interpretation: JSON.stringify({
            summary: 'Un rêve de paix intérieure',
            symbols: ['forêt', 'lumière'],
            guidance: 'Connecte-toi à la nature',
        }),
        symbols: ['forêt', 'lumière'],
        linkedInsightId: null,
        linkedStepId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockInsights = [
        { id: 'ins-1', category: 'SPIRITUEL', short: 'Chemin lumineux' },
        { id: 'ins-2', category: 'RELATIONS', short: 'Liens profonds' },
    ];

    const mockSpiritualPath = {
        id: 'path-1',
        userId: 'user-1',
        archetype: 'Le Sage',
        steps: [{ id: 'step-1', title: 'Jour 1', description: 'Méditation', dayNumber: 1, isCompleted: false }],
    };

    const mockAkashicRecord = {
        archetype: 'Le Sage',
        history: [
            { topic: 'méditation', sentiment: 'positif' },
            { topic: 'guidance', sentiment: 'neutre' },
        ],
    };

    const mockInterpretation = {
        summary: 'Un rêve de paix intérieure',
        symbols: ['forêt', 'lumière'],
        guidance: 'Connecte-toi à la nature',
    };

    beforeEach(async () => {
        prisma = {
            dream: {
                count: jest.fn(),
                create: jest.fn(),
                findMany: jest.fn(),
                findFirst: jest.fn(),
            },
            user: {
                findUnique: jest.fn(),
            },
            insight: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
            },
            spiritualPath: {
                findUnique: jest.fn(),
            },
            akashicRecord: {
                findUnique: jest.fn(),
            },
        };

        vertexOracle = {
            generateDreamInterpretation: jest.fn().mockResolvedValue(mockInterpretation),
            chatWithUser: jest.fn().mockResolvedValue('Analyse des patterns oniriques...'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DreamsService,
                { provide: PrismaService, useValue: prisma },
                { provide: VertexOracle, useValue: vertexOracle },
            ],
        }).compile();

        service = module.get<DreamsService>(DreamsService);
    });

    // =========================================================================
    // create
    // =========================================================================

    describe('create', () => {
        const dto = { content: 'Je marchais dans une forêt lumineuse', emotion: 'sérénité' };

        beforeEach(() => {
            prisma.dream.count.mockResolvedValue(0);
            prisma.dream.findMany.mockResolvedValue([]); // pastDreams in Promise.all
            prisma.user.findUnique.mockResolvedValue(mockUser);
            prisma.insight.findMany.mockResolvedValue(mockInsights);
            prisma.spiritualPath.findUnique.mockResolvedValue(mockSpiritualPath);
            prisma.akashicRecord.findUnique.mockResolvedValue(mockAkashicRecord);
            prisma.dream.create.mockResolvedValue(mockDream);
            prisma.insight.findFirst.mockResolvedValue(null);
        });

        it('should create a dream and return interpretation', async () => {
            const result = await service.create('user-1', dto);

            expect(result.dream).toEqual(mockDream);
            expect(result.interpretation).toEqual(mockInterpretation);
            expect(result.remainingToday).toBe(1); // MAX 2 - 0 today - 1 new
            expect(vertexOracle.generateDreamInterpretation).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-1',
                    content: dto.content,
                    emotion: dto.emotion,
                }),
            );
        });

        it('should enforce daily limit of 2 dreams', async () => {
            prisma.dream.count.mockResolvedValue(2);

            await expect(service.create('user-1', dto)).rejects.toThrow(HttpException);
            await expect(service.create('user-1', dto)).rejects.toMatchObject({
                status: HttpStatus.TOO_MANY_REQUESTS,
            });
        });

        it('should throw if user not found', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(service.create('user-999', dto)).rejects.toThrow(NotFoundException);
        });

        it('should link insight when symbol matches domain category', async () => {
            const interpretationWithAmour = {
                ...mockInterpretation,
                symbols: ['amour', 'lumière'],
            };
            vertexOracle.generateDreamInterpretation!.mockResolvedValue(interpretationWithAmour);
            prisma.insight.findFirst.mockResolvedValue({ id: 'ins-2' });

            await service.create('user-1', dto);

            expect(prisma.dream.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        linkedInsightId: 'ins-2',
                    }),
                }),
            );
        });

        it('should link to current spiritual path step', async () => {
            await service.create('user-1', dto);

            expect(prisma.dream.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        linkedStepId: 'step-1',
                    }),
                }),
            );
        });

        it('should pass akashic summary in context', async () => {
            await service.create('user-1', dto);

            expect(vertexOracle.generateDreamInterpretation).toHaveBeenCalledWith(
                expect.objectContaining({
                    akashicSummary: expect.stringContaining('méditation'),
                }),
            );
        });

        it('should pass past dreams in context', async () => {
            prisma.dream.findMany.mockResolvedValue([
                { content: 'Premier rêve', symbols: ['eau'], createdAt: new Date('2024-01-01') },
            ]);

            // Override the findMany mock specifically for past dreams
            // (findMany is called both by `findAll` and inside `create` for pastDreams)
            await service.create('user-1', dto);

            expect(vertexOracle.generateDreamInterpretation).toHaveBeenCalledWith(
                expect.objectContaining({
                    pastDreams: expect.any(Array),
                }),
            );
        });

        it('should work without spiritual path', async () => {
            prisma.spiritualPath.findUnique.mockResolvedValue(null);

            const result = await service.create('user-1', dto);
            expect(result.dream).toEqual(mockDream);
        });

        it('should return remainingToday = 0 when one dream already submitted', async () => {
            prisma.dream.count.mockResolvedValue(1);

            const result = await service.create('user-1', dto);
            expect(result.remainingToday).toBe(0); // MAX 2 - 1 today - 1 new
        });
    });

    // =========================================================================
    // findAll
    // =========================================================================

    describe('findAll', () => {
        it('should return dreams from last 30 days', async () => {
            prisma.dream.findMany.mockResolvedValue([mockDream]);

            const result = await service.findAll('user-1');

            expect(result.dreams).toEqual([mockDream]);
            expect(result.total).toBe(1);
            expect(prisma.dream.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: 'user-1',
                        createdAt: expect.objectContaining({
                            gte: expect.any(Date),
                        }),
                    }),
                    orderBy: { createdAt: 'desc' },
                }),
            );
        });

        it('should return empty array when no dreams', async () => {
            prisma.dream.findMany.mockResolvedValue([]);

            const result = await service.findAll('user-1');

            expect(result.dreams).toEqual([]);
            expect(result.total).toBe(0);
        });
    });

    // =========================================================================
    // findOne
    // =========================================================================

    describe('findOne', () => {
        it('should return dream owned by user', async () => {
            prisma.dream.findFirst.mockResolvedValue(mockDream);

            const result = await service.findOne('user-1', 'dream-1');
            expect(result).toEqual(mockDream);
        });

        it('should throw NotFoundException when dream does not exist', async () => {
            prisma.dream.findFirst.mockResolvedValue(null);

            await expect(service.findOne('user-1', 'dream-999')).rejects.toThrow(NotFoundException);
        });

        it('should not return dream for wrong userId (ownership)', async () => {
            prisma.dream.findFirst.mockResolvedValue(null); // DB filters by userId

            await expect(service.findOne('user-2', 'dream-1')).rejects.toThrow(NotFoundException);
        });
    });

    // =========================================================================
    // analyzePatterns
    // =========================================================================

    describe('analyzePatterns', () => {
        it('should return not-ready when less than 5 dreams', async () => {
            prisma.dream.findMany.mockResolvedValue([mockDream, mockDream, mockDream]);

            const result = await service.analyzePatterns('user-1');

            expect(result.ready).toBe(false);
            expect(result.count).toBe(3);
            expect(result.needed).toBe(2);
        });

        it('should analyze patterns when 5+ dreams available', async () => {
            const dreams = Array.from({ length: 7 }, (_, i) => ({
                content: `Rêve ${i}`,
                symbols: ['forêt', 'eau'],
                interpretation: '{}',
                createdAt: new Date(),
            }));
            prisma.dream.findMany.mockResolvedValue(dreams);

            const result = await service.analyzePatterns('user-1');

            expect(result.ready).toBe(true);
            expect(result.count).toBe(7);
            expect(result.topSymbols).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ symbol: 'forêt', count: 7 }),
                    expect.objectContaining({ symbol: 'eau', count: 7 }),
                ]),
            );
            expect(result.patternAnalysis).toBeDefined();
            expect(vertexOracle.chatWithUser).toHaveBeenCalled();
        });

        it('should fallback gracefully when AI call fails', async () => {
            const dreams = Array.from({ length: 5 }, () => ({
                content: 'Rêve',
                symbols: ['feu'],
                interpretation: '{}',
                createdAt: new Date(),
            }));
            prisma.dream.findMany.mockResolvedValue(dreams);
            vertexOracle.chatWithUser!.mockRejectedValue(new Error('Gemini down'));

            const result = await service.analyzePatterns('user-1');

            expect(result.ready).toBe(true);
            expect(result.patternAnalysis).toBe('Analyse des patterns temporairement indisponible.');
        });

        it('should aggregate symbol frequency correctly', async () => {
            const dreams = [
                { content: 'A', symbols: ['eau', 'lune'], interpretation: '{}', createdAt: new Date() },
                { content: 'B', symbols: ['eau', 'forêt'], interpretation: '{}', createdAt: new Date() },
                { content: 'C', symbols: ['eau'], interpretation: '{}', createdAt: new Date() },
                { content: 'D', symbols: ['lune', 'forêt'], interpretation: '{}', createdAt: new Date() },
                { content: 'E', symbols: ['eau', 'lune', 'forêt'], interpretation: '{}', createdAt: new Date() },
            ];
            prisma.dream.findMany.mockResolvedValue(dreams);

            const result = await service.analyzePatterns('user-1');

            expect(result.topSymbols![0]).toEqual({ symbol: 'eau', count: 4 });
            expect(result.topSymbols![1]).toEqual({ symbol: 'lune', count: 3 });
            expect(result.topSymbols![2]).toEqual({ symbol: 'forêt', count: 3 });
        });
    });
});
