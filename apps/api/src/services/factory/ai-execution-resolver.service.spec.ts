import { BadRequestException } from '@nestjs/common';
import { ProductLevel, AiMission } from '@prisma/client';
import { AiExecutionResolverService, buildAiContext } from './ai-execution-resolver.service';
import { AiPromptSnapshot } from './ai-execution.types';

describe('AiExecutionResolverService', () => {
  const snapshot: AiPromptSnapshot = {
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
          model: 'gpt-5.5',
          reasoningEffort: 'high',
          verbosity: 'high',
          maxOutputTokens: 24000,
        },
        GUIDE: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-5.4',
          reasoningEffort: 'low',
          verbosity: 'medium',
          maxOutputTokens: 6000,
        },
        EDITOR: {
          enabled: true,
          provider: 'openai',
          model: 'gpt-5.4',
          reasoningEffort: 'medium',
          verbosity: 'high',
          maxOutputTokens: 16000,
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
    },
  };

  let service: AiExecutionResolverService;
  let prisma: { promptVersion: { findUnique: jest.Mock } };
  let aiRouting: { resolveRule: jest.Mock };

  beforeEach(() => {
    prisma = { promptVersion: { findUnique: jest.fn() } };
    aiRouting = { resolveRule: jest.fn().mockResolvedValue(null) };
    service = new AiExecutionResolverService(prisma as never, aiRouting as never);
  });

  it('uses exact product rule when available', async () => {
    aiRouting.resolveRule.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 4096,
      promptVersionId: undefined,
      isCustomRule: true,
      source: 'rule:PROFOND/SCRIBE/READING_GENERATION',
    });

    const resolved = await service.resolve(
      buildAiContext('SCRIBE', AiMission.READING_GENERATION, {
        productLevel: ProductLevel.PROFOND,
      }),
      snapshot,
    );

    expect(resolved.model).toBe('gpt-4o');
    expect(resolved.provider).toBe('openai');
    expect(resolved.routingSource).toBe('rule:PROFOND/SCRIBE/READING_GENERATION');
  });

  it('falls back to global agent config when no matrix rule exists', async () => {
    const resolved = await service.resolve(
      buildAiContext('GUIDE', AiMission.TIMELINE_BATCH),
      snapshot,
    );

    expect(resolved.model).toBe('gpt-5.4');
    expect(resolved.routingSource).toBe('global:GUIDE');
  });

  it('ignores a legacy Gemini routing rule in openai_only mode', async () => {
    aiRouting.resolveRule.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.8,
      maxTokens: 16384,
      source: 'rule:INITIE/SCRIBE/READING_GENERATION',
      isCustomRule: true,
    });
    const resolved = await service.resolve(
      buildAiContext('SCRIBE', AiMission.READING_GENERATION, { productLevel: ProductLevel.INITIE }),
      snapshot,
    );
    expect(resolved.provider).toBe('openai');
    expect(resolved.model).toBe('gpt-5.5');
    expect(resolved.routingSource).toBe('global:SCRIBE');
  });

  it('applies promptVersion when valid for the agent', async () => {
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
      snapshot,
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
        snapshot,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves NARRATOR with AUDIO_NARRATION mission', async () => {
    const resolved = await service.resolve(
      buildAiContext('NARRATOR', AiMission.AUDIO_NARRATION, {
        productLevel: ProductLevel.INTEGRALE,
      }),
      snapshot,
    );

    expect(resolved.systemPrompt).toContain('NARRATOR prompt');
    expect(resolved.routingSource).toBe('global:NARRATOR');
  });

  it('does not execute disabled CONFIDANT or ONIRIQUE agents', async () => {
    await expect(
      service.resolve(buildAiContext('CONFIDANT', AiMission.CHAT_SESSION), snapshot),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.resolve(buildAiContext('ONIRIQUE', AiMission.DREAM_INTERPRETATION), snapshot),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses controlled default when productLevel is absent', async () => {
    const resolved = await service.resolve(
      buildAiContext('SCRIBE', AiMission.READING_GENERATION),
      snapshot,
    );

    expect(resolved.routingSource).toBe('global:SCRIBE');
    expect(aiRouting.resolveRule).not.toHaveBeenCalled();
  });
});
