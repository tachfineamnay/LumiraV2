
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VertexOracle, UserProfile, OrderContext } from './VertexOracle';
import { PrismaService } from '../../prisma/prisma.service';
import { VertexAI } from '@google-cloud/vertexai';

// Simple mock factory that just returns a Jest fn
jest.mock('@google-cloud/vertexai', () => {
    return {
        VertexAI: jest.fn(),
    };
});

jest.mock('axios');

describe('VertexOracle', () => {
    let service: VertexOracle;
    let mockGenerateContent: jest.Mock;

    const mockUserProfile: UserProfile = {
        userId: 'user-123',
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@example.com',
        birthDate: '1990-01-01',
        birthTime: '12:00',
        birthPlace: 'Paris, France',
        specificQuestion: 'Will I find love?',
        objective: 'Spiritual growth',
    };

    const mockOrderContext: OrderContext = {
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        level: 1,
        productName: 'Initiated',
    };

    const mockGeminiResponse = {
        pdf_content: {
            introduction: 'Intro text',
            archetype_reveal: 'You are the Sage',
            sections: [],
            karmic_insights: [],
            life_mission: 'To learn',
            rituals: [],
            conclusion: 'End text',
        },
        synthesis: {
            archetype: 'Le Sage',
            keywords: ['Wisdom'],
            emotional_state: 'Calm',
        },
        timeline: [],
    };

    beforeEach(async () => {
        // 1. create the content mock function (fresh for each test)
        mockGenerateContent = jest.fn();

        // 2. Configure the VertexAI mock implementation
        (VertexAI as unknown as jest.Mock).mockImplementation(() => ({
            getGenerativeModel: jest.fn(() => ({
                generateContent: mockGenerateContent,
            })),
            preview: {
                getGenerativeModel: jest.fn(() => ({
                    generateContent: mockGenerateContent,
                })),
            },
        }));

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VertexOracle,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string, defaultValue?: string) => {
                            if (key === 'GOOGLE_CLOUD_PROJECT') return 'test-project';
                            if (key === 'GOOGLE_CLOUD_LOCATION') return 'us-central1';
                            return defaultValue;
                        }),
                    },
                },
                {
                    provide: PrismaService,
                    useValue: {
                        systemSetting: {
                            findUnique: jest.fn().mockResolvedValue(null),
                        },
                    },
                },
            ],
        }).compile();

        service = module.get<VertexOracle>(VertexOracle);

        // Clear mocks
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('generateFullReading', () => {
        it('should successfully generate and parse valid JSON response', async () => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    candidates: [
                        {
                            content: {
                                parts: [
                                    {
                                        text: JSON.stringify(mockGeminiResponse),
                                    },
                                ],
                            },
                        },
                    ],
                },
            });

            const result = await service.generateFullReading(mockUserProfile, mockOrderContext);

            expect(result).toEqual(mockGeminiResponse);
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        });

        it('should throw an error if Gemini returns empty content', async () => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    candidates: [],
                },
            });

            await expect(service.generateFullReading(mockUserProfile, mockOrderContext))
                .rejects
                .toThrow('Empty response from Gemini');
        });
    });
});
