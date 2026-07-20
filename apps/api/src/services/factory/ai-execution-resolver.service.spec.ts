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
      },
      GUIDE: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.4-2026-03-05',
        reasoningEffort: 'low',
        verbosity: 'medium',
        maxOutputTokens: 6000,
      },
      EDITOR: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.4-2026-03-05',
        reasoningEffort: 'medium',
        verbosity: 'high',
        maxOutputTokens: 16000,
      },
      NARRATOR: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-4o-2024-11-20',
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 12000,
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
  let aiRouting: { resolveRule: jest.Mock };

  beforeEach(() => {
    prisma = { promptVersion: { findUnique: jest.fn() } };
    aiRouting = { resolveRule: jest.fn().mockResolvedValue(null) };
    service = new AiExecutionResolverService(prisma as never, aiRouting as never);
  });

  it('uses global agent config as the only source in openai_only mode', async () => {
    aiRouting.resolveRule.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 4096,
      source: 'rule:INITIE/SCRIBE/READING_GENERATION',
      isCustomRule: true,
    });

    const resolved = await service.resolve(
      buildAiContext('SCRIBE', AiMission.READING_GENERATION, {
        productLevel: ProductLevel.INITIE,
      }),
      baseSnapshot,
    );

    expect(aiRouting.resolveRule).not.toHaveBeenCalled();
    expect(resolved.provider).toBe('openai');
    expect(resolved.model).toBe('gpt-5.5-2026-04-23');
    expect(resolved.reasoningEffort).toBe('high');
    expect(resolved.routingSource).toBe('global:SCRIBE');
  });

  it('normalizes an invalid persisted model config before execution', async () => {
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

    const resolved = await service.resolve(
      buildAiContext('SCRIBE', AiMission.READING_GENERATION),
      snapshot,
    );

    expect(resolved.provider).toBe('openai');
    expect(resolved.model).toBe('gpt-5.5-2026-04-23');
    expect(resolved.maxTokens).toBe(24000);
  });

  it('falls back to global GUIDE config when productLevel is absent', async () => {
    const resolved = await service.resolve(
      buildAiContext('GUIDE', AiMission.TIMELINE_BATCH),
      baseSnapshot,
    );

    expect(resolved.model).toBe('gpt-5.4-2026-03-05');
    expect(resolved.routingSource).toBe('global:GUIDE');
    expect(aiRouting.resolveRule).not.toHaveBeenCalled();
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

    expect(resolved.model).toBe('gpt-4o-2024-11-20');
    expect(resolved.temperature).toBe(0.3);
    expect(resolved.maxTokens).toBe(12000);
  });
});
