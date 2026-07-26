import { ConfigService } from '@nestjs/config';
import { AiMission, ProductLevel } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { AiExecutionResolverService } from './ai-execution-resolver.service';
import { AiRunService } from './ai-run.service';
import { AiRuntimeCacheService } from './ai-runtime-cache.service';
import { OrderContext, UserProfile, VertexOracle } from './VertexOracle';
import { DEFAULT_AI_MODEL_CONFIG } from './ai-model-config';
import { AiModelConfigSnapshot } from './ai-execution.types';

jest.mock('axios');
jest.mock('openai', () => ({ __esModule: true, default: jest.fn() }));

function testedModelConfig(): AiModelConfigSnapshot {
  return {
    providerMode: DEFAULT_AI_MODEL_CONFIG.providerMode,
    agents: Object.fromEntries(
      Object.entries(DEFAULT_AI_MODEL_CONFIG.agents).map(([agent, config]) => [
        agent,
        config.enabled
          ? {
              ...config,
              needsValidation: false,
              validation: {
                provider: config.provider,
                model: config.model,
                checkedAt: '2026-07-25T00:00:00.000Z',
                probeVersion: 1,
                capabilities: { text: true, vision: true, structured: true },
              },
            }
          : { ...config },
      ]),
    ) as AiModelConfigSnapshot['agents'],
  };
}

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
    level: ProductLevel.INITIE,
    productName: 'Accès Lumira',
    productLevel: ProductLevel.INITIE,
  };

  const domainTexts: Record<string, string> = {
    spirituel:
      "Dans la dimension spirituelle, votre parcours d'âme s'illumine par une quête sincère de sagesse. " +
      "Les symboles perçus témoignent d'une intuition profonde qui cherche à se manifester dans la sérénité du quotidien. " +
      'Prenez le temps de méditer chaque jour pour écouter les messages subtils qui vous parviennent. ' +
      'Cette pratique régulière clarifiera vos doutes et fortifiera votre ancrage intérieur. ',
    relations:
      'Sur le plan relationnel, la sincérité et le respect mutuel occupent une place centrale dans vos échanges. ' +
      "Vous aspirez à des liens authentiques débarrassés des jeux de pouvoir ou d'illusion. " +
      "Offrez-vous la liberté d'exprimer vos sentiments les plus profonds sans crainte du jugement. ",
    mission:
      "Votre mission de vie réside dans la transmission d'une présence apaisante et clarifiante pour autrui. " +
      'En accordant vos actions à vos convictions éthiques, vous devenez un repère pour votre entourage. ' +
      'Suivez la voix de votre conscience pour orienter vos engagements futurs avec conviction. ',
    creativite:
      "L'élan créatif représente un canal privilégié pour extérioriser votre richesse émotionnelle. " +
      "Que vous écriviez, dessiniez ou conçouriez de nouveaux projets, votre imagination fait preuve d'une belle vitalité. " +
      "La création pure régénère votre énergie vitale et apporte un sentiment d'accomplissement. ",
    emotions:
      'Le paysage émotionnel traversé ces derniers mois montre une maturité croissante et une sensibilité accueillie. ' +
      "Apprendre à observer vos états d'âme sans les juger favorise une paix durable. " +
      'En accueillant toutes vos facettes, vous gagnez une solidité remarquable. ',
    travail:
      'Dans la sphère professionnelle, la recherche de sens prévaut sur la simple exécution de tâches. ' +
      "Votre rigueur et votre capacité d'organisation suscitent l'estime de vos partenaires. " +
      'Gardez le cap sur vos véritables ambitions à long terme. ',
    sante:
      'La santé et la vitalité globale nécessitent un équilibre harmonieux entre repos, alimentation et mouvement. ' +
      "Écouter les signaux du corps permet d'anticiper la fatigue avant qu'elle ne s'installe. " +
      'Prenez soin de votre temple physique avec régularité. ',
    finance:
      'La dimension financière appelle une vision claire et une gestion mesurée de vos avoirs. ' +
      'En canalisant vos dépenses vers ce qui compte vraiment, vous consolidez votre sécurité matérielle. ' +
      "Structurez vos projets d'investissement avec méthode pour assurer un avenir serein. ",
  };

  const domainSuffixes: Record<string, string[]> = {
    spirituel: [
      'Progression 1.',
      'Progression 2.',
      'Progression 3.',
      'Progression 4.',
      'Progression 5.',
      'Progression 6.',
      'Progression 7.',
    ],
    relations: [
      'Chemin 1.',
      'Chemin 2.',
      'Chemin 3.',
      'Chemin 4.',
      'Chemin 5.',
      'Chemin 6.',
      'Chemin 7.',
    ],
    mission: ['Voie 1.', 'Voie 2.', 'Voie 3.', 'Voie 4.', 'Voie 5.', 'Voie 6.', 'Voie 7.'],
    creativite: ['Élan 1.', 'Élan 2.', 'Élan 3.', 'Élan 4.', 'Élan 5.', 'Élan 6.', 'Élan 7.'],
    emotions: [
      'Accueil 1.',
      'Accueil 2.',
      'Accueil 3.',
      'Accueil 4.',
      'Accueil 5.',
      'Accueil 6.',
      'Accueil 7.',
    ],
    travail: [
      'Alignement 1.',
      'Alignement 2.',
      'Alignement 3.',
      'Alignement 4.',
      'Alignement 5.',
      'Alignement 6.',
      'Alignement 7.',
    ],
    sante: [
      'Vitalité 1.',
      'Vitalité 2.',
      'Vitalité 3.',
      'Vitalité 4.',
      'Vitalité 5.',
      'Vitalité 6.',
      'Vitalité 7.',
    ],
    finance: [
      'Gestion 1.',
      'Gestion 2.',
      'Gestion 3.',
      'Gestion 4.',
      'Gestion 5.',
      'Gestion 6.',
      'Gestion 7.',
    ],
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
  ].map((domain) => ({
    domain,
    title: `Titre ${domain}`,
    content: (domainSuffixes[domain] || [])
      .map((suffix) => `${domainTexts[domain] || ''}${suffix}`)
      .join(' '),
  }));

  const coreResponse = {
    pdf_content: {
      introduction: 'Introduction personnalisée',
      archetype_reveal: 'Le Sage se manifeste par une recherche de cohérence.',
      sections,
      karmic_insights: [
        'Comprendre avant d’agir pour éviter la précipitation inutile.',
        'La patience active dénoue les blocages les plus anciens avec douceur.',
        'Accueillir les imprévus comme des opportunités d’apprentissage conscient.',
        'Exprimer sa vérité intérieure sans crainte du jugement d’autrui.',
      ],
      life_mission: 'Transformer la compréhension en décisions concrètes.',
      rituals: [
        {
          name: 'Rituel d’Ancrage du Matin',
          description: 'Un temps court de clarification et de récente respiration.',
          instructions: [
            'Écrire la décision',
            'Nommer la peur',
            'Choisir une action',
            'Respirer profondément',
          ],
        },
        {
          name: 'Rituel d’Alignement du Soir',
          description: 'Bilan calme des actions menées et gratitude sincère.',
          instructions: [
            'Passer en revue la journée',
            'Noter 3 gratitudes',
            'Libérer les tensions',
            'Poser une intention',
          ],
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
        maxTokens: config.maxOutputTokens,
        thinkingLevel: config.thinkingLevel,
        systemPrompt: `${snapshot.lumiraDna}\n\n---\n\n${snapshot.agentContexts[ctx.agent]}`,
        routingSource: `model-config:${ctx.agent}`,
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
            promptVersion: {
              findMany: jest
                .fn()
                .mockResolvedValue([
                  { key: 'MODEL_CONFIG', value: JSON.stringify(testedModelConfig()) },
                ]),
            },
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

    expect(result).toEqual({ ...coreResponse, timeline, pipeline: expect.any(Object) });
    expect(responsesCreate).toHaveBeenCalledTimes(2);
    expect(responsesCreate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        model: 'gpt-5.5-2026-04-23',
        store: false,
        reasoning: { effort: 'high' },
        text: expect.objectContaining({
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

    const result = await service.generateCoreReading(userProfile, orderContext);
    expect(result.pipeline?.qualityStatus).toBe('BLOCKED');
    expect(result.pipeline?.blockingIssues.some((i) => i.code === 'DOMAINS_NOT_UNIQUE')).toBe(true);
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

  it('treats local timeout and abort as non-retryable', () => {
    expect(service.isRetryableProviderError(new Error('[SCRIBE] timeout après 300000ms'))).toBe(
      false,
    );
    expect(service.isRetryableProviderError(new Error('The operation was aborted'))).toBe(false);
    expect(
      service.isRetryableProviderError(Object.assign(new Error('rate limited'), { status: 429 })),
    ).toBe(true);
  });

  it('does not retry after a local timeout (single provider attempt)', async () => {
    let attempts = 0;
    await expect(
      (
        service as unknown as {
          executeWithRetry: <T>(
            agent: string,
            operation: (signal: AbortSignal) => Promise<T>,
            timeoutMs: number,
          ) => Promise<T>;
        }
      ).executeWithRetry(
        'SCRIBE',
        async (signal) => {
          attempts += 1;
          await new Promise<never>((_, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
          });
          return 'never' as never;
        },
        20,
      ),
    ).rejects.toThrow(/timeout après 20ms/);
    expect(attempts).toBe(1);
  });

  describe('Atomic MODEL_CONFIG loading & validation', () => {
    it('throws AI_MODEL_CONFIG_INVALID on cold start if MODEL_CONFIG is invalid', async () => {
      const mockPrisma = {
        promptVersion: {
          findMany: jest.fn().mockResolvedValue([
            {
              key: 'MODEL_CONFIG',
              value: JSON.stringify({
                providerMode: 'per_agent',
                agents: {
                  ...DEFAULT_AI_MODEL_CONFIG.agents,
                  SCRIBE: {
                    enabled: true,
                    provider: 'openai',
                    model: 'gpt-4o-2024-11-20',
                  },
                },
              }),
            },
          ]),
        },
      };

      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          VertexOracle,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, fallback?: string) =>
                key === 'AWS_REGION' ? 'eu-west-3' : (fallback ?? ''),
            },
          },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: AiExecutionResolverService, useValue: {} },
          { provide: AiRunService, useValue: { recordRun: jest.fn() } },
          { provide: AiRuntimeCacheService, useValue: { registerInvalidator: jest.fn() } },
        ],
      }).compile();

      const oracle = testModule.get(VertexOracle);
      await expect(
        (
          oracle as unknown as { loadRuntimeConfiguration: () => Promise<void> }
        ).loadRuntimeConfiguration(),
      ).rejects.toThrow(/AI_MODEL_CONFIG_INVALID/);
    });

    it('retains last valid in-memory configuration on warm state if new MODEL_CONFIG in DB is invalid', async () => {
      const mockPrisma = {
        promptVersion: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([
              {
                key: 'MODEL_CONFIG',
                value: JSON.stringify(testedModelConfig()),
              },
            ])
            .mockResolvedValueOnce([
              {
                key: 'MODEL_CONFIG',
                value: 'invalid-json-string',
              },
            ]),
        },
      };

      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          VertexOracle,
          {
            provide: ConfigService,
            useValue: {
              get: (key: string, fallback?: string) =>
                key === 'AWS_REGION' ? 'eu-west-3' : (fallback ?? ''),
            },
          },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: AiExecutionResolverService, useValue: {} },
          { provide: AiRunService, useValue: { recordRun: jest.fn() } },
          { provide: AiRuntimeCacheService, useValue: { registerInvalidator: jest.fn() } },
        ],
      }).compile();

      const oracle = testModule.get(VertexOracle);
      const privateOracle = oracle as unknown as {
        loadRuntimeConfiguration: () => Promise<void>;
        invalidateCache: () => void;
        modelConfig: typeof DEFAULT_AI_MODEL_CONFIG;
      };

      await privateOracle.loadRuntimeConfiguration();
      expect(privateOracle.modelConfig.agents.SCRIBE.model).toBe('gpt-5.5-2026-04-23');
      expect(privateOracle.modelConfig.agents.SCRIBE.validation?.capabilities.vision).toBe(true);

      privateOracle.invalidateCache();

      await expect(privateOracle.loadRuntimeConfiguration()).resolves.not.toThrow();
      expect(privateOracle.modelConfig.agents.SCRIBE.model).toBe('gpt-5.5-2026-04-23');
      expect(privateOracle.modelConfig.agents.SCRIBE.validation?.capabilities.vision).toBe(true);
    });

    it('returns an isolated copy of nested validation capabilities', async () => {
      const mockPrisma = {
        promptVersion: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { key: 'MODEL_CONFIG', value: JSON.stringify(testedModelConfig()) },
            ]),
        },
      };
      const testModule = await Test.createTestingModule({
        providers: [
          VertexOracle,
          { provide: ConfigService, useValue: { get: jest.fn() } },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: AiExecutionResolverService, useValue: {} },
          { provide: AiRunService, useValue: { recordRun: jest.fn() } },
          { provide: AiRuntimeCacheService, useValue: { registerInvalidator: jest.fn() } },
        ],
      }).compile();
      const oracle = testModule.get(VertexOracle);
      const privateOracle = oracle as unknown as {
        loadRuntimeConfiguration: () => Promise<void>;
      };

      await privateOracle.loadRuntimeConfiguration();
      const exposed = oracle.getModelConfig();
      exposed.agents.SCRIBE.validation!.capabilities.vision = false;

      expect(oracle.getModelConfig().agents.SCRIBE.validation?.capabilities.vision).toBe(true);
    });
  });
});
