import { AiRunService } from './ai-run.service';
import { AiMission } from '@prisma/client';

describe('AiRunService', () => {
  it('persists run metadata without prompt content', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'run-1' });
    const prisma = { aiRun: { create } };
    const service = new AiRunService(prisma as never);

    await service.recordRun({
      orderId: 'order-1',
      agent: 'SCRIBE',
      mission: AiMission.READING_GENERATION,
      productLevel: 'PROFOND',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      promptVersionId: 'pv-1',
      routingSource: 'rule:PROFOND/SCRIBE/READING_GENERATION',
      status: 'SUCCESS',
      durationMs: 42,
      inputTokens: 100,
      outputTokens: 200,
      estimatedCost: 0.01,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          agent: 'SCRIBE',
          mission: AiMission.READING_GENERATION,
          productLevel: 'PROFOND',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          promptVersionId: 'pv-1',
          status: 'SUCCESS',
          durationMs: 42,
          inputTokens: 100,
          outputTokens: 200,
          estimatedCost: 0.01,
        }),
      }),
    );
    expect(create.mock.calls[0][0].data).not.toHaveProperty('systemPrompt');
  });
});
