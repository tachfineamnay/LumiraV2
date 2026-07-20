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
      heavyModel: 'gemini-2.5-flash',
      flashModel: 'gemini-2.5-flash',
      heavyTemperature: 0.8,
      heavyTopP: 0.95,
      heavyMaxTokens: 16384,
      flashTemperature: 0.9,
      flashTopP: 0.95,
      flashMaxTokens: 2048,
      openaiHeavyModel: 'gpt-4o',
      openaiFlashModel: 'gpt-4o-mini',
      openaiHeavyTemperature: 0.8,
      openaiHeavyTopP: 0.95,
      openaiHeavyMaxTokens: 16384,
      openaiFlashTemperature: 0.9,
      openaiFlashTopP: 0.95,
      openaiFlashMaxTokens: 2048,
    },
    agentProviders: {
      SCRIBE: 'gemini',
      GUIDE: 'gemini',
      EDITOR: 'gemini',
      CONFIDANT: 'gemini',
      ONIRIQUE: 'gemini',
      NARRATOR: 'gemini',
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
    expect(resolved.routingSource).toBe('rule:PROFOND/SCRIBE/READING_GENERATION');
  });

  it('falls back to global agent config when no matrix rule exists', async () => {
    const resolved = await service.resolve(
      buildAiContext('GUIDE', AiMission.TIMELINE_BATCH),
      snapshot,
    );

    expect(resolved.model).toBe('gemini-2.5-flash');
    expect(resolved.routingSource).toBe('global:GUIDE');
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

  it('resolves CONFIDANT and ONIRIQUE with flash global config', async () => {
    const confidant = await service.resolve(
      buildAiContext('CONFIDANT', AiMission.CHAT_SESSION, {
        productLevel: ProductLevel.INITIE,
      }),
      snapshot,
    );
    const onirique = await service.resolve(
      buildAiContext('ONIRIQUE', AiMission.DREAM_INTERPRETATION),
      snapshot,
    );

    expect(confidant.model).toBe('gemini-2.5-flash');
    expect(confidant.routingSource).toBe('global:CONFIDANT');
    expect(onirique.systemPrompt).toBe('ONIRIQUE prompt');
    expect(onirique.routingSource).toBe('global:ONIRIQUE');
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
