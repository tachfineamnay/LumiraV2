import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VertexOracle, UserProfile, OrderContext } from './VertexOracle';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AiRoutingService } from '../../modules/settings/ai-routing.service';
import { AiExecutionResolverService } from './ai-execution-resolver.service';
import { AiRunService } from './ai-run.service';
import { AiRuntimeCacheService } from './ai-runtime-cache.service';
import { ProductLevel, AiMission } from '@prisma/client';

// Mock the @google/generative-ai library (actual library used by VertexOracle)
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn(),
  };
});

jest.mock('axios');

describe('VertexOracle', () => {
  let service: VertexOracle;
  let mockGenerateContent: jest.Mock;
  let aiRunService: { recordRun: jest.Mock };
  let aiExecutionResolver: { resolve: jest.Mock };

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
    productLevel: ProductLevel.INITIE,
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
      key_blockage: 'block',
    },
    timeline: [{ day: 1, title: 'Day 1', action: 'Act', mantra: 'Om', actionType: 'MEDITATION' }],
  };

  beforeEach(async () => {
    // 1. create the content mock function (fresh for each test)
    mockGenerateContent = jest.fn();
    aiRunService = { recordRun: jest.fn().mockResolvedValue(undefined) };
    aiExecutionResolver = {
      resolve: jest.fn(async (ctx, snap) => ({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        temperature: 0.8,
        topP: 0.95,
        maxTokens: 16384,
        systemPrompt: `${snap.lumiraDna}\n\n---\n\n${snap.agentContexts[ctx.agent]}`,
        routingSource: `global:${ctx.agent}`,
      })),
    };

    // 2. Configure the GoogleGenerativeAI mock implementation
    (GoogleGenerativeAI as unknown as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn(() => ({
        generateContent: mockGenerateContent,
      })),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VertexOracle,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'GEMINI_API_KEY') return 'test-gemini-key';
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
            promptVersion: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: AiRoutingService,
          useValue: { resolveRule: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: AiExecutionResolverService,
          useValue: aiExecutionResolver,
        },
        {
          provide: AiRunService,
          useValue: aiRunService,
        },
        {
          provide: AiRuntimeCacheService,
          useValue: { registerInvalidator: jest.fn(), invalidateAll: jest.fn() },
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
          text: () => JSON.stringify(mockGeminiResponse),
        },
      });

      const result = await service.generateFullReading(mockUserProfile, mockOrderContext);

      expect(result).toEqual(mockGeminiResponse);
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it('should throw an error if Gemini returns empty content', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '',
        },
      });

      await expect(
        service.generateFullReading(mockUserProfile, mockOrderContext),
      ).rejects.toThrow();
    });

    it('records AiRun metadata on successful SCRIBE+GUIDE calls', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockGeminiResponse),
        },
      });

      await service.generateFullReading(mockUserProfile, mockOrderContext);

      expect(aiRunService.recordRun).toHaveBeenCalled();
      expect(aiRunService.recordRun.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          agent: 'SCRIBE',
          mission: AiMission.READING_GENERATION,
          status: 'SUCCESS',
        }),
      );
    });
  });

  describe('generateCoreReading multimodal', () => {
    it('routes multimodal SCRIBE through the same execution context as text', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              pdf_content: mockGeminiResponse.pdf_content,
              synthesis: mockGeminiResponse.synthesis,
            }),
        },
      });

      jest
        .spyOn(
          service as unknown as { fetchImageAsBase64: () => Promise<string> },
          'fetchImageAsBase64',
        )
        .mockResolvedValue('ZmFrZS1pbWFnZQ==');

      await service.generateCoreReading(
        { ...mockUserProfile, facePhotoUrl: 'https://example.com/face.jpg' },
        mockOrderContext,
      );

      expect(aiExecutionResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: 'SCRIBE',
          mission: AiMission.READING_GENERATION,
          orderId: mockOrderContext.orderId,
          productLevel: mockOrderContext.productLevel,
        }),
        expect.any(Object),
      );
      expect(mockGenerateContent).toHaveBeenCalled();
    });
  });
});
