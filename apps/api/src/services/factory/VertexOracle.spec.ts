import { ConfigService } from '@nestjs/config';
import { AiMission, ProductLevel } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { AiExecutionResolverService } from './ai-execution-resolver.service';
import { AiRunService } from './ai-run.service';
import { AiRuntimeCacheService } from './ai-runtime-cache.service';
import { OrderContext, UserProfile, VertexOracle } from './VertexOracle';

jest.mock('axios');
jest.mock('openai', () => ({ __esModule: true, default: jest.fn() }));

describe('VertexOracle OpenAI-only runtime', () => {
  let service: VertexOracle;
  let responsesCreate: jest.Mock;
  let recordRun: jest.Mock;
  let resolver: jest.Mock;

  const userProfile: UserProfile = {
    userId: 'user-123',
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean@example.com',
    birthDate: '1990-01-01',
    birthTime: '12:00',
    birthPlace: 'Paris, France',
    specificQuestion: 'Quelle direction professionnelle est juste pour moi ?',
    objective: 'Clarifier mon prochain choix',
  };

  const orderContext: OrderContext = {
    orderId: 'order-123',
    orderNumber: 'ORD-001',
    level: 1,
    productName: 'Accès Lumira',
    productLevel: ProductLevel.INITIE,
  };

  const sections = [
    'spirituel',
    'relations',
    'mission',
    'creativite',
    'emotions',
    'travail',
    'sante',
    'finance',
  ].map((domain) => ({ domain, title: `Titre ${domain}`, content: `Contenu ${domain}` }));

  const coreResponse = {
    pdf_content: {
      introduction: 'Introduction personnalisée',
      archetype_reveal: 'Le Sage se manifeste par une recherche de cohérence.',
      sections,
      karmic_insights: ['Comprendre avant d’agir'],
      life_mission: 'Transformer la compréhension en décisions concrètes.',
      rituals: [
        {
          name: 'Écriture claire',
          description: 'Un temps court de clarification.',
          instructions: ['Écrire la décision', 'Nommer la peur', 'Choisir une action'],
        },
      ],
      conclusion: 'Avance avec précision et souplesse.',
    },
    synthesis: {
      archetype: 'Le Sage',
      keywords: ['clarté', 'discernement', 'mesure', 'transmission', 'ancrage'],
      emotional_state: 'Une tension entre prudence et passage à l’action.',
      key_blockage: 'Attendre une certitude totale avant de décider.',
    },
  };

  const timeline = Array.from({ length: 10 }, (_, index) => ({
    day: index + 1,
    title: `Jour ${index + 1}`,
    action: `Action ${index + 1}`,
    mantra: `Mantra ${index + 1}`,
    actionType: index % 2 === 0 ? 'MEDITATION' : 'JOURNALING',
  }));

  beforeEach(async () => {
    responsesCreate = jest.fn();
    recordRun = jest.fn().mockResolvedValue(undefined);
    resolver = jest.fn(async (ctx, snapshot) => {
      const config = snapshot.modelConfig.agents[ctx.agent];
      return {
        provider: 'openai',
        model: config.model,
        temperature: config.temperature,
        topP: config.topP,
        maxTokens: config.maxOutputTokens,
        reasoningEffort: config.reasoningEffort,
        verbosity: config.verbosity,
        systemPrompt: `${snapshot.lumiraDna}\n\n---\n\n${snapshot.agentContexts[ctx.agent]}`,
        routingSource: `global:${ctx.agent}`,
      };
    });

    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
      responses: { create: responsesCreate },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VertexOracle,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'OPENAI_API_KEY') return 'test-openai-key';
              return defaultValue;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            promptVersion: { findMany: jest.fn().mockResolvedValue([]) },
            systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
            aiRun: { aggregate: jest.fn().mockResolvedValue({ _sum: { estimatedCost: 0.01 } }) },
          },
        },
        {
          provide: AiExecutionResolverService,
          useValue: { resolve: resolver },
        },
        {
          provide: AiRunService,
          useValue: { recordRun },
        },
        {
          provide: AiRuntimeCacheService,
          useValue: { registerInvalidator: jest.fn(), invalidateAll: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(VertexOracle);
    jest.clearAllMocks();
  });

  it('generates SCRIBE and GUIDE through strict Responses schemas', async () => {
    responsesCreate
      .mockResolvedValueOnce({
        status: 'completed',
        output_text: JSON.stringify(coreResponse),
        usage: { input_tokens: 100, output_tokens: 200 },
      })
      .mockResolvedValueOnce({
        status: 'completed',
        output_text: JSON.stringify({ timeline }),
        usage: { input_tokens: 50, output_tokens: 100 },
      });

    const result = await service.generateFullReading(userProfile, orderContext);

    expect(result).toEqual({ ...coreResponse, timeline });
    expect(responsesCreate).toHaveBeenCalledTimes(2);
    expect(responsesCreate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        model: 'gpt-5.5-2026-04-23',
        store: false,
        reasoning: { effort: 'high' },
        text: expect.objectContaining({
          verbosity: 'high',
          format: expect.objectContaining({ type: 'json_schema', strict: true }),
        }),
      }),
    );
    expect(responsesCreate.mock.calls[0][0]).not.toHaveProperty('temperature');
    expect(responsesCreate.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        model: 'gpt-5.4-2026-03-05',
        reasoning: { effort: 'low' },
      }),
    );
    expect(recordRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'SCRIBE',
        mission: AiMission.READING_GENERATION,
        status: 'SUCCESS',
        inputTokens: 100,
        outputTokens: 200,
      }),
    );
  });

  it('sends face then palm with real MIME types and high detail', async () => {
    responsesCreate.mockResolvedValue({
      status: 'completed',
      output_text: JSON.stringify(coreResponse),
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    const fetchImage = jest
      .spyOn(
        service as unknown as {
          fetchImageAsBase64: (url: string) => Promise<{
            base64: string;
            mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
          }>;
        },
        'fetchImageAsBase64',
      )
      .mockResolvedValueOnce({ base64: 'ZmFjZQ==', mimeType: 'image/png' })
      .mockResolvedValueOnce({ base64: 'cGFsbQ==', mimeType: 'image/webp' });

    await service.generateCoreReading(
      {
        ...userProfile,
        facePhotoUrl: 'https://example.com/face.png',
        palmPhotoUrl: 'https://example.com/palm.webp',
      },
      orderContext,
    );

    expect(fetchImage).toHaveBeenNthCalledWith(1, 'https://example.com/face.png');
    expect(fetchImage).toHaveBeenNthCalledWith(2, 'https://example.com/palm.webp');
    const content = responsesCreate.mock.calls[0][0].input[0].content;
    expect(content[1]).toEqual(
      expect.objectContaining({
        type: 'input_image',
        detail: 'high',
        image_url: expect.stringContaining('data:image/png;base64,ZmFjZQ=='),
      }),
    );
    expect(content[2]).toEqual(
      expect.objectContaining({
        type: 'input_image',
        detail: 'high',
        image_url: expect.stringContaining('data:image/webp;base64,cGFsbQ=='),
      }),
    );
  });

  it('rejects duplicate or missing SCRIBE domains even after structured output', async () => {
    responsesCreate.mockResolvedValue({
      status: 'completed',
      output_text: JSON.stringify({
        ...coreResponse,
        pdf_content: {
          ...coreResponse.pdf_content,
          sections: sections.map((section) => ({ ...section, domain: 'spirituel' })),
        },
      }),
    });

    await expect(service.generateCoreReading(userProfile, orderContext)).rejects.toThrow(
      'huit domaines uniques',
    );
  });

  it('rejects invalid GUIDE day numbering', async () => {
    responsesCreate.mockResolvedValue({
      status: 'completed',
      output_text: JSON.stringify({
        timeline: timeline.map((day, index) => ({ ...day, day: index + 2 })),
      }),
    });

    await expect(
      service.generateTimelineBatch(userProfile, coreResponse.synthesis, 1),
    ).rejects.toThrow('jour invalide');
  });

  it('keeps expert guidance and complementary instructions separate', () => {
    const prompt = (
      service as unknown as {
        buildScribePrompt: (profile: UserProfile, order: OrderContext) => string;
      }
    ).buildScribePrompt(userProfile, {
      ...orderContext,
      expertPrompt: 'Guidance principale',
      expertInstructions: 'Domaines à approfondir',
    });

    expect(prompt).toContain('=== GUIDANCE PRINCIPALE DE L’EXPERT ===\nGuidance principale');
    expect(prompt).toContain(
      '=== INSTRUCTIONS COMPLÉMENTAIRES DE L’EXPERT ===\nDomaines à approfondir',
    );
  });

  it('injects usage name, marking period and life weather into the SCRIBE prompt', () => {
    const prompt = (
      service as unknown as {
        buildScribePrompt: (profile: UserProfile, order: OrderContext) => string;
      }
    ).buildScribePrompt(
      {
        ...userProfile,
        usageName: 'Jeannot',
        lifeEvents: 'Vers 2018, une rupture qui a tout changé.',
        lifeAreas: {
          relations: { state: 'TENDU', note: 'séparation en cours' },
          travail: { state: 'EN_QUESTION' },
          corps: { state: 'FLUIDE' },
        },
      },
      orderContext,
    );

    expect(prompt).toContain("Prénom d'usage ou surnom (pour la symbolique du nom): Jeannot");
    expect(prompt).toContain(
      'Période ou événement de vie marquant déclaré: Vers 2018, une rupture qui a tout changé.',
    );
    expect(prompt).toContain('=== MÉTÉO DE VIE DÉCLARÉE PAR DOMAINE ===');
    expect(prompt).toContain('Relations & famille: tendu — séparation en cours');
    expect(prompt).toContain('Travail & argent: en question');
    expect(prompt).toContain('Corps & énergie: fluide');
  });

  it('omits life weather section when no life areas are declared', () => {
    const prompt = (
      service as unknown as {
        buildScribePrompt: (profile: UserProfile, order: OrderContext) => string;
      }
    ).buildScribePrompt(userProfile, orderContext);

    expect(prompt).not.toContain('MÉTÉO DE VIE');
    expect(prompt).not.toContain("Prénom d'usage");
  });

  it('records a tracked error for an empty provider response', async () => {
    responsesCreate.mockResolvedValue({ status: 'completed', output_text: '' });

    await expect(service.generateCoreReading(userProfile, orderContext)).rejects.toThrow(
      'Réponse OpenAI vide',
    );
    expect(recordRun).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'SCRIBE', status: 'ERROR' }),
    );
  });
});
