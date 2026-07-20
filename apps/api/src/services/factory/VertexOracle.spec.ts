import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VertexOracle, UserProfile, OrderContext } from './VertexOracle';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
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
jest.mock('openai', () => ({ __esModule: true, default: jest.fn() }));

describe('VertexOracle', () => {
  let service: VertexOracle;
  let mockGenerateContent: jest.Mock;
  let mockResponsesCreate: jest.Mock;
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
    mockResponsesCreate = jest.fn();
    aiRunService = { recordRun: jest.fn().mockResolvedValue(undefined) };
    aiExecutionResolver = {
      resolve: jest.fn(async (ctx, snap) => ({
        provider: 'openai',
        model: ctx.agent === 'SCRIBE' ? 'gpt-5.5' : 'gpt-5.4',
        temperature: 0.8,
        topP: 0.95,
        maxTokens: 16384,
        reasoningEffort: ctx.agent === 'SCRIBE' ? 'high' : 'low',
        verbosity: ctx.agent === 'SCRIBE' ? 'high' : 'medium',
        systemPrompt: `${snap.lumiraDna}\n\n---\n\n${snap.agentContexts[ctx.agent]}`,
        routingSource: `global:${ctx.agent}`,
      })),
    };

    // Gemini remains dormant in V1; configuring it lets this test prove it is not used.
    (GoogleGenerativeAI as unknown as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn(() => ({
        generateContent: mockGenerateContent,
      })),
    }));
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      responses: { create: mockResponsesCreate },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VertexOracle,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'OPENAI_API_KEY') return 'test-openai-key';
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
            aiRun: {
              aggregate: jest.fn().mockResolvedValue({ _sum: { estimatedCost: 0.01 } }),
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
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify(mockGeminiResponse),
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      const result = await service.generateFullReading(mockUserProfile, mockOrderContext);

      expect(result).toEqual(mockGeminiResponse);
      expect(mockResponsesCreate).toHaveBeenCalled();
      expect(GoogleGenerativeAI).not.toHaveBeenCalled();
      expect(mockResponsesCreate.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          model: 'gpt-5.5',
          reasoning: { effort: 'high' },
          text: expect.objectContaining({ verbosity: 'high' }),
        }),
      );
      expect(mockResponsesCreate.mock.calls[0][0]).not.toHaveProperty('temperature');
    });

    it('should throw an error if Gemini returns empty content', async () => {
      mockResponsesCreate.mockResolvedValue({ output_text: '' });

      await expect(
        service.generateFullReading(mockUserProfile, mockOrderContext),
      ).rejects.toThrow();
    });

    it('records AiRun metadata on successful SCRIBE+GUIDE calls', async () => {
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify(mockGeminiResponse),
        usage: { input_tokens: 100, output_tokens: 200 },
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
      mockResponsesCreate.mockResolvedValue({
        output_text: JSON.stringify({
          pdf_content: mockGeminiResponse.pdf_content,
          synthesis: mockGeminiResponse.synthesis,
        }),
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      jest
        .spyOn(
          service as unknown as {
            fetchImageAsBase64: () => Promise<{ base64: string; mimeType: string }>;
          },
          'fetchImageAsBase64',
        )
        .mockResolvedValue({ base64: 'ZmFrZS1pbWFnZQ==', mimeType: 'image/png' });

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
      expect(mockResponsesCreate).toHaveBeenCalled();
      expect(mockResponsesCreate.mock.calls[0][0].input).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'input_image',
            detail: 'high',
            image_url: expect.stringContaining('data:image/png'),
          }),
        ]),
      );
    });
  });

  it('keeps expert guidance and complementary expert instructions separate in the SCRIBE prompt', () => {
    const prompt = (
      service as unknown as {
        buildScribePrompt: (profile: UserProfile, order: OrderContext) => string;
      }
    ).buildScribePrompt(mockUserProfile, {
      ...mockOrderContext,
      expertPrompt: 'Guidance principale',
      expertInstructions: 'Domaines à approfondir',
    });
    expect(prompt).toContain('=== GUIDANCE PRINCIPALE DE L’EXPERT ===\nGuidance principale');
    expect(prompt).toContain(
      '=== INSTRUCTIONS COMPLÉMENTAIRES DE L’EXPERT ===\nDomaines à approfondir',
    );
  });
});
