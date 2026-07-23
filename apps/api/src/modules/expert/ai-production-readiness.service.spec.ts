import { ExpertRole } from '@prisma/client';
import { DEFAULT_AI_MODEL_CONFIG } from '../../services/factory/ai-model-config';
import { AiProductionReadinessService } from './ai-production-readiness.service';

const modelConfig = DEFAULT_AI_MODEL_CONFIG;

type RunFixture = {
  id: string;
  orderId: string;
  agent: string;
  mission: string;
  provider: string;
  model: string;
  routingSource: string;
  status: 'SUCCESS' | 'ERROR';
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCost: number | null;
  durationMs: number;
  errorCode: string | null;
  startedAt: Date;
};

const successfulRuns: RunFixture[] = [
  {
    id: 'run-scribe',
    orderId: 'order-1',
    agent: 'SCRIBE',
    mission: 'READING_GENERATION',
    provider: 'openai',
    model: 'gpt-5.5-2026-04-23',
    routingSource: 'global:SCRIBE',
    status: 'SUCCESS',
    inputTokens: 100,
    outputTokens: 200,
    estimatedCost: 0.0065,
    durationMs: 1000,
    errorCode: null,
    startedAt: new Date('2026-07-20T12:02:00Z'),
  },
  {
    id: 'run-guide',
    orderId: 'order-1',
    agent: 'GUIDE',
    mission: 'TIMELINE_BATCH',
    provider: 'openai',
    model: 'gpt-5.4-2026-03-05',
    routingSource: 'global:GUIDE',
    status: 'SUCCESS',
    inputTokens: 50,
    outputTokens: 100,
    estimatedCost: 0.001625,
    durationMs: 800,
    errorCode: null,
    startedAt: new Date('2026-07-20T12:03:00Z'),
  },
  {
    id: 'run-narrator',
    orderId: 'order-1',
    agent: 'NARRATOR',
    mission: 'AUDIO_NARRATION',
    provider: 'openai',
    model: 'gpt-4o-2024-11-20',
    routingSource: 'global:NARRATOR',
    status: 'SUCCESS',
    inputTokens: 100,
    outputTokens: 100,
    estimatedCost: 0.00125,
    durationMs: 600,
    errorCode: null,
    startedAt: new Date('2026-07-20T12:04:00Z'),
  },
];

const completedOrder = {
  id: 'order-1',
  orderNumber: 'LUM-000001',
  updatedAt: new Date('2026-07-20T12:05:00Z'),
  files: [{ id: 'audio-1', key: 'audio/readings/LUM-000001/reading.mp3', size: 2048 }],
  deliveries: [
    {
      id: 'delivery-1',
      pdfKey: 'readings/LUM-000001/reading.pdf',
      emailStatus: 'SENT',
    },
  ],
};

describe('AiProductionReadinessService', () => {
  function createService(options?: {
    adminRole?: ExpertRole;
    activeAdminCount?: number;
    activeRules?: unknown[];
    text?: 'ok' | 'error' | 'not_tested';
    multimodal?: 'ok' | 'error' | 'not_tested';
    runs?: RunFixture[];
    completedOrder?: typeof completedOrder | null;
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
    const runs = options?.runs ?? successfulRuns;
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
      order: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options?.completedOrder === undefined ? completedOrder : options.completedOrder,
          ),
      },
    };
    const text = options?.text ?? 'ok';
    const multimodal = options?.multimodal ?? 'ok';
    const diagnostics = {
      getCredentialsStatus: jest.fn().mockResolvedValue({
        openai: {
          configured: true,
          text,
          multimodal,
          structured: text,
          model: 'gpt-5.5-2026-04-23',
          state: text === 'ok' && multimodal !== 'error' ? 'connection_ok' : 'test_failed',
          envVar: 'OPENAI_API_KEY',
        },
        gemini: {
          configured: false,
          text: 'not_tested',
          multimodal: 'not_tested',
          structured: 'not_tested',
          model: 'gemini-2.5-flash',
          state: 'not_configured',
          envVar: 'GEMINI_API_KEY',
        },
        vertex: {
          configured: false,
          text: 'not_tested',
          multimodal: 'not_tested',
          structured: 'not_tested',
          model: 'gemini-2.5-pro',
          state: 'not_configured',
          envVar: 'VERTEX_CREDENTIALS_JSON',
        },
        modelProbes: [
          {
            provider: 'openai',
            model: 'gpt-5.5-2026-04-23',
            configured: true,
            text,
            multimodal,
            structured: text,
          },
          {
            provider: 'openai',
            model: 'gpt-5.4-2026-03-05',
            configured: true,
            text,
            multimodal: 'not_tested',
            structured: text,
          },
          {
            provider: 'openai',
            model: 'gpt-4o-2024-11-20',
            configured: true,
            text,
            multimodal: 'not_tested',
            structured: text,
          },
        ],
      }),
    };
    return new AiProductionReadinessService(
      prisma as never,
      diagnostics as never,
      { get: jest.fn(() => 'us-central1') } as never,
    );
  }

  it('returns GO only when tests, tracked agents, PDF and audio all pass', async () => {
    const result = await createService().getReadiness();
    expect(result.verdict).toBe('GO');
    expect(result.ready).toBe(true);
    expect(result.summary.failures).toBe(0);
    expect(result.summary.warnings).toBe(0);
    expect(result.effectiveConfig.agents.SCRIBE.model).toBe('gpt-5.5-2026-04-23');
    expect(result.checks.find((check) => check.id === 'run_scribe')?.level).toBe('pass');
    expect(result.checks.find((check) => check.id === 'run_guide')?.level).toBe('pass');
    expect(result.checks.find((check) => check.id === 'run_narrator')?.level).toBe('pass');
    expect(result.checks.find((check) => check.id === 'pipeline_assets')?.level).toBe('pass');
    expect(result.recentRunSummary.estimatedCost).toBe(0.009375);
  });

  it('does not require OpenAI when no active agent uses it', async () => {
    const googleOnly = {
      providerMode: 'per_agent' as const,
      agents: {
        ...modelConfig.agents,
        SCRIBE: {
          ...modelConfig.agents.SCRIBE,
          provider: 'vertex' as const,
          model: 'gemini-2.5-pro',
          temperature: 0.7,
          topP: 0.9,
        },
        EDITOR: {
          ...modelConfig.agents.EDITOR,
          provider: 'gemini' as const,
          model: 'gemini-2.5-flash',
          temperature: 0.4,
          topP: 0.9,
        },
        GUIDE: {
          ...modelConfig.agents.GUIDE,
          provider: 'gemini' as const,
          model: 'gemini-2.5-flash',
          temperature: 0.5,
          topP: 0.9,
        },
        NARRATOR: {
          ...modelConfig.agents.NARRATOR,
          provider: 'gemini' as const,
          model: 'gemini-2.5-flash',
        },
        CONFIDANT: { ...modelConfig.agents.CONFIDANT, enabled: false },
        ONIRIQUE: { ...modelConfig.agents.ONIRIQUE, enabled: false },
      },
    };
    const activePrompts = [
      {
        id: 'model-config',
        key: 'MODEL_CONFIG',
        version: 1,
        value: JSON.stringify(googleOnly),
        changedBy: 'test',
        comment: 'google',
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
    const prisma = {
      expert: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'expert@oraclelumira.com',
          role: ExpertRole.ADMIN,
          isActive: true,
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      promptVersion: { findMany: jest.fn().mockResolvedValue(activePrompts) },
      aiRoutingRule: { findMany: jest.fn().mockResolvedValue([]) },
      aiRun: { findMany: jest.fn().mockResolvedValue([]) },
      order: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const diagnostics = {
      getCredentialsStatus: jest.fn().mockResolvedValue({
        openai: {
          configured: false,
          text: 'not_tested',
          multimodal: 'not_tested',
          model: 'gpt-5.5-2026-04-23',
          state: 'not_configured',
          envVar: 'OPENAI_API_KEY',
        },
        gemini: {
          configured: true,
          text: 'ok',
          multimodal: 'ok',
          structured: 'ok',
          model: 'gemini-2.5-flash',
          state: 'connection_ok',
          envVar: 'GEMINI_API_KEY',
        },
        vertex: {
          configured: true,
          text: 'ok',
          multimodal: 'ok',
          structured: 'ok',
          model: 'gemini-2.5-pro',
          state: 'connection_ok',
          envVar: 'VERTEX_CREDENTIALS_JSON',
          location: 'us-central1',
        },
        modelProbes: [
          {
            provider: 'vertex',
            model: 'gemini-2.5-pro',
            configured: true,
            text: 'ok',
            multimodal: 'ok',
            structured: 'ok',
          },
          {
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            configured: true,
            text: 'ok',
            multimodal: 'not_tested',
            structured: 'ok',
          },
        ],
      }),
    };
    const result = await new AiProductionReadinessService(
      prisma as never,
      diagnostics as never,
      { get: jest.fn(() => 'us-central1') } as never,
    ).getReadiness();

    expect(result.checks.find((check) => check.id === 'openai_key')).toBeUndefined();
    expect(result.checks.find((check) => check.id === 'gemini_key')?.level).toBe('pass');
    expect(result.checks.find((check) => check.id === 'vertex_key')?.level).toBe('pass');
    expect(result.verdict).toBe('CONDITIONAL_GO');
  });

  it('returns NO_GO when structured probe fails for an active Google model', async () => {
    const googleOnly = {
      providerMode: 'per_agent' as const,
      agents: {
        ...modelConfig.agents,
        SCRIBE: {
          ...modelConfig.agents.SCRIBE,
          provider: 'vertex' as const,
          model: 'gemini-2.5-pro',
          temperature: 0.7,
          topP: 0.9,
        },
        EDITOR: { ...modelConfig.agents.EDITOR, enabled: false },
        GUIDE: {
          ...modelConfig.agents.GUIDE,
          provider: 'gemini' as const,
          model: 'gemini-2.5-flash',
          temperature: 0.5,
          topP: 0.9,
        },
        NARRATOR: { ...modelConfig.agents.NARRATOR, enabled: false },
        CONFIDANT: { ...modelConfig.agents.CONFIDANT, enabled: false },
        ONIRIQUE: { ...modelConfig.agents.ONIRIQUE, enabled: false },
      },
    };
    const prisma = {
      expert: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'expert@oraclelumira.com',
          role: ExpertRole.ADMIN,
          isActive: true,
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      promptVersion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'model-config',
            key: 'MODEL_CONFIG',
            version: 1,
            value: JSON.stringify(googleOnly),
            changedBy: 'test',
            comment: 'google',
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
        ]),
      },
      aiRoutingRule: { findMany: jest.fn().mockResolvedValue([]) },
      aiRun: { findMany: jest.fn().mockResolvedValue([]) },
      order: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const diagnostics = {
      getCredentialsStatus: jest.fn().mockResolvedValue({
        openai: {
          configured: false,
          text: 'not_tested',
          multimodal: 'not_tested',
          structured: 'not_tested',
          model: 'gpt-5.5-2026-04-23',
          state: 'not_configured',
          envVar: 'OPENAI_API_KEY',
        },
        gemini: {
          configured: true,
          text: 'ok',
          multimodal: 'not_tested',
          structured: 'error',
          model: 'gemini-2.5-flash',
          state: 'test_failed',
          envVar: 'GEMINI_API_KEY',
        },
        vertex: {
          configured: true,
          text: 'ok',
          multimodal: 'ok',
          structured: 'ok',
          model: 'gemini-2.5-pro',
          state: 'connection_ok',
          envVar: 'VERTEX_CREDENTIALS_JSON',
          location: 'us-central1',
        },
        modelProbes: [
          {
            provider: 'vertex',
            model: 'gemini-2.5-pro',
            configured: true,
            text: 'ok',
            multimodal: 'ok',
            structured: 'ok',
          },
          {
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            configured: true,
            text: 'ok',
            multimodal: 'not_tested',
            structured: 'error',
          },
        ],
      }),
    };
    const result = await new AiProductionReadinessService(
      prisma as never,
      diagnostics as never,
      { get: jest.fn(() => 'us-central1') } as never,
    ).getReadiness();

    expect(result.verdict).toBe('NO_GO');
    expect(result.checks.find((check) => check.id === 'agent_guide')?.level).toBe('fail');
    expect(result.checks.find((check) => check.id === 'agent_scribe')?.level).toBe('pass');
  });

  it('returns CONDITIONAL_GO before a tracked complete generation', async () => {
    const result = await createService({ runs: [], completedOrder: null }).getReadiness();
    expect(result.verdict).toBe('CONDITIONAL_GO');
    expect(result.ready).toBe(false);
    expect(result.checks.find((check) => check.id === 'run_scribe')?.level).toBe('warning');
    expect(result.checks.find((check) => check.id === 'pipeline_assets')?.level).toBe('warning');
  });

  it('returns NO_GO when vision fails', async () => {
    const result = await createService({ multimodal: 'error' }).getReadiness();
    expect(result.verdict).toBe('NO_GO');
    expect(result.checks.find((check) => check.id === 'openai_vision')?.level).toBe('fail');
  });

  it('returns NO_GO when a tracked agent has an error and no success', async () => {
    const runs: RunFixture[] = [
      ...successfulRuns.filter((run) => run.agent !== 'GUIDE'),
      {
        ...successfulRuns[1],
        id: 'run-guide-error',
        status: 'ERROR',
        inputTokens: null,
        outputTokens: null,
        estimatedCost: null,
        errorCode: 'GUIDE structured output invalid',
      },
    ];
    const result = await createService({ runs }).getReadiness();
    expect(result.verdict).toBe('NO_GO');
    expect(result.checks.find((check) => check.id === 'run_guide')?.level).toBe('fail');
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
