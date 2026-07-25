import { BadRequestException } from '@nestjs/common';
import { AiMission, ProductLevel } from '@prisma/client';
import { AiExecutionResolverService, buildAiContext } from './ai-execution-resolver.service';
import { AiPromptSnapshot } from './ai-execution.types';

const baseSnapshot: AiPromptSnapshot = {
  lumiraDna: 'DNA',
  agentContexts: {
    SCRIBE: 'SCRIBE prompt',
    GUIDE: 'GUIDE prompt',
    EDITOR: 'EDITOR prompt',
    CONFIDANT: 'CONFIDANT prompt',
    ONIRIQUE: 'ONIRIQUE prompt',
    NARRATOR: 'NARRATOR prompt',
  },
  modelConfig: {
    providerMode: 'openai_only',
    agents: {
      SCRIBE: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.5-2026-04-23',
        reasoningEffort: 'high',
        verbosity: 'high',
        maxOutputTokens: 24000,
        validation: {
          provider: 'openai',
          model: 'gpt-5.5-2026-04-23',
          checkedAt: '2026-07-25T00:00:00.000Z',
          probeVersion: 1,
          capabilities: { text: true, vision: true, structured: true },
        },
      },
      GUIDE: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.4-2026-03-05',
        reasoningEffort: 'low',
        verbosity: 'medium',
        maxOutputTokens: 6000,
        validation: {
          provider: 'openai',
          model: 'gpt-5.4-2026-03-05',
          checkedAt: '2026-07-25T00:00:00.000Z',
          probeVersion: 1,
          capabilities: { text: true, vision: true, structured: true },
        },
      },
      EDITOR: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.4-2026-03-05',
        reasoningEffort: 'medium',
        verbosity: 'high',
        maxOutputTokens: 16000,
        validation: {
          provider: 'openai',
          model: 'gpt-5.4-2026-03-05',
          checkedAt: '2026-07-25T00:00:00.000Z',
          probeVersion: 1,
          capabilities: { text: true, vision: true, structured: true },
        },
      },
      NARRATOR: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.4-2026-03-05',
        thinkingLevel: 'low',
        reasoningEffort: 'low',
        verbosity: 'medium',
        maxOutputTokens: 12000,
        validation: {
          provider: 'openai',
          model: 'gpt-5.4-2026-03-05',
          checkedAt: '2026-07-25T00:00:00.000Z',
          probeVersion: 1,
          capabilities: { text: true, vision: true, structured: true },
        },
      },
      CONFIDANT: {
        enabled: false,
        provider: 'openai',
        model: 'gpt-4o-2024-11-20',
        temperature: 0.6,
        topP: 0.9,
        maxOutputTokens: 1600,
      },
      ONIRIQUE: {
        enabled: false,
        provider: 'openai',
        model: 'gpt-4o-2024-11-20',
        temperature: 0.65,
        topP: 0.9,
        maxOutputTokens: 2500,
      },
    },
  },
};

describe('AiExecutionResolverService', () => {
  let service: AiExecutionResolverService;
  let prisma: { promptVersion: { findUnique: jest.Mock } };

  beforeEach(() => {
    prisma = { promptVersion: { findUnique: jest.fn() } };
    service = new AiExecutionResolverService(prisma as never);
  });

  it('uses global agent config as the only source in openai_only mode', async () => {
    const resolved = await service.resolve(
      buildAiContext('SCRIBE', AiMission.READING_GENERATION, {
        productLevel: ProductLevel.INITIE,
      }),
      baseSnapshot,
    );

    expect(resolved.provider).toBe('openai');
    expect(resolved.model).toBe('gpt-5.5-2026-04-23');
    expect(resolved.reasoningEffort).toBe('high');
    expect(resolved.routingSource).toBe('model-config:SCRIBE');
  });

  it('rejects an invalid persisted model config before execution', async () => {
    const snapshot = {
      ...baseSnapshot,
      modelConfig: {
        providerMode: 'comparison',
        agents: {
          ...baseSnapshot.modelConfig.agents,
          SCRIBE: {
            enabled: true,
            provider: 'gemini',
            model: 'unknown-model',
            maxOutputTokens: -1,
          },
        },
      },
    } as unknown as AiPromptSnapshot;

    await expect(
      service.resolve(buildAiContext('SCRIBE', AiMission.READING_GENERATION), snapshot),
    ).rejects.toThrow(/modèle non autorisé|modèle non opérationnel|sélectionnez explicitement/);
  });

  it('rejects gpt-3.5-pro as non-operational model before provider call', async () => {
    const snapshot = {
      ...baseSnapshot,
      modelConfig: {
        ...baseSnapshot.modelConfig,
        agents: {
          ...baseSnapshot.modelConfig.agents,
          SCRIBE: {
            ...baseSnapshot.modelConfig.agents.SCRIBE,
            model: 'gpt-3.5-pro',
            maxOutputTokens: 8000,
          },
        },
      },
    } as unknown as AiPromptSnapshot;

    await expect(
      service.resolve(buildAiContext('SCRIBE', AiMission.READING_GENERATION), snapshot),
    ).rejects.toThrow(/modèle non autorisé|modèle non opérationnel|sélectionnez explicitement/);
  });

  it('uses per-agent provider and model without reading AiRoutingRule', async () => {
    const snapshot: AiPromptSnapshot = {
      ...baseSnapshot,
      modelConfig: {
        providerMode: 'per_agent',
        agents: {
          ...baseSnapshot.modelConfig.agents,
          SCRIBE: {
            enabled: true,
            provider: 'vertex',
            model: 'gemini-3.5-flash',
            thinkingLevel: 'high',
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 24000,
            validation: {
              provider: 'vertex',
              model: 'gemini-3.5-flash',
              checkedAt: '2026-07-25T00:00:00.000Z',
              probeVersion: 1,
              capabilities: { text: true, vision: true, structured: true },
            },
          },
          EDITOR: {
            enabled: true,
            provider: 'gemini',
            model: 'gemini-3.5-flash',
            thinkingLevel: 'medium',
            temperature: 0.4,
            topP: 0.9,
            maxOutputTokens: 16000,
            validation: {
              provider: 'gemini',
              model: 'gemini-3.5-flash',
              checkedAt: '2026-07-25T00:00:00.000Z',
              probeVersion: 1,
              capabilities: { text: true, vision: true, structured: true },
            },
          },
        },
      },
    };

    const scribe = await service.resolve(
      buildAiContext('SCRIBE', AiMission.READING_GENERATION, {
        productLevel: ProductLevel.INITIE,
      }),
      snapshot,
    );
    const editor = await service.resolve(
      buildAiContext('EDITOR', AiMission.CONTENT_REFINEMENT),
      snapshot,
    );

    expect(scribe.provider).toBe('vertex');
    expect(scribe.model).toBe('gemini-3.5-flash');
    expect(scribe.routingSource).toBe('model-config:SCRIBE');
    expect(editor.provider).toBe('gemini');
    expect(editor.model).toBe('gemini-3.5-flash');
  });

  it('falls back to global GUIDE config when productLevel is absent', async () => {
    const resolved = await service.resolve(
      buildAiContext('GUIDE', AiMission.TIMELINE_BATCH),
      baseSnapshot,
    );

    expect(resolved.model).toBe('gpt-5.4-2026-03-05');
    expect(resolved.routingSource).toBe('model-config:GUIDE');
  });

  it('applies a promptVersion only when it belongs to the requested agent', async () => {
    prisma.promptVersion.findUnique.mockResolvedValue({
      id: 'pv-1',
      key: 'EDITOR',
      version: 3,
      value: 'Pinned EDITOR prompt',
    });

    const resolved = await service.resolve(
      buildAiContext('EDITOR', AiMission.CONTENT_REFINEMENT, {
        promptVersionId: 'pv-1',
      }),
      baseSnapshot,
    );

    expect(resolved.systemPrompt).toContain('Pinned EDITOR prompt');
    expect(resolved.promptVersionId).toBe('pv-1');
  });

  it('throws when promptVersion belongs to another agent', async () => {
    prisma.promptVersion.findUnique.mockResolvedValue({
      id: 'pv-2',
      key: 'SCRIBE',
      version: 1,
      value: 'Wrong agent',
    });

    await expect(
      service.resolve(
        buildAiContext('EDITOR', AiMission.CONTENT_REFINEMENT, {
          promptVersionId: 'pv-2',
        }),
        baseSnapshot,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the active prompt is empty', async () => {
    const snapshot = {
      ...baseSnapshot,
      agentContexts: { ...baseSnapshot.agentContexts, GUIDE: '   ' },
    };

    await expect(
      service.resolve(buildAiContext('GUIDE', AiMission.TIMELINE_BATCH), snapshot),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not execute disabled CONFIDANT or ONIRIQUE agents', async () => {
    await expect(
      service.resolve(buildAiContext('CONFIDANT', AiMission.CHAT_SESSION), baseSnapshot),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.resolve(buildAiContext('ONIRIQUE', AiMission.DREAM_INTERPRETATION), baseSnapshot),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves NARRATOR with the pinned audio snapshot and configured params', async () => {
    const resolved = await service.resolve(
      buildAiContext('NARRATOR', AiMission.AUDIO_NARRATION),
      baseSnapshot,
    );

    expect(resolved.model).toBe('gpt-5.4-2026-03-05');
    expect(resolved.maxTokens).toBe(12000);
  });
});
