import { ExpertRole } from '@prisma/client';
import { AiProductionReadinessService } from './ai-production-readiness.service';

const modelConfig = {
  providerMode: 'openai_only',
  agents: {
    SCRIBE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.5',
      reasoningEffort: 'high',
      verbosity: 'high',
      maxOutputTokens: 24000,
    },
    EDITOR: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4',
      reasoningEffort: 'medium',
      verbosity: 'high',
      maxOutputTokens: 16000,
    },
    GUIDE: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.4',
      reasoningEffort: 'low',
      verbosity: 'medium',
      maxOutputTokens: 6000,
    },
    NARRATOR: {
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 12000,
    },
    CONFIDANT: {
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.6,
      topP: 0.9,
      maxOutputTokens: 1600,
    },
    ONIRIQUE: {
      enabled: false,
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.65,
      topP: 0.9,
      maxOutputTokens: 2500,
    },
  },
};

describe('AiProductionReadinessService', () => {
  function createService(options?: {
    adminRole?: ExpertRole;
    activeAdminCount?: number;
    activeRules?: unknown[];
    text?: 'ok' | 'error' | 'not_tested';
    multimodal?: 'ok' | 'error' | 'not_tested';
    runs?: unknown[];
  }) {
    const activePrompts = [
      {
        id: 'model-config',
        key: 'MODEL_CONFIG',
        version: 1,
        value: JSON.stringify(modelConfig),
        changedBy: 'test',
        comment: 'baseline',
        createdAt: new Date('2026-07-20T12:00:00Z'),
      },
      {
        id: 'guide',
        key: 'GUIDE',
        version: 2,
        value: 'Parcours pratique de 30 jours, batch de 10 jours.',
        changedBy: 'test',
        comment: 'guide',
        createdAt: new Date('2026-07-20T12:01:00Z'),
      },
    ];
    const runs = options?.runs ?? [
      {
        id: 'run-1',
        orderId: 'order-1',
        agent: 'SCRIBE',
        mission: 'READING_GENERATION',
        provider: 'openai',
        model: 'gpt-5.5',
        routingSource: 'global:SCRIBE',
        status: 'SUCCESS',
        inputTokens: 100,
        outputTokens: 200,
        estimatedCost: 0.0065,
        durationMs: 1000,
        errorCode: null,
        startedAt: new Date('2026-07-20T12:02:00Z'),
      },
    ];
    const prisma = {
      expert: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'expert@oraclelumira.com',
          role: options?.adminRole ?? ExpertRole.ADMIN,
          isActive: true,
        }),
        count: jest.fn().mockResolvedValue(options?.activeAdminCount ?? 1),
      },
      promptVersion: { findMany: jest.fn().mockResolvedValue(activePrompts) },
      aiRoutingRule: { findMany: jest.fn().mockResolvedValue(options?.activeRules ?? []) },
      aiRun: { findMany: jest.fn().mockResolvedValue(runs) },
    };
    const diagnostics = {
      getCredentialsStatus: jest.fn().mockResolvedValue({
        openai: {
          configured: true,
          text: options?.text ?? 'ok',
          multimodal: options?.multimodal ?? 'ok',
          model: 'gpt-5.5',
          state: 'connection_ok',
          envVar: 'OPENAI_API_KEY',
        },
        gemini: {
          configured: false,
          text: 'not_tested',
          multimodal: 'not_tested',
          model: 'gemini-2.5-flash',
          state: 'not_configured',
          envVar: 'GEMINI_API_KEY',
        },
      }),
    };
    return new AiProductionReadinessService(prisma as never, diagnostics as never);
  }

  it('returns GO only when all production checks and telemetry pass', async () => {
    const result = await createService().getReadiness();
    expect(result.verdict).toBe('GO');
    expect(result.ready).toBe(true);
    expect(result.summary.failures).toBe(0);
    expect(result.summary.warnings).toBe(0);
    expect(result.recentRunSummary.estimatedCost).toBe(0.0065);
  });

  it('returns CONDITIONAL_GO before the first tracked generation', async () => {
    const result = await createService({ runs: [] }).getReadiness();
    expect(result.verdict).toBe('CONDITIONAL_GO');
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.id === 'telemetry')?.level).toBe('warning');
  });

  it('returns NO_GO when vision fails', async () => {
    const result = await createService({ multimodal: 'error' }).getReadiness();
    expect(result.verdict).toBe('NO_GO');
    expect(result.checks.find((check) => check.id === 'openai_vision')?.level).toBe('fail');
  });

  it('returns NO_GO when another active admin exists', async () => {
    const result = await createService({ activeAdminCount: 2 }).getReadiness();
    expect(result.verdict).toBe('NO_GO');
    expect(result.checks.find((check) => check.id === 'canonical_admin')?.level).toBe('fail');
  });

  it('returns NO_GO when a legacy routing rule remains active', async () => {
    const result = await createService({ activeRules: [{ id: 'rule-1' }] }).getReadiness();
    expect(result.verdict).toBe('NO_GO');
    expect(result.checks.find((check) => check.id === 'routing_rules')?.level).toBe('fail');
  });
});
